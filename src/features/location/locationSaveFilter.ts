import { NewLocationPoint } from '../../types/gps';
import { CoordinateLike, distanceMeters } from '../../utils/distance';
import { LOCATION_MAX_ACCURACY_METERS, LOCATION_MIN_SAVE_DISTANCE_METERS } from './locationTrackingConfig';

/** GPSポイント保存判定の閾値をテストや将来設定から差し替えるためのオプション。 */
type SaveFilterOptions = {
  maxAccuracyMeters?: number;
  minDistanceMeters?: number;
};

/**
 * 取得したGPSポイントをSQLiteへ保存すべきか判定する。
 *
 * 精度の悪い点と、前回保存点からほとんど移動していない点を落とし、
 * 全履歴表示とDB容量の両方を軽く保つ。
 */
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
