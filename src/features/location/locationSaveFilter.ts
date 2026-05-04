import { NewLocationPoint } from '../../types/gps';
import { CoordinateLike, distanceMeters } from '../../utils/distance';
import { LOCATION_MAX_ACCURACY_METERS, LOCATION_MIN_SAVE_DISTANCE_METERS } from './locationTrackingConfig';

type SaveFilterOptions = {
  maxAccuracyMeters?: number;
  minDistanceMeters?: number;
};

export function shouldSaveLocationPoint(
  point: NewLocationPoint,
  previousPoint: CoordinateLike | null,
  options: SaveFilterOptions = {},
): boolean {
  const maxAccuracyMeters = options.maxAccuracyMeters ?? LOCATION_MAX_ACCURACY_METERS;
  const minDistanceMeters = options.minDistanceMeters ?? LOCATION_MIN_SAVE_DISTANCE_METERS;

  if (point.accuracy != null && point.accuracy > maxAccuracyMeters) {
    return false;
  }

  if (!previousPoint) {
    return true;
  }

  return distanceMeters(previousPoint, point) >= minDistanceMeters;
}
