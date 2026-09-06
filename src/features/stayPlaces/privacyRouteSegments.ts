import {
  DEFAULT_ROUTE_SIMPLIFY_TOLERANCE_METERS,
  isValidRouteCoordinate,
  simplifyRouteCoordinates,
  toRoutePointSegments,
  type RouteCoordinate,
  type RouteSegment,
} from '@/features/map/routeMapper';
import { hasValidStayPlacePrivacyConfiguration } from '@/features/stayPlaces/stayPlacePrivacy';
import type { StayPlace } from '@/features/stayPlaces/stayPlaceTypes';
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
      const simplified = simplifyRouteCoordinates(visiblePoints, DEFAULT_ROUTE_SIMPLIFY_TOLERANCE_METERS);
      segments.push({
        id: `${points[0]?.recordedAt ?? 'route'}-${routeSegmentIndex}-${segments.length}`,
        // Douglas-Peuckerが中間点を落とすと、元は半径を避けた折れ線が非表示範囲を
        // 横切る直線へ変わることがある。再検証し、危険なら安全な元の折れ線を使う。
        coordinates: routeCrossesPrivacyRadius(simplified, activeStayPlaces) ? visiblePoints : simplified,
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

    if (visiblePoints.length > 0 && routeCrossesPrivacyRadius([visiblePoints.at(-1)!, coordinate], activeStayPlaces)) {
      // 両端が範囲外でも直線が円を横切るなら、その線分は描かない。前後の可視部分は
      // 別Polylineとして残し、半径内をまたいでつなげない。
      closeSegment();
      visiblePoints = [coordinate];
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
  return !hasValidStayPlacePrivacyConfiguration(activeStayPlaces);
}

/** 有効な非表示半径を持つ滞在場所のいずれかに、座標が含まれるか判定する。 */
function isHiddenByPrivacyRadius(coordinate: RouteCoordinate, activeStayPlaces: StayPlace[]): boolean {
  return activeStayPlaces.some(
    (stayPlace) =>
      stayPlace.privacyRadiusMeters != null &&
      distanceMeters(coordinate, stayPlace) <= stayPlace.privacyRadiusMeters + PRIVACY_RADIUS_EPSILON_METERS,
  );
}

/**
 * 座標列のいずれかの線分が、非表示半径の円と交差するか判定する。
 *
 * 半径が最大10kmであるため、各滞在場所の緯度を基準とした局所正距円筒投影で
 * 線分と円の最短距離を計算する。端点が範囲外でも線分が通過するケースを防ぐ。
 */
function routeCrossesPrivacyRadius(coordinates: RouteCoordinate[], activeStayPlaces: StayPlace[]): boolean {
  return coordinates.some((coordinate, index) => {
    const previous = coordinates[index - 1];
    return previous != null && activeStayPlaces.some((stayPlace) => intersectsPrivacyRadius(previous, coordinate, stayPlace));
  });
}

/** 非表示半径を持つ1箇所の円と線分が交差・接触するか判定する。 */
function intersectsPrivacyRadius(start: RouteCoordinate, end: RouteCoordinate, stayPlace: StayPlace): boolean {
  if (stayPlace.privacyRadiusMeters == null) {
    return false;
  }

  const metersPerLatitudeDegree = 111_320;
  const metersPerLongitudeDegree = Math.max(Math.cos((stayPlace.latitude * Math.PI) / 180) * metersPerLatitudeDegree, 1);
  const startX = (start.longitude - stayPlace.longitude) * metersPerLongitudeDegree;
  const startY = (start.latitude - stayPlace.latitude) * metersPerLatitudeDegree;
  const endX = (end.longitude - stayPlace.longitude) * metersPerLongitudeDegree;
  const endY = (end.latitude - stayPlace.latitude) * metersPerLatitudeDegree;
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const squaredLength = deltaX * deltaX + deltaY * deltaY;
  const projection = squaredLength === 0 ? 0 : Math.max(0, Math.min(1, -(startX * deltaX + startY * deltaY) / squaredLength));
  const nearestX = startX + deltaX * projection;
  const nearestY = startY + deltaY * projection;

  return Math.hypot(nearestX, nearestY) <= stayPlace.privacyRadiusMeters + PRIVACY_RADIUS_EPSILON_METERS;
}
