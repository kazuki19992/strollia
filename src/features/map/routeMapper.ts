import type { Region } from 'react-native-maps';

import { LocationPoint } from '@/types/gps';
import { toEffectiveLocationPoint } from '@/features/location/effectiveLocationPoint';
import { estimateAcceptedSegmentSpeedMps } from '@/features/location/locationSpeed';

/** react-native-mapsのPolylineへ渡す緯度経度座標。 */
export type RouteCoordinate = {
  latitude: number;
  longitude: number;
};

/** Polylineを途切れ区間ごとに描くためのルート区間。 */
export type RouteSegment = {
  /** React描画で使う安定ID。 */
  id: string;
  /** 同じPolylineで結ぶ緯度経度座標。 */
  coordinates: RouteCoordinate[];
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

/**
 * 表示範囲デルタの有効上限。
 *
 * MapKitは緯度デルタ180度・経度デルタ360度を超えるRegionを NSInvalidArgumentException にする。
 * 個々の座標は有効範囲内(緯度-90〜90/経度-180〜180)なので外接ボックスの生スパンは最大でも
 * 180度/360度に収まるが、これに1.4倍の表示マージンを掛けると上限を超えうる
 * (例: 経度スパン269度 → 269×1.4=376.6度)。そのため上限をわずかに下回る値でクランプしてクラッシュを防ぐ。
 */
const MAX_LATITUDE_DELTA = 179;
const MAX_LONGITUDE_DELTA = 359;

/** 徒歩ログの形状を保ちつつ描画点を減らすデフォルト許容誤差。 */
export const DEFAULT_ROUTE_SIMPLIFY_TOLERANCE_METERS = 10;
/** この区間速度を超える点間は誤線防止のため同一Polylineで結ばない。 */
const ROUTE_SEGMENT_MAX_SPEED_MPS = 70;
/** 長時間途切れた点間は同一Polylineで結ばない。 */
const ROUTE_SEGMENT_MAX_GAP_MS = 10 * 60 * 1000;

/**
 * MapKitへ渡せる緯度経度か判定する。
 *
 * @param coordinate - 検証する緯度経度。
 * @returns 有限値かつ地理座標の範囲内ならtrue。
 */
export function isValidRouteCoordinate(coordinate: RouteCoordinate): boolean {
  return (
    Number.isFinite(coordinate.latitude) &&
    Number.isFinite(coordinate.longitude) &&
    coordinate.latitude >= -90 &&
    coordinate.latitude <= 90 &&
    coordinate.longitude >= -180 &&
    coordinate.longitude <= 180
  );
}

/**
 * Converts saved GPS points into valid latitude and longitude coordinates for map rendering.
 *
 * @param points - The saved GPS points to convert
 * @returns The valid route coordinates extracted from the points
 */
export function toRouteCoordinates(points: LocationPoint[]): RouteCoordinate[] {
  return points
    .map(toEffectiveLocationPoint)
    .map((point) => ({ latitude: point.latitude, longitude: point.longitude }))
    .filter(isValidRouteCoordinate);
}

/** 保存用ポイントから簡略化済みの描画用座標を生成する。 */
export function toRenderRouteCoordinates(
  points: LocationPoint[],
  toleranceMeters = DEFAULT_ROUTE_SIMPLIFY_TOLERANCE_METERS,
): RouteCoordinate[] {
  return simplifyRouteCoordinates(toRouteCoordinates(points), toleranceMeters);
}

/**
 * Creates simplified renderable route segments from stored GPS points, splitting anomalous sections.
 *
 * @param points - Stored GPS points.
 * @param toleranceMeters - Maximum simplification error in meters.
 * @returns Route segments containing at least two coordinates each.
 */
export function toRenderRouteSegments(points: LocationPoint[], toleranceMeters = DEFAULT_ROUTE_SIMPLIFY_TOLERANCE_METERS): RouteSegment[] {
  return toRoutePointSegments(points)
    .map((segment, index) => ({
      id: `${segment[0].recordedAt}-${index}`,
      coordinates: simplifyRouteCoordinates(toRouteCoordinates(segment), toleranceMeters),
    }))
    .filter((segment) => segment.coordinates.length > 1);
}

/**
 * Converts stored GPS points to effective locations and divides them into route segments at anomalous time gaps or speeds.
 *
 * @returns The normalized route point segments.
 */
export function toRoutePointSegments(points: LocationPoint[]): LocationPoint[][] {
  return splitRoutePoints(points.map(toEffectiveLocationPoint));
}

/**
 * Reduces the number of route coordinates while preserving the route shape.
 *
 * @param coordinates - The route coordinates to simplify
 * @param toleranceMeters - The maximum deviation in meters for removing intermediate coordinates
 * @returns The simplified route coordinates
 */
export function simplifyRouteCoordinates(
  coordinates: RouteCoordinate[],
  toleranceMeters = DEFAULT_ROUTE_SIMPLIFY_TOLERANCE_METERS,
): RouteCoordinate[] {
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

/**
 * 表示範囲とその周辺に関係するルート区間だけを残す。
 *
 * @param segments - 分割済みルート区間。
 * @param region - 現在の表示範囲。
 * @returns 表示範囲に関係する2点以上のルート区間。
 */
export function filterRouteSegmentsByRegion(segments: RouteSegment[], region: Region | null): RouteSegment[] {
  return segments
    .map((segment) => ({ ...segment, coordinates: filterRouteCoordinatesByRegion(segment.coordinates, region) }))
    .filter((segment) => segment.coordinates.length > 1);
}

/** 座標群の外接境界(緯度経度の最小・最大値)。 */
export type RouteCoordinateBounds = {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
};

/**
 * 座標の外接境界からマージン付きの初期表示範囲を作る。
 *
 * @param bounds - 座標群の外接境界。有効な座標が1件もない場合はnull。
 * @returns 境界がnullなら既定の初期表示位置、それ以外はマージン1.4倍・最小デルタ0.01の表示範囲。
 */
export function createRegionFromBounds(bounds: RouteCoordinateBounds | null): Region {
  if (!bounds) {
    return DEFAULT_REGION;
  }

  const { minLatitude, maxLatitude, minLongitude, maxLongitude } = bounds;
  // 生スパンは有効上限内でも、1.4倍の表示マージンを掛けた表示デルタがMapKitの上限を超えうる。
  // Invalid Region例外を避けるため、マージン適用後のデルタを有効上限未満へクランプする。
  const latitudeDelta = Math.min(Math.max((maxLatitude - minLatitude) * 1.4, 0.01), MAX_LATITUDE_DELTA);
  const longitudeDelta = Math.min(Math.max((maxLongitude - minLongitude) * 1.4, 0.01), MAX_LONGITUDE_DELTA);

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta,
    longitudeDelta,
  };
}

/**
 * Creates the initial map region containing the provided GPS points.
 *
 * @param points - GPS points used to determine the map bounds
 * @returns A padded region containing the valid point coordinates, or the default region when no valid coordinates are available
 */
export function createInitialRegion(points: LocationPoint[]): Region {
  return createInitialRegionFromCoordinates(toRouteCoordinates(points));
}

/**
 * Creates an initial map region that encompasses the supplied route coordinates with padding.
 *
 * Invalid coordinates are ignored. If no valid coordinates remain, the default region is returned.
 *
 * @param coordinates - Route coordinates used to determine the region bounds
 * @returns A padded map region enclosing the valid coordinates, or the default region when none are valid
 */
export function createInitialRegionFromCoordinates(coordinates: RouteCoordinate[]): Region {
  const validCoordinates = coordinates.filter(isValidRouteCoordinate);

  if (validCoordinates.length === 0) {
    return DEFAULT_REGION;
  }

  let minLatitude = validCoordinates[0].latitude;
  let maxLatitude = validCoordinates[0].latitude;
  let minLongitude = validCoordinates[0].longitude;
  let maxLongitude = validCoordinates[0].longitude;

  for (const coordinate of validCoordinates) {
    if (coordinate.latitude < minLatitude) minLatitude = coordinate.latitude;
    if (coordinate.latitude > maxLatitude) maxLatitude = coordinate.latitude;
    if (coordinate.longitude < minLongitude) minLongitude = coordinate.longitude;
    if (coordinate.longitude > maxLongitude) maxLongitude = coordinate.longitude;
  }

  return createRegionFromBounds({ minLatitude, maxLatitude, minLongitude, maxLongitude });
}

/** GPSポイントを異常な時間差・速度差の境界で分割する。 */
function splitRoutePoints(points: LocationPoint[]): LocationPoint[][] {
  return points.reduce<LocationPoint[][]>((segments, point) => {
    const currentSegment = segments.at(-1);
    const previous = currentSegment?.at(-1);
    const timeGapMs = previous ? Date.parse(point.recordedAt) - Date.parse(previous.recordedAt) : 0;
    const isAbnormal =
      previous != null &&
      (timeGapMs > ROUTE_SEGMENT_MAX_GAP_MS || estimateAcceptedSegmentSpeedMps(previous, point) > ROUTE_SEGMENT_MAX_SPEED_MPS);

    if (!currentSegment || isAbnormal) {
      segments.push([point]);
    } else {
      currentSegment.push(point);
    }

    return segments;
  }, []);
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
