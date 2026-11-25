import type { AnnualReportCoordinate, AnnualReportTimedCoordinate } from '@/features/annualReport/annualReportTypes';
import { distanceMeters } from '@/utils/distance';

/** カレンダー表示(ページ2)の1日分のマス。 */
export type AnnualReportCalendarCell = {
  /** YYYY-MM-DD。 */
  date: string;
  /** 記録のある日か。 */
  active: boolean;
};

/** エリア表示(ページ8)の1マスの状態。前年までのエリア / その年に初めて塗ったエリア / 未訪問。 */
export type AnnualReportAreaCell = 'old' | 'new' | 'empty';

/** エリア表示のサンプルで塗られたマスにする割合。実際の地図ではなく雰囲気を見せる飾りのため固定にする。 */
const AREA_SAMPLE_FILLED_RATIO = 0.62;

/** 2桁ゼロ埋め。 */
function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * 対象年の1月1日〜12月31日を順に並べ、記録のある日を点灯にしたカレンダーのマスを作る。
 * 集計期間(〜12/15)の外の日も、1年の形を見せるために消灯で並べる。
 */
export function buildCalendarCells(year: number, activeDates: string[]): AnnualReportCalendarCell[] {
  const activeSet = new Set(activeDates);
  const cells: AnnualReportCalendarCell[] = [];
  // 月日の繰り上がりはDateに任せる(うるう年もここで吸収する)
  for (const day = new Date(year, 0, 1); day.getFullYear() === year; day.setDate(day.getDate() + 1)) {
    const date = `${year}-${pad2(day.getMonth() + 1)}-${pad2(day.getDate())}`;
    cells.push({ date, active: activeSet.has(date) });
  }
  return cells;
}

/**
 * 新しく塗ったエリアの演出用サンプル(実際の位置ではない)を作る。
 *
 * 塗られたマスの中の新旧の比率を、前年までのエリア数と新しいエリア数の比に合わせる。
 * 新しいエリアが1件以上あれば最低1マスは新しいエリアにする。並びは固定シードで混ぜ、毎回同じ見た目にする。
 */
export function buildAreaSampleCells(previousCount: number, newCount: number, cellCount: number): AnnualReportAreaCell[] {
  const filled = Math.round(cellCount * AREA_SAMPLE_FILLED_RATIO);
  const total = previousCount + newCount;
  const rawNew = total > 0 ? Math.round((filled * newCount) / total) : 0;
  const newCells = newCount > 0 ? Math.min(filled, Math.max(1, rawNew)) : 0;
  const oldCells = total > 0 ? filled - newCells : 0;

  const cells: AnnualReportAreaCell[] = [
    ...Array<AnnualReportAreaCell>(oldCells).fill('old'),
    ...Array<AnnualReportAreaCell>(newCells).fill('new'),
    ...Array<AnnualReportAreaCell>(cellCount - oldCells - newCells).fill('empty'),
  ];

  // 固定シードの線形合同法で Fisher-Yates シャッフルする(再描画やスナップショットで並びを変えないため)
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let index = cells.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [cells[index], cells[swapIndex]] = [cells[swapIndex], cells[index]];
  }
  return cells;
}

/** エリアのタイル広場(ページ8)で描くタイルの上限枚数。マス数に比例して View を増やさないための上限。 */
export const AREA_TILE_MAX_COUNT = 100;

/** エリアのタイル広場の配置。 */
export type AnnualReportAreaTileLayout = {
  /** 格子の列数。 */
  columns: number;
  /** 格子の行数。 */
  rows: number;
  /** 実際に描くタイルの枚数(最後の行は埋まらないことがある)。 */
  tileCount: number;
  /** タイル1枚が代表するマス数。 */
  cellsPerTile: number;
};

/**
 * 新しく塗ったマス数から、タイル広場の配置を決める。
 *
 * マスを全部描くと数千〜数万の View になるため、タイルは最大 maxTiles 枚にまとめ、1枚に複数マスを代表させる。
 * 格子は正方形に近い形(列数 = ceil(√枚数))にする。0件は全部0を返す。
 */
export function buildAreaTileLayout(cellCount: number, maxTiles = AREA_TILE_MAX_COUNT): AnnualReportAreaTileLayout {
  const tileCount = Math.min(Math.max(0, Math.floor(cellCount)), maxTiles);
  if (tileCount === 0) {
    return { columns: 0, rows: 0, tileCount: 0, cellsPerTile: 0 };
  }
  const columns = Math.ceil(Math.sqrt(tileCount));
  return { columns, rows: Math.ceil(tileCount / columns), tileCount, cellsPerTile: Math.ceil(cellCount / tileCount) };
}

/** エポックミリ秒を端末ローカル時刻の `HH:MM` にする。 */
export function formatClockTime(epochMs: number): string {
  const date = new Date(epochMs);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** ルート再生用に前計算した累積距離と時刻。 */
export type AnnualReportRoutePlayback = {
  route: AnnualReportTimedCoordinate[];
  /** 各点までの累積距離(m)。route と同じ長さ。 */
  cumulativeMeters: number[];
  /** 各点の記録時刻(エポックミリ秒)。 */
  recordedAtMs: number[];
};

/** ルート再生の1コマ。 */
export type AnnualReportRoutePlaybackFrame = {
  /** 現在地点までの軌跡(現在地点を含む)。 */
  trail: AnnualReportCoordinate[];
  /** 現在地点。 */
  position: AnnualReportCoordinate;
  /** 現在地点の推定記録時刻(エポックミリ秒)。 */
  recordedAtMs: number;
  /** 全長に対する進んだ距離の割合(0〜1)。距離表示に使う。 */
  distanceFraction: number;
};

/** ルート再生のために累積距離を前計算する。毎フレーム計算し直さないため分けている。 */
export function createRoutePlayback(route: AnnualReportTimedCoordinate[]): AnnualReportRoutePlayback {
  const cumulativeMeters: number[] = [];
  route.forEach((point, index) => {
    cumulativeMeters.push(index === 0 ? 0 : cumulativeMeters[index - 1] + distanceMeters(route[index - 1], point));
  });
  return { route, cumulativeMeters, recordedAtMs: route.map((point) => Date.parse(point.recordedAt)) };
}

/**
 * 進行度(0〜1、経路長に対する割合)に応じた現在地点・軌跡・時刻を返す。
 * 点の間は直線で補間し、時刻も同じ割合で補間する。最遠日のルートは区切りのない1本線として扱う。
 */
export function resolveRoutePlaybackFrame(playback: AnnualReportRoutePlayback, fraction: number): AnnualReportRoutePlaybackFrame {
  const { route, cumulativeMeters, recordedAtMs } = playback;
  if (route.length === 0) {
    return { trail: [], position: { latitude: 0, longitude: 0 }, recordedAtMs: 0, distanceFraction: 0 };
  }

  const toCoordinate = (point: AnnualReportCoordinate): AnnualReportCoordinate => ({
    latitude: point.latitude,
    longitude: point.longitude,
  });
  const totalMeters = cumulativeMeters[cumulativeMeters.length - 1];
  const clamped = Math.min(Math.max(fraction, 0), 1);

  if (route.length === 1 || totalMeters === 0 || clamped === 0) {
    return { trail: [toCoordinate(route[0])], position: toCoordinate(route[0]), recordedAtMs: recordedAtMs[0], distanceFraction: 0 };
  }
  if (clamped === 1) {
    const last = route[route.length - 1];
    return {
      trail: route.map(toCoordinate),
      position: toCoordinate(last),
      recordedAtMs: recordedAtMs[route.length - 1],
      distanceFraction: 1,
    };
  }

  const targetMeters = totalMeters * clamped;
  let segmentEnd = 1;
  while (segmentEnd < route.length - 1 && cumulativeMeters[segmentEnd] < targetMeters) {
    segmentEnd += 1;
  }
  const segmentStart = segmentEnd - 1;
  const segmentMeters = cumulativeMeters[segmentEnd] - cumulativeMeters[segmentStart];
  const ratio = segmentMeters === 0 ? 0 : (targetMeters - cumulativeMeters[segmentStart]) / segmentMeters;
  const from = route[segmentStart];
  const to = route[segmentEnd];
  const position = {
    latitude: from.latitude + (to.latitude - from.latitude) * ratio,
    longitude: from.longitude + (to.longitude - from.longitude) * ratio,
  };

  return {
    trail: [...route.slice(0, segmentEnd).map(toCoordinate), position],
    position,
    recordedAtMs: recordedAtMs[segmentStart] + (recordedAtMs[segmentEnd] - recordedAtMs[segmentStart]) * ratio,
    distanceFraction: clamped,
  };
}

/**
 * ルートを始点・終点を残して等間隔に間引き、最大 maxPoints 点にする。
 * 再生中は毎段階で軌跡の Polyline を描き直すため、点数を抑えて描画負荷を下げる。
 */
export function downsampleRoute<T>(route: T[], maxPoints: number): T[] {
  if (route.length <= maxPoints || maxPoints < 2) {
    return route;
  }
  const lastIndex = route.length - 1;
  return Array.from({ length: maxPoints }, (_, index) => route[Math.round((index * lastIndex) / (maxPoints - 1))]);
}

/** 最遠日ページで再生に使うルートの最大点数。段階ごとに軌跡を描き直すため、点数を抑える。 */
export const FARTHEST_DAY_PLAYBACK_MAX_POINTS = 300;

/**
 * 最遠日ページが地図に描くルート(保存済みルートを再生用に間引いたもの)を返す。
 * 共有前の非表示半径の判定でも、実際に描く線と同じものを使うためにページと共有で共通化する。
 */
export function toFarthestDayPlaybackRoute<T>(route: T[]): T[] {
  return downsampleRoute(route, FARTHEST_DAY_PLAYBACK_MAX_POINTS);
}

/**
 * 1件ずつ一定間隔で現れる演出で、経過時間までに現れた件数を steps 段階に切り上げて返す。
 * 数百のマスを個別にアニメーションさせる代わりに、件数を段階的に増やして再描画の回数を抑えるため。
 */
export function quantizeRevealCount(elapsedMs: number, startMs: number, intervalMs: number, total: number, steps: number): number {
  if (total <= 0 || elapsedMs < startMs) {
    return 0;
  }
  const revealed = Math.min(total, Math.floor((elapsedMs - startMs) / Math.max(intervalMs, 0.001)) + 1);
  const stepSize = Math.max(1, Math.ceil(total / steps));
  return Math.min(total, Math.ceil(revealed / stepSize) * stepSize);
}
