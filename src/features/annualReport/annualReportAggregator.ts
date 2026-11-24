import { getLocationPointsByDate, getLocationPointsByMonth } from '@/features/logs/logRepository';
import { toRenderRouteSegments } from '@/features/map/routeMapper';
import type { LocationPoint } from '@/types/gps';
import { toLocalDate } from '@/utils/date';
import { totalDistanceMeters } from '@/utils/distance';

import { meetsMinimumActiveDays, type AnnualReportWindow } from './annualReportPeriod';
import {
  getAchievementUnlockSummary,
  getDailyDistanceRows,
  getLandmarkSpotVisitSummary,
  getNewAdminAreaSummary,
  getVisitedCellCounts,
  getVisitedPrefectureNames,
  toLocalDayStartIso,
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

/**
 * 1ステップの結果。
 * - progressed: 月ステップを1つ進めた。呼び出し側が progress を保存する。
 * - completed: 最終ステップで payload を組み立てた。
 * - insufficient: 記録日数が足りずレポートを作らない。
 */
export type AnnualReportStepResult =
  { kind: 'progressed'; progress: AnnualReportProgress } | { kind: 'completed'; payload: AnnualReportPayloadV1 } | { kind: 'insufficient' };

/** 集計開始時の進捗(1月から、月別距離はすべて0)を作る。 */
export function createInitialProgress(): AnnualReportProgress {
  return {
    nextMonth: 1,
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
 * 1か月分を集計し、新しい進捗を返す。入力の progress は変更しない。
 *
 * 月別距離は加算ではなくその月の値で置き換えるため、同じ progress で再実行しても二重に数えない。
 */
async function runMonthStep(window: AnnualReportWindow, progress: AnnualReportProgress): Promise<AnnualReportProgress> {
  const month = progress.nextMonth;
  const yearMonth = toYearMonth(window.year, month);
  const monthStart = `${yearMonth}-01`;
  const advanced = { ...progress, nextMonth: month + 1 };

  // 開発用フラグ時は periodEnd が年の途中になるため、それより後の月は読み込まない
  if (monthStart > window.periodEnd) {
    return advanced;
  }

  const lastDayOfMonth = toLocalDate(new Date(window.year, month, 0));
  const monthEnd = lastDayOfMonth < window.periodEnd ? lastDayOfMonth : window.periodEnd;

  const rows = await getDailyDistanceRows(monthStart, monthEnd);
  const points = (await getLocationPointsByMonth(yearMonth)).filter((point) => point.localDate <= window.periodEnd);
  const pointsByDate = groupPointsByDate(points);

  let monthDistance = 0;
  let farthestCandidate = progress.farthestCandidate;
  for (const row of rows) {
    // daily_logs の距離を優先し、未計算の日だけポイントから求める(月次レポートと同じ方針)
    const distance = row.distanceMeters ?? totalDistanceMeters(pointsByDate.get(row.localDate) ?? []);
    monthDistance += distance;
    // 月を昇順・日を昇順に処理するため、厳密に大きいときだけ入れ替えれば同距離では早い日付が残る
    if (!farthestCandidate || distance > farthestCandidate.distanceMeters) {
      farthestCandidate = { localDate: row.localDate, distanceMeters: distance };
    }
  }

  // 日をまたいで線をつながないよう、日ごとに区間化してから月の予算へ間引く
  const monthSegments: AnnualReportCoordinate[][] = [];
  for (const dayPoints of pointsByDate.values()) {
    for (const segment of toRenderRouteSegments(dayPoints)) {
      monthSegments.push(segment.coordinates);
    }
  }

  const monthlyDistanceMeters = [...progress.monthlyDistanceMeters];
  monthlyDistanceMeters[month - 1] = monthDistance;

  return {
    ...advanced,
    activeDates: [...progress.activeDates, ...rows.map((row) => row.localDate)],
    monthlyDistanceMeters,
    yearRouteSegments: [...progress.yearRouteSegments, ...thinRouteSegments(monthSegments, MONTH_ROUTE_POINT_BUDGET)],
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
    previousCellCount,
    achievements,
    spots,
  };
}

/**
 * 年次レポート集計を1ステップ進める。DBへは書かない(保存は呼び出し側が行う)。
 *
 * nextMonth が1〜12なら1か月分を集計して新しい進捗を返し、13なら記録日数を確かめて payload を組み立てる。
 * アプリを固めないよう1か月ずつに分け、ステップ間で進捗を保存して中断から再開できるようにしている。
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
  if (progress.nextMonth <= LAST_MONTH) {
    return { kind: 'progressed', progress: await runMonthStep(window, progress) };
  }

  if (!meetsMinimumActiveDays(progress.activeDates.length, alwaysAvailable)) {
    return { kind: 'insufficient' };
  }

  return { kind: 'completed', payload: await buildPayload(window, progress) };
}
