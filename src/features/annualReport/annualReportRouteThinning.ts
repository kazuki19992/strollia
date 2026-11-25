import { simplifyRouteCoordinates } from '@/features/map/routeMapper';

import type { AnnualReportCoordinate, AnnualReportTimedCoordinate } from './annualReportTypes';

/** 1年分ルート全体の座標数の上限。ペイロード肥大と描画負荷を抑える。 */
export const YEAR_ROUTE_POINT_BUDGET = 2000;

/** 最遠日ルート(時刻付き)の座標数の上限。 */
export const FARTHEST_DAY_POINT_BUDGET = 500;

/** 月ごとのステップ集計で1か月が使える座標数の目安(年間予算を12等分)。 */
export const MONTH_ROUTE_POINT_BUDGET = Math.floor(YEAR_ROUTE_POINT_BUDGET / 12);

/** 単純化の初期許容誤差(メートル)。 */
const INITIAL_TOLERANCE_METERS = 10;

/** 許容誤差を倍々にする最大回数。これで収まらなければ等間隔の間引きへ切り替える。 */
const MAX_TOLERANCE_DOUBLINGS = 10;

/** 長さ length の列から、先頭と末尾を含む等間隔の count 個のインデックスを返す。 */
function evenIndexes(length: number, count: number): number[] {
  if (count >= length) {
    return Array.from({ length }, (_, i) => i);
  }
  if (count <= 1) {
    return [0];
  }
  const indexes: number[] = [];
  for (let i = 0; i < count; i += 1) {
    indexes.push(Math.round((i * (length - 1)) / (count - 1)));
  }
  return indexes;
}

/** 先頭・末尾を残して等間隔に count 点へ間引く。 */
function sampleEvenly<T>(items: T[], count: number): T[] {
  return evenIndexes(items.length, Math.max(2, count)).map((index) => items[index]);
}

const countPoints = (segments: AnnualReportCoordinate[][]) => segments.reduce((sum, segment) => sum + segment.length, 0);

/**
 * 区間ごとのルートを合計 budget 点以下へ間引く。
 * まずDouglas-Peuckerの許容誤差を倍々にして形を保ったまま減らし、それでも収まらなければ区間の長さに比例して等間隔に間引く。
 * 各区間の先頭と末尾は必ず残し、2点未満の区間は捨てる。区間は日をまたいでつながない前提でそのまま維持する。
 * 区間数×2が budget を超える場合のみ、先頭・末尾保持を優先して budget を超えうる。
 */
export function thinRouteSegments(segments: AnnualReportCoordinate[][], budget: number): AnnualReportCoordinate[][] {
  let current = segments.filter((segment) => segment.length >= 2);
  if (countPoints(current) <= budget) {
    return current;
  }

  let tolerance = INITIAL_TOLERANCE_METERS;
  for (let i = 0; i < MAX_TOLERANCE_DOUBLINGS && countPoints(current) > budget; i += 1) {
    current = current.map((segment) => simplifyRouteCoordinates(segment, tolerance));
    tolerance *= 2;
  }

  const totalPoints = countPoints(current);
  if (totalPoints <= budget) {
    return current;
  }

  // 描画できない2点未満の区間は出力しない(sampleEvenly も最低2点を保つが、不変条件をここで明示する)
  return current
    .map((segment) => sampleEvenly(segment, Math.floor((segment.length * budget) / totalPoints)))
    .filter((segment) => segment.length >= 2);
}

/** 時刻付きルートを等間隔に budget 点以下へ間引く。先頭と末尾を残し、元の時刻順を保つ。 */
export function thinTimedRoute(points: AnnualReportTimedCoordinate[], budget: number): AnnualReportTimedCoordinate[] {
  if (points.length <= budget) {
    return points;
  }
  return sampleEvenly(points, budget);
}
