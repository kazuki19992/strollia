import { NewLocationPoint } from '@/types/gps';
import { CoordinateLike, distanceMeters } from '@/utils/distance';
import { LOCATION_MAX_ACCURACY_METERS, LOCATION_MIN_SAVE_DISTANCE_METERS } from './locationTrackingConfig';
import { classifyMovementSpeed } from './locationSpeed';

/** GPSポイント保存判定の閾値をテストや将来設定から差し替えるためのオプション。 */
export type SaveFilterOptions = {
  /** 初回地点や低速時に許容する標準精度。 */
  maxAccuracyMeters?: number;
  /** 低速時に保存対象とする最小移動距離。 */
  minDistanceMeters?: number;
  /** どの速度帯でも破棄する水平方向精度の上限。 */
  absoluteMaxAccuracyMeters?: number;
};

type TimedCoordinateLike = CoordinateLike & {
  recordedAt?: string;
};

/** 端末側のspeedがこれ未満なら停止中の観測として扱う。単位はm/s。 */
const RAW_STATIONARY_SPEED_MAX_MPS = 0.5;
/** 停止中のGPSドリフトとして保存しない距離。 */
const STATIONARY_DRIFT_DISTANCE_METERS = 20;
/** 車両速度帯で保存対象とする最小移動距離。 */
const VEHICLE_MIN_DISTANCE_METERS = 15;
/** 高速速度帯で保存対象とする最小移動距離。 */
const FAST_MIN_DISTANCE_METERS = 30;
/** どの速度帯でも保存しない精度の上限。 */
const DEFAULT_ABSOLUTE_MAX_ACCURACY_METERS = 80;

/**
 * 取得したGPSポイントをSQLiteのPolyline/ODO用ログへ保存すべきか判定する。
 *
 * メイン地図はVisited GridでGPSジャンプの見た目影響が小さいため、ここでは
 * provisional確定待ちは行わず、精度と距離の軽量判定で実移動の取りこぼしを抑える。
 *
 * @param point - 新しく取得したGPSポイント。
 * @param previousPoint - 直前に保存済みのGPSポイント。初回はnull。
 * @param options - テストや将来設定で差し替える閾値。
 * @returns 保存対象ならtrue。
 */
export function shouldSaveLocationPoint(
  point: NewLocationPoint,
  previousPoint: TimedCoordinateLike | null,
  options: SaveFilterOptions = {},
): boolean {
  const maxAccuracyMeters = options.maxAccuracyMeters ?? LOCATION_MAX_ACCURACY_METERS;
  const minDistanceMeters = options.minDistanceMeters ?? LOCATION_MIN_SAVE_DISTANCE_METERS;
  const absoluteMaxAccuracyMeters = options.absoluteMaxAccuracyMeters ?? DEFAULT_ABSOLUTE_MAX_ACCURACY_METERS;
  const accuracy = point.accuracy ?? absoluteMaxAccuracyMeters;

  if (accuracy > absoluteMaxAccuracyMeters) {
    return false;
  }

  if (!previousPoint) {
    return accuracy <= maxAccuracyMeters;
  }

  const distance = distanceMeters(previousPoint, point);

  if (distance < minDistanceMeters) {
    return false;
  }

  if (isRawStationaryDrift(point, distance)) {
    return false;
  }

  const speedKmh = estimateSaveSegmentSpeedMps(point, previousPoint, distance) * 3.6;

  switch (classifyMovementSpeed(speedKmh)) {
    case 'low-speed':
      return accuracy <= maxAccuracyMeters && distance >= Math.max(minDistanceMeters, Math.min(accuracy * 0.5, 15));
    case 'vehicle':
      return distance >= VEHICLE_MIN_DISTANCE_METERS && distance >= Math.min(accuracy * 0.25, 25);
    case 'fast':
      return distance >= FAST_MIN_DISTANCE_METERS;
  }
}

/**
 * 保存判定用の区間速度を点間距離と時刻差から計算する。
 *
 * 候補点のraw speedは停止ドリフト判定の補助だけに使い、速度帯分類では
 * GPSジャンプで混ざりやすい単点speedに依存しない。
 *
 * @param point - 新しく取得したGPSポイント。
 * @param previousPoint - 直前に保存済みのGPSポイント。
 * @param distance - 2点間距離。未指定時は関数内で計算する。
 * @returns 推定速度。計算できない場合は0。
 */
export function estimateSaveSegmentSpeedMps(
  point: NewLocationPoint,
  previousPoint: TimedCoordinateLike,
  distance = distanceMeters(previousPoint, point),
): number {
  if (!previousPoint.recordedAt) {
    return 0;
  }

  const elapsedSeconds = (Date.parse(point.recordedAt) - Date.parse(previousPoint.recordedAt)) / 1000;

  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) {
    return 0;
  }

  return distance / elapsedSeconds;
}

function isRawStationaryDrift(point: NewLocationPoint, distance: number): boolean {
  return (
    point.speed != null && point.speed >= 0 && point.speed < RAW_STATIONARY_SPEED_MAX_MPS && distance < STATIONARY_DRIFT_DISTANCE_METERS
  );
}
