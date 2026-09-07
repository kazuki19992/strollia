import { toEffectiveLocationPoint } from '@/features/location/effectiveLocationPoint';
import type { LocationPoint, NewLocationPoint } from '@/types/gps';
import { distanceMeters } from '@/utils/distance';

/**
 * 1点を時系列へ挿入したときに日別距離へ加算する差分を返す。
 *
 * 途中挿入では既存の前後区間を新しい2区間で置き換えるため、置換される距離を差し引く。
 */
export function calculateInsertedPointDistanceDeltaMeters(
  previousPoint: LocationPoint | null,
  point: NewLocationPoint,
  nextPoint: LocationPoint | null,
): number {
  const effectivePoint = toEffectiveLocationPoint(point);
  const previousDistance = previousPoint ? distanceMeters(toEffectiveLocationPoint(previousPoint), effectivePoint) : 0;
  const nextDistance = nextPoint ? distanceMeters(effectivePoint, toEffectiveLocationPoint(nextPoint)) : 0;
  const replacedDistance =
    previousPoint && nextPoint ? distanceMeters(toEffectiveLocationPoint(previousPoint), toEffectiveLocationPoint(nextPoint)) : 0;

  return Math.max(0, previousDistance + nextDistance - replacedDistance);
}
