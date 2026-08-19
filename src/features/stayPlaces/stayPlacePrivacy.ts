import type { RouteCoordinate } from '@/features/map/routeMapper';
import { isStayPlacePrivacyRadiusMeters, type StayPlace } from '@/features/stayPlaces/stayPlaceTypes';

/**
 * Formats a stay place's privacy radius for display.
 *
 * @param privacyRadiusMeters - The privacy radius in meters, or `null` to include the location.
 * @returns The radius in kilometers or meters, or `含める` when the radius is `null`.
 */
export function formatStayPlacePrivacyRadius(privacyRadiusMeters: number | null): string {
  if (privacyRadiusMeters === null) {
    return '含める';
  }

  return privacyRadiusMeters >= 1000 ? `${privacyRadiusMeters / 1000}km` : `${privacyRadiusMeters}m`;
}

/**
 * Validates privacy settings for all stay places before sharing.
 *
 * @param stayPlaces - The stay places whose privacy settings are validated
 * @returns `true` if every configured privacy radius and its coordinates are valid, `false` otherwise.
 */
export function hasValidStayPlacePrivacyConfiguration(stayPlaces: StayPlace[]): boolean {
  return stayPlaces.every((stayPlace) => {
    if (stayPlace.privacyRadiusMeters === null) {
      return true;
    }

    return isStayPlacePrivacyRadiusMeters(stayPlace.privacyRadiusMeters) && isValidCoordinate(stayPlace);
  });
}

/**
 * Validates that a coordinate is geographically valid.
 *
 * @param coordinate - The latitude and longitude to validate
 * @returns `true` if both values are finite and within their valid geographic ranges, `false` otherwise.
 */
function isValidCoordinate(coordinate: RouteCoordinate): boolean {
  return (
    Number.isFinite(coordinate.latitude) &&
    Number.isFinite(coordinate.longitude) &&
    coordinate.latitude >= -90 &&
    coordinate.latitude <= 90 &&
    coordinate.longitude >= -180 &&
    coordinate.longitude <= 180
  );
}
