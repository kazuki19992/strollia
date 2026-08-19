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
 * Creates route segments for sharing while excluding points and lines hidden by active stay-place privacy radii.
 *
 * Existing route segmentation is preserved, and segments with fewer than two visible coordinates are omitted.
 * No route segments are produced when an active stay-place privacy configuration is invalid.
 *
 * @param points - The stored location points used to build the route
 * @param activeStayPlaces - The active stay places whose privacy radii hide nearby route content
 * @returns The visible route segments
 */
export function toPrivacyRouteSegments(points: LocationPoint[], activeStayPlaces: StayPlace[]): RouteSegment[] {
  if (hasInvalidPrivacyStayPlace(activeStayPlaces)) {
    return [];
  }

  return toRoutePointSegments(points)
    .flatMap((routeSegment, routeSegmentIndex) => splitVisiblePoints(routeSegment, activeStayPlaces, routeSegmentIndex))
    .filter((segment) => segment.coordinates.length > 1);
}

/**
 * Builds drawable visible route segments while excluding invalid points and privacy-radius crossings.
 *
 * @param activeStayPlaces - Active stay places whose privacy radii hide points and route segments
 * @param routeSegmentIndex - Index used to identify the generated segments
 * @returns Visible route segments containing at least two coordinates
 */
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

/**
 * Converts a stored location point into a route coordinate.
 *
 * @param point - The stored location point to convert
 * @returns A route coordinate containing the point's latitude and longitude
 */
function toCoordinate(point: LocationPoint): RouteCoordinate {
  return { latitude: point.latitude, longitude: point.longitude };
}

/**
 * Determines whether any active stay place has invalid privacy configuration.
 *
 * @param activeStayPlaces - The active stay places to validate
 * @returns `true` if the privacy configuration is invalid, `false` otherwise
 */
function hasInvalidPrivacyStayPlace(activeStayPlaces: StayPlace[]): boolean {
  return !hasValidStayPlacePrivacyConfiguration(activeStayPlaces);
}

/**
 * Determines whether a coordinate falls within an active stay place's privacy radius.
 *
 * @param activeStayPlaces - The stay places whose privacy settings are active
 * @returns `true` if the coordinate is within a configured privacy radius, `false` otherwise
 */
function isHiddenByPrivacyRadius(coordinate: RouteCoordinate, activeStayPlaces: StayPlace[]): boolean {
  return activeStayPlaces.some(
    (stayPlace) =>
      stayPlace.privacyRadiusMeters != null &&
      distanceMeters(coordinate, stayPlace) <= stayPlace.privacyRadiusMeters + PRIVACY_RADIUS_EPSILON_METERS,
  );
}

/**
 * Determines whether any consecutive route coordinates intersect a configured privacy radius.
 *
 * @param coordinates - The route coordinates to evaluate
 * @param activeStayPlaces - The stay places with privacy settings to check
 * @returns `true` if any route segment intersects or touches a privacy radius, `false` otherwise
 */
function routeCrossesPrivacyRadius(coordinates: RouteCoordinate[], activeStayPlaces: StayPlace[]): boolean {
  return coordinates.some((coordinate, index) => {
    const previous = coordinates[index - 1];
    return previous != null && activeStayPlaces.some((stayPlace) => intersectsPrivacyRadius(previous, coordinate, stayPlace));
  });
}

/**
 * Determines whether a route segment intersects or touches a stay place's privacy radius.
 *
 * @param start - The segment's starting coordinate
 * @param end - The segment's ending coordinate
 * @param stayPlace - The stay place whose privacy center and radius are evaluated
 * @returns `true` if the segment intersects or touches the configured privacy radius, `false` if no radius is configured or the segment remains outside it
 */
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
