import { getLocationPointsByDate } from '@/features/logs/logRepository';
import { toRenderRouteSegments } from '@/features/map/routeMapper';
import type { LocationPoint } from '@/types/gps';
import { toLocalDate } from '@/utils/date';
import { totalDistanceMeters } from '@/utils/distance';

import { sumGroundAreaSquareMeters } from './annualReportArea';
import { meetsMinimumActiveDays, type AnnualReportWindow } from './annualReportPeriod';
import {
  getAchievementUnlockSummary,
  getAnnualReportRoutePoints,
  getDailyDistanceRows,
  getLandmarkSpotVisitSummary,
  getNewAdminAreaSummary,
  getNewCellCountsByRow,
  getVisitedCellCounts,
  getVisitedPrefectureNames,
  toLocalDayStartIso,
  type AnnualReportRoutePoint,
} from './annualReportQueries';
import {
  FARTHEST_DAY_POINT_BUDGET,
  MONTH_ROUTE_POINT_BUDGET,
  thinRouteSegments,
  thinTimedRoute,
  YEAR_ROUTE_POINT_BUDGET,
} from './annualReportRouteThinning';
import {
  ANNUAL_REPORT_PAYLOAD_VERSION,
  type AnnualReportCoordinate,
  type AnnualReportPayloadV1,
  type AnnualReportProgress,
  type AnnualReportTimedCoordinate,
} from './annualReportTypes';

/** 月ステップの最後の月。これを終えると nextMonth は最終ステップを表す13になる。 */
const LAST_MONTH = 12;

/** 月の前半の最終日。前半は1〜15日、後半は16日〜月末を集計する。 */
const FIRST_HALF_LAST_DAY = 15;

/** 半月ステップ1回が使える座標数の目安。月の予算を前半・後半で分ける。 */
const HALF_MONTH_ROUTE_POINT_BUDGET = Math.floor(MONTH_ROUTE_POINT_BUDGET / 2);

/**
 * 1ステップの結果。
 * - progressed: 半月ステップを1つ進めた。呼び出し側が progress を保存する。
 * - completed: 最終ステップで payload を組み立てた。
 * - insufficient: 記録日数が足りずレポートを作らない。
 */
export type AnnualReportStepResult =
  { kind: 'progressed'; progress: AnnualReportProgress } | { kind: 'completed'; payload: AnnualReportPayloadV1 } | { kind: 'insufficient' };

/** 集計開始時の進捗(1月から、月別距離はすべて0)を作る。 */
export function createInitialProgress(): AnnualReportProgress {
  return {
    nextMonth: 1,
    nextHalf: 1,
    activeDates: [],
    monthlyDistanceMeters: Array.from({ length: LAST_MONTH }, () => 0),
    yearRouteSegments: [],
    farthestCandidate: null,
  };
}

/** `YYYY-MM` 形式の年月文字列を作る。 */
function toYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** 日付の文字列(YYYY-MM-DD)を作る。 */
function toDateString(yearMonth: string, day: number): string {
  return `${yearMonth}-${String(day).padStart(2, '0')}`;
}

/**
 * 保存済みの進捗として解釈できるか。
 * 古いビルドや壊れた行の進捗をそのまま使うと集計結果が狂うため、形が合わなければ最初からやり直させる。
 * `nextHalf` の無い進捗は半月分割より前の形式で、月の区切りまで終えているため有効とする。
 */
function isValidProgress(progress: unknown): progress is AnnualReportProgress {
  if (typeof progress !== 'object' || progress === null) return false;
  const candidate = progress as Partial<AnnualReportProgress>;
  return (
    Number.isInteger(candidate.nextMonth) &&
    (candidate.nextMonth as number) >= 1 &&
    (candidate.nextMonth as number) <= LAST_MONTH + 1 &&
    (candidate.nextHalf === undefined || candidate.nextHalf === 1 || candidate.nextHalf === 2) &&
    Array.isArray(candidate.activeDates) &&
    Array.isArray(candidate.monthlyDistanceMeters) &&
    candidate.monthlyDistanceMeters.length === LAST_MONTH &&
    Array.isArray(candidate.yearRouteSegments) &&
    candidate.farthestCandidate !== undefined
  );
}

/**
 * 保存済みの進捗を、集計で実際に使う形にそろえる。解釈できない進捗は最初からの進捗に置き換える。
 * ステップの失敗を記録するときも、実際に集計した位置を残すために使う。
 */
export function normalizeAnnualReportProgress(progress: unknown): AnnualReportProgress {
  return isValidProgress(progress) ? progress : createInitialProgress();
}

/** 日付文字列(YYYY-MM-DD)の翌日を返す。 */
function nextLocalDate(localDate: string): string {
  const [year, month, day] = localDate.split('-').map(Number);
  return toLocalDate(new Date(year, month - 1, day + 1));
}

/** ポイントを記録日ごとにまとめる。入力の時系列順は日の中でも保たれる。 */
function groupPointsByDate(points: LocationPoint[]): Map<string, LocationPoint[]> {
  const groups = new Map<string, LocationPoint[]>();
  for (const point of points) {
    const group = groups.get(point.localDate);
    if (group) {
      group.push(point);
    } else {
      groups.set(point.localDate, [point]);
    }
  }
  return groups;
}

/**
 * ルート用ポイントを、区間化(`toRenderRouteSegments`)が受け取る `LocationPoint` の形にそろえる。
 * 区間化と距離計算は時刻・日付・座標しか使わないため、読み込んでいない列は空の値で埋める。
 */
function toLocationPoint(point: AnnualReportRoutePoint, index: number): LocationPoint {
  return {
    id: index,
    altitude: null,
    speed: null,
    heading: null,
    accuracy: null,
    altitudeAccuracy: null,
    ...point,
  };
}

/**
 * 半月分(前半: 1〜15日、後半: 16日〜月末)を集計し、新しい進捗を返す。入力の progress は変更しない。
 *
 * 1回の JS タスクで扱うポイントを減らすため、月を半分に分けている。
 * 前半はその月の距離を置き換え、後半は入力の progress にある前半の距離へ足すため、
 * 同じ progress で再実行しても二重に数えない(進捗はステップごとに保存し、前半・後半のどちらまで終えたかも残す)。
 */
async function runHalfMonthStep(window: AnnualReportWindow, progress: AnnualReportProgress): Promise<AnnualReportProgress> {
  const month = progress.nextMonth;
  const half = progress.nextHalf ?? 1;
  const yearMonth = toYearMonth(window.year, month);
  const advanced: AnnualReportProgress =
    half === 1 ? { ...progress, nextMonth: month, nextHalf: 2 } : { ...progress, nextMonth: month + 1, nextHalf: 1 };

  const lastDayOfMonth = new Date(window.year, month, 0).getDate();
  const halfStart = toDateString(yearMonth, half === 1 ? 1 : FIRST_HALF_LAST_DAY + 1);
  const halfLast = toDateString(yearMonth, half === 1 ? FIRST_HALF_LAST_DAY : lastDayOfMonth);

  // 12月後半や、開発用フラグ時の年の途中の periodEnd より後は読み込まない
  if (halfStart > window.periodEnd) {
    return advanced;
  }
  const halfEnd = halfLast < window.periodEnd ? halfLast : window.periodEnd;

  const rows = await getDailyDistanceRows(halfStart, halfEnd);
  const points = (await getAnnualReportRoutePoints(halfStart, halfEnd)).map(toLocationPoint);
  const pointsByDate = groupPointsByDate(points);

  let halfDistance = 0;
  let farthestCandidate = progress.farthestCandidate;
  for (const row of rows) {
    // daily_logs の距離を優先し、未計算の日だけポイントから求める(月次レポートと同じ方針)
    const distance = row.distanceMeters ?? totalDistanceMeters(pointsByDate.get(row.localDate) ?? []);
    halfDistance += distance;
    // 日付の昇順に処理するため、厳密に大きいときだけ入れ替えれば同距離では早い日付が残る
    if (!farthestCandidate || distance > farthestCandidate.distanceMeters) {
      farthestCandidate = { localDate: row.localDate, distanceMeters: distance };
    }
  }

  // 日をまたいで線をつながないよう、日ごとに区間化してから半月の予算へ間引く
  const halfSegments: AnnualReportCoordinate[][] = [];
  for (const dayPoints of pointsByDate.values()) {
    for (const segment of toRenderRouteSegments(dayPoints)) {
      halfSegments.push(segment.coordinates);
    }
  }

  const monthlyDistanceMeters = [...progress.monthlyDistanceMeters];
  monthlyDistanceMeters[month - 1] = (half === 1 ? 0 : progress.monthlyDistanceMeters[month - 1]) + halfDistance;

  return {
    ...advanced,
    activeDates: [...progress.activeDates, ...rows.map((row) => row.localDate)],
    monthlyDistanceMeters,
    yearRouteSegments: [...progress.yearRouteSegments, ...thinRouteSegments(halfSegments, HALF_MONTH_ROUTE_POINT_BUDGET)],
    farthestCandidate,
  };
}

/** 最遠日のルートを時刻付きで読み込み、予算内へ間引く。吸着後の有効座標があればそちらを使う。 */
async function loadFarthestDayRoute(localDate: string): Promise<AnnualReportTimedCoordinate[]> {
  const points = await getLocationPointsByDate(localDate);
  const route = points.map((point) => ({
    latitude: point.effectiveLatitude ?? point.latitude,
    longitude: point.effectiveLongitude ?? point.longitude,
    recordedAt: point.recordedAt,
  }));
  return thinTimedRoute(route, FARTHEST_DAY_POINT_BUDGET);
}

/** 全月の進捗とサマリークエリから payload を組み立てる。 */
async function buildPayload(window: AnnualReportWindow, progress: AnnualReportProgress): Promise<AnnualReportPayloadV1> {
  const { periodStart, periodEnd } = window;
  // first_visited_at はISO(UTC)のため、ローカル日の境界へ変換し、終端は翌日0:00を排他で使う
  const fromIso = toLocalDayStartIso(periodStart);
  const toIsoExclusive = toLocalDayStartIso(nextLocalDate(periodEnd));

  const farthestDay = progress.farthestCandidate
    ? { ...progress.farthestCandidate, route: await loadFarthestDayRoute(progress.farthestCandidate.localDate) }
    : null;
  const visitedPrefectures = await getVisitedPrefectureNames(periodStart, periodEnd);
  const { newPrefectures, newMunicipalityCount } = await getNewAdminAreaSummary(fromIso, toIsoExclusive);
  const { newCellCount, previousCellCount } = await getVisitedCellCounts(fromIso, toIsoExclusive);
  const newAreaSquareMeters = sumGroundAreaSquareMeters(await getNewCellCountsByRow(fromIso, toIsoExclusive));
  const achievements = await getAchievementUnlockSummary(periodStart, periodEnd);
  const spots = await getLandmarkSpotVisitSummary(periodStart, periodEnd);

  return {
    version: ANNUAL_REPORT_PAYLOAD_VERSION,
    year: window.year,
    periodStart,
    periodEnd,
    activeDays: progress.activeDates.length,
    activeDates: progress.activeDates,
    totalDistanceMeters: progress.monthlyDistanceMeters.reduce((sum, value) => sum + value, 0),
    monthlyDistanceMeters: progress.monthlyDistanceMeters,
    yearRouteSegments: thinRouteSegments(progress.yearRouteSegments, YEAR_ROUTE_POINT_BUDGET),
    farthestDay,
    visitedPrefectures,
    newPrefectures,
    newMunicipalityCount,
    newCellCount,
    newAreaSquareMeters,
    previousCellCount,
    achievements,
    spots,
  };
}

/**
 * 年次レポート集計を1ステップ進める。DBへは書かない(保存は呼び出し側が行う)。
 *
 * nextMonth が1〜12なら半月分(nextHalf)を集計して新しい進捗を返し、13なら記録日数を確かめて payload を組み立てる。
 * アプリを固めないよう半月ずつに分け、ステップ間で進捗を保存して中断から再開できるようにしている。
 * 形式を解釈できない進捗(古いビルド・壊れた行)は捨てて、最初から集計し直す。
 *
 * @param window - 集計対象(年と集計期間)。
 * @param progress - これまでの進捗。変更しない。
 * @param alwaysAvailable - 開発用フラグ。有効なら記録日数の条件を無視する。
 */
export async function runAnnualReportStep(
  window: AnnualReportWindow,
  progress: AnnualReportProgress,
  alwaysAvailable: boolean,
): Promise<AnnualReportStepResult> {
  const current = normalizeAnnualReportProgress(progress);
  if (current.nextMonth <= LAST_MONTH) {
    return { kind: 'progressed', progress: await runHalfMonthStep(window, current) };
  }

  if (!meetsMinimumActiveDays(current.activeDates.length, alwaysAvailable)) {
    return { kind: 'insufficient' };
  }

  return { kind: 'completed', payload: await buildPayload(window, current) };
}
