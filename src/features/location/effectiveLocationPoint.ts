/** 有効座標のフォールバックに必要な最小のポイント形状。 */
type EffectiveCoordinatePoint = {
  latitude: number;
  longitude: number;
  effectiveLatitude?: number | null;
  effectiveLongitude?: number | null;
};

/**
 * Applies stored effective coordinates to a location point when both coordinates are valid.
 *
 * @param point - The location point to convert.
 * @returns A point with valid effective coordinates applied, or the original point when either effective coordinate is unavailable or outside its valid geographic range.
 */
export function toEffectiveLocationPoint<T extends EffectiveCoordinatePoint>(point: T): T {
  const { effectiveLatitude, effectiveLongitude } = point;

  if (!isValidLatitude(effectiveLatitude) || !isValidLongitude(effectiveLongitude)) {
    return point;
  }

  return { ...point, latitude: effectiveLatitude, longitude: effectiveLongitude };
}

/**
 * Validates a latitude value.
 *
 * @param value - The value to validate as a latitude
 * @returns `true` if the value is finite and between -90 and 90 degrees, `false` otherwise
 */
function isValidLatitude(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90;
}

/**
 * Determines whether a value is a valid geographic longitude.
 *
 * @param value - The value to validate.
 * @returns `true` if the value is finite and within -180 to 180 degrees, `false` otherwise.
 */
function isValidLongitude(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180;
}
