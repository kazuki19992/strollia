import type { Region } from 'react-native-maps';

import { LocationPoint } from '../../types/gps';

/** react-native-mapsのPolylineへ渡す緯度経度座標。 */
export type RouteCoordinate = {
  latitude: number;
  longitude: number;
};

/** Douglas-Peucker計算用にメートル近似の平面座標を付与した点。 */
type ProjectedPoint = RouteCoordinate & {
  x: number;
  y: number;
};

/** GPSログがない場合の初期表示位置。東京駅付近を暫定値にする。 */
const DEFAULT_REGION: Region = {
  latitude: 35.681236,
  longitude: 139.767125,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

/** 徒歩ログの形状を保ちつつ描画点を減らすデフォルト許容誤差。 */
export const DEFAULT_ROUTE_SIMPLIFY_TOLERANCE_METERS = 10;

/** 保存済みGPSポイントを地図描画用の緯度経度へ変換する。 */
export function toRouteCoordinates(points: LocationPoint[]): RouteCoordinate[] {
  return points.map((point) => ({ latitude: point.latitude, longitude: point.longitude }));
}

/** 保存用ポイントから簡略化済みの描画用座標を生成する。 */
export function toRenderRouteCoordinates(
  points: LocationPoint[],
  toleranceMeters = DEFAULT_ROUTE_SIMPLIFY_TOLERANCE_METERS,
): RouteCoordinate[] {
  return simplifyRouteCoordinates(toRouteCoordinates(points), toleranceMeters);
}

/** Douglas-Peucker法でルート形状を保ちながら座標数を減らす。 */
export function simplifyRouteCoordinates(coordinates: RouteCoordinate[], toleranceMeters = DEFAULT_ROUTE_SIMPLIFY_TOLERANCE_METERS): RouteCoordinate[] {
  if (coordinates.length <= 2 || toleranceMeters <= 0) {
    return coordinates;
  }

  const projected = projectCoordinates(coordinates);
  const keptIndexes = new Set<number>([0, coordinates.length - 1]);

  simplifySection(projected, 0, projected.length - 1, toleranceMeters, keptIndexes);

  return coordinates.filter((_, index) => keptIndexes.has(index));
}

/** 表示範囲とその周辺に関係する座標だけを残し、Polyline描画負荷を抑える。 */
export function filterRouteCoordinatesByRegion(
  coordinates: RouteCoordinate[],
  region: Region | null,
  paddingRatio = 0.2,
): RouteCoordinate[] {
  if (!region) {
    return coordinates;
  }

  const latitudePadding = region.latitudeDelta * paddingRatio;
  const longitudePadding = region.longitudeDelta * paddingRatio;
  const minLatitude = region.latitude - region.latitudeDelta / 2 - latitudePadding;
  const maxLatitude = region.latitude + region.latitudeDelta / 2 + latitudePadding;
  const minLongitude = region.longitude - region.longitudeDelta / 2 - longitudePadding;
  const maxLongitude = region.longitude + region.longitudeDelta / 2 + longitudePadding;

  return coordinates.filter((coordinate, index) => {
    const previous = coordinates[index - 1];
    const next = coordinates[index + 1];

    return [previous, coordinate, next].some(
      (candidate) =>
        candidate != null &&
        candidate.latitude >= minLatitude &&
        candidate.latitude <= maxLatitude &&
        candidate.longitude >= minLongitude &&
        candidate.longitude <= maxLongitude,
    );
  });
}

/** GPSポイント群が収まる初期表示範囲を作る。 */
export function createInitialRegion(points: LocationPoint[]): Region {
  if (points.length === 0) {
    return DEFAULT_REGION;
  }

  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const latitudeDelta = Math.max((maxLatitude - minLatitude) * 1.4, 0.01);
  const longitudeDelta = Math.max((maxLongitude - minLongitude) * 1.4, 0.01);

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta,
    longitudeDelta,
  };
}

/** 緯度経度を距離誤差計算しやすいメートル近似の平面座標へ投影する。 */
function projectCoordinates(coordinates: RouteCoordinate[]): ProjectedPoint[] {
  const averageLatitude = coordinates.reduce((total, coordinate) => total + coordinate.latitude, 0) / coordinates.length;
  const metersPerLatitudeDegree = 111_320;
  const metersPerLongitudeDegree = Math.max(Math.cos((averageLatitude * Math.PI) / 180) * metersPerLatitudeDegree, 1);

  return coordinates.map((coordinate) => ({
    ...coordinate,
    x: coordinate.longitude * metersPerLongitudeDegree,
    y: coordinate.latitude * metersPerLatitudeDegree,
  }));
}

/** Douglas-Peucker法の再帰処理で残すべき点のindexを集める。 */
function simplifySection(
  points: ProjectedPoint[],
  startIndex: number,
  endIndex: number,
  toleranceMeters: number,
  keptIndexes: Set<number>,
): void {
  if (endIndex <= startIndex + 1) {
    return;
  }

  let maxDistance = 0;
  let maxIndex = startIndex;

  for (let index = startIndex + 1; index < endIndex; index += 1) {
    const distance = distanceToSegment(points[index], points[startIndex], points[endIndex]);

    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = index;
    }
  }

  if (maxDistance <= toleranceMeters) {
    return;
  }

  keptIndexes.add(maxIndex);
  simplifySection(points, startIndex, maxIndex, toleranceMeters, keptIndexes);
  simplifySection(points, maxIndex, endIndex, toleranceMeters, keptIndexes);
}

/** 点から線分までの最短距離をメートル近似座標上で求める。 */
function distanceToSegment(point: ProjectedPoint, start: ProjectedPoint, end: ProjectedPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  const projectedX = start.x + t * dx;
  const projectedY = start.y + t * dy;

  return Math.hypot(point.x - projectedX, point.y - projectedY);
}
