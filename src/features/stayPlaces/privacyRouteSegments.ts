import {
  DEFAULT_ROUTE_SIMPLIFY_TOLERANCE_METERS,
  isValidRouteCoordinate,
  simplifyRouteCoordinates,
  toRoutePointSegments,
  type RouteCoordinate,
  type RouteSegment,
} from '@/features/map/routeMapper';
import { isStayPlacePrivacyRadiusMeters, type StayPlace } from '@/features/stayPlaces/stayPlaceTypes';
import type { LocationPoint } from '@/types/gps';
import { distanceMeters } from '@/utils/distance';

/** 浮動小数点誤差で半径境界上の点を露出させないための距離許容値。 */
const PRIVACY_RADIUS_EPSILON_METERS = 0.000001;

/**
 * 有効な滞在場所の非表示半径を適用した共有専用の描画区間を作る。
 *
 * 異常な時間差・速度差での既存分割を先に維持し、非表示範囲に入った点ごとにさらに
 * 区間を閉じる。可視点を再結合しないため、非表示範囲をまたぐPolylineは生成しない。
 * 非表示設定の座標・半径が壊れている場合は安全側へ倒してルートを出力しない。
 */
export function toPrivacyRouteSegments(points: LocationPoint[], activeStayPlaces: StayPlace[]): RouteSegment[] {
  if (hasInvalidPrivacyStayPlace(activeStayPlaces)) {
    return [];
  }

  return toRoutePointSegments(points)
    .flatMap((routeSegment, routeSegmentIndex) => splitVisiblePoints(routeSegment, activeStayPlaces, routeSegmentIndex))
    .filter((segment) => segment.coordinates.length > 1);
}

/** 非表示半径内または不正座標で閉じた、描画可能な可視点区間を作る。 */
function splitVisiblePoints(points: LocationPoint[], activeStayPlaces: StayPlace[], routeSegmentIndex: number): RouteSegment[] {
  const segments: RouteSegment[] = [];
  let visiblePoints: RouteCoordinate[] = [];

  const closeSegment = () => {
    if (visiblePoints.length > 1) {
      segments.push({
        id: `${points[0]?.recordedAt ?? 'route'}-${routeSegmentIndex}-${segments.length}`,
        coordinates: simplifyRouteCoordinates(visiblePoints, DEFAULT_ROUTE_SIMPLIFY_TOLERANCE_METERS),
      });
    }
    visiblePoints = [];
  };

  for (const point of points) {
    const coordinate = toCoordinate(point);
    if (!isValidRouteCoordinate(coordinate) || isHiddenByPrivacyRadius(coordinate, activeStayPlaces)) {
      closeSegment();
      continue;
    }

    visiblePoints.push(coordinate);
  }

  closeSegment();
  return segments;
}

/** 有効座標へ変換済みの保存ポイントからPolyline用の座標を作る。 */
function toCoordinate(point: LocationPoint): RouteCoordinate {
  return { latitude: point.latitude, longitude: point.longitude };
}

/** 1件でも有効な非表示設定が壊れていれば、位置情報を公開しない。 */
function hasInvalidPrivacyStayPlace(activeStayPlaces: StayPlace[]): boolean {
  return activeStayPlaces.some((stayPlace) => {
    if (stayPlace.privacyRadiusMeters == null) {
      return false;
    }

    return !isStayPlacePrivacyRadiusMeters(stayPlace.privacyRadiusMeters) || !isValidRouteCoordinate(stayPlace);
  });
}

/** 有効な非表示半径を持つ滞在場所のいずれかに、座標が含まれるか判定する。 */
function isHiddenByPrivacyRadius(coordinate: RouteCoordinate, activeStayPlaces: StayPlace[]): boolean {
  return activeStayPlaces.some(
    (stayPlace) =>
      stayPlace.privacyRadiusMeters != null &&
      distanceMeters(coordinate, stayPlace) <= stayPlace.privacyRadiusMeters + PRIVACY_RADIUS_EPSILON_METERS,
  );
}
