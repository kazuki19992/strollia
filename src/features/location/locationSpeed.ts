import { LocationPoint, NewLocationPoint } from '../../types/gps';
import { distanceMeters } from '../../utils/distance';

/** 保存品質判定と速度メーターで共有する速度帯。 */
export type MovementSpeedBand = 'low-speed' | 'vehicle' | 'fast';

/** 車両移動へ切り替える境界速度。 */
export const VEHICLE_SPEED_MIN_KMH = 30;
/** 高速移動へ切り替える境界速度。 */
export const FAST_SPEED_MIN_KMH = 150;

/** accepted点間の速度算出に必要な位置と記録時刻。 */
type TimedCoordinate = Pick<LocationPoint | NewLocationPoint, 'latitude' | 'longitude' | 'recordedAt'>;

/**
 * km/h単位の速度を低速・車両・高速へ分類する。
 *
 * @param speedKmh - km/h単位の速度。
 * @returns 保存品質判定と速度メーターで共有する速度帯。
 */
export function classifyMovementSpeed(speedKmh: number): MovementSpeedBand {
  if (speedKmh >= FAST_SPEED_MIN_KMH) {
    return 'fast';
  }

  if (speedKmh >= VEHICLE_SPEED_MIN_KMH) {
    return 'vehicle';
  }

  return 'low-speed';
}

/**
 * accepted点同士の距離と時刻差から区間速度を返す。
 *
 * @param previous - 区間始点。
 * @param next - 区間終点。
 * @returns m/s単位の区間速度。時刻差が不正な場合は0。
 */
export function estimateAcceptedSegmentSpeedMps(previous: TimedCoordinate, next: TimedCoordinate): number {
  const elapsedSeconds = (Date.parse(next.recordedAt) - Date.parse(previous.recordedAt)) / 1000;

  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) {
    return 0;
  }

  return distanceMeters(previous, next) / elapsedSeconds;
}
