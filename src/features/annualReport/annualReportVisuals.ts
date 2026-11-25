import type {
  AnnualReportAreaCellIndex,
  AnnualReportAreaMap,
  AnnualReportCoordinate,
  AnnualReportTimedCoordinate,
} from '@/features/annualReport/annualReportTypes';
import { cellToPolygonCoordinates } from '@/features/location/grid/gridCell';
import { hasPrivacyRadiusInSegments } from '@/features/stayPlaces/privacyRouteSegments';
import type { StayPlace } from '@/features/stayPlaces/stayPlaceTypes';
import { distanceMeters } from '@/utils/distance';

/** カレンダー表示(ページ2)の1日分のマス。 */
export type AnnualReportCalendarCell = {
  /** YYYY-MM-DD。 */
  date: string;
  /** 記録のある日か。 */
  active: boolean;
};

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

/** 地図のマス(セル番号)を、地図画面の visited grid と同じ4頂点(左下から時計回り)にする。 */
export function areaCellToPolygon(cell: AnnualReportAreaCellIndex, cellSizeMeters: number): AnnualReportCoordinate[] {
  const [x, y] = cell;
  return cellToPolygonCoordinates({ cellId: `${cellSizeMeters}:${x}:${y}`, cellSizeMeters, x, y });
}

/**
 * マスが「共有時に隠す範囲」にかかるか判定する。
 *
 * 外周(始点に戻る閉じた線)が非表示半径の円にかかるかを `hasPrivacyRadiusInSegments` で見る。
 * それだけでは、10km などの大きいマスの内側に円がすっぽり入って辺に触れない場合を見落とすため、
 * 非表示半径を持つ滞在場所の中心がマスの緯度経度範囲に入っているかも見る。
 * 非表示設定が壊れているときは `hasPrivacyRadiusInSegments` が true を返すため、安全側に倒してすべて隠す。
 */
export function isAreaCellHiddenByPrivacy(cell: AnnualReportAreaCellIndex, cellSizeMeters: number, stayPlaces: StayPlace[]): boolean {
  const polygon = areaCellToPolygon(cell, cellSizeMeters);
  if (hasPrivacyRadiusInSegments([[...polygon, polygon[0]]], stayPlaces)) {
    return true;
  }
  const latitudes = polygon.map((point) => point.latitude);
  const longitudes = polygon.map((point) => point.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  return stayPlaces.some(
    (place) =>
      place.privacyRadiusMeters != null &&
      place.latitude >= minLatitude &&
      place.latitude <= maxLatitude &&
      place.longitude >= minLongitude &&
      place.longitude <= maxLongitude,
  );
}

/** 「隠して共有」用に、新しいマス・前からのマスから非表示範囲にかかるマスを除いた地図を返す。 */
export function hideAreaMapCellsByPrivacy(areaMap: AnnualReportAreaMap, stayPlaces: StayPlace[]): AnnualReportAreaMap {
  const isVisible = (cell: AnnualReportAreaCellIndex) => !isAreaCellHiddenByPrivacy(cell, areaMap.cellSizeMeters, stayPlaces);
  return {
    cellSizeMeters: areaMap.cellSizeMeters,
    newCells: areaMap.newCells.filter(isVisible),
    previousCells: areaMap.previousCells.filter(isVisible),
  };
}

/** 新しいマス・前からのマスのどれかが非表示範囲にかかるか。共有前の確認ダイアログを出すかの判定に使う。 */
export function hasPrivacyRadiusInAreaMap(areaMap: AnnualReportAreaMap, stayPlaces: StayPlace[]): boolean {
  return [...areaMap.newCells, ...areaMap.previousCells].some((cell) =>
    isAreaCellHiddenByPrivacy(cell, areaMap.cellSizeMeters, stayPlaces),
  );
}
