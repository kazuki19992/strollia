import { NewLocationPoint } from '../../types/gps';
import { CoordinateLike, distanceMeters } from '../../utils/distance';
import { LOCATION_MAX_ACCURACY_METERS, LOCATION_MIN_SAVE_DISTANCE_METERS } from './locationTrackingConfig';

/** GPS保存判定で使う移動モード。 */
export type MovementMode = 'stationary' | 'walk' | 'vehicle' | 'fast';

/** GPSポイント保存判定の閾値をテストや将来設定から差し替えるためのオプション。 */
export type SaveFilterOptions = {
  /** 初回地点や徒歩時に許容する標準精度。 */
  maxAccuracyMeters?: number;
  /** 徒歩時に保存対象とする最小移動距離。 */
  minDistanceMeters?: number;
  /** どの移動モードでも破棄する水平方向精度の上限。 */
  absoluteMaxAccuracyMeters?: number;
};

/**
 * 取得時刻を持つ場合がある保存判定用座標。
 *
 * `TimedCoordinateLike` は `CoordinateLike` に取得時刻を添えるが、
 * 上流データや既存レコードには時刻がない場合もあるため `recordedAt` は任意にする。
 */
type TimedCoordinateLike = CoordinateLike & {
  recordedAt?: string;
};

/** 停止中とみなす速度。GPS揺れを落とすため低めにする。 */
const STATIONARY_MAX_SPEED_MPS = 0.5;
/** 徒歩として扱う上限速度。早歩き程度までを含める。 */
const WALK_MAX_SPEED_MPS = 2.2;
/** 自転車・車・低速電車として扱う上限速度。 */
const VEHICLE_MAX_SPEED_MPS = 15;
/** どの移動モードでも保存しない精度の上限。 */
const DEFAULT_ABSOLUTE_MAX_ACCURACY_METERS = 80;
/** 停止中に保存対象とする最小移動距離。 */
const STATIONARY_MIN_DISTANCE_METERS = 20;
/** 車両移動で保存対象とする最小移動距離。 */
const VEHICLE_MIN_DISTANCE_METERS = 15;
/** 高速移動で保存対象とする最小移動距離。 */
const FAST_MIN_DISTANCE_METERS = 30;

/**
 * 取得したGPSポイントをSQLiteへ保存すべきか判定する。
 *
 * 精度の悪い点と、移動モードに対して小さすぎる移動を落とし、
 * 全履歴表示とDB容量の両方を軽く保つ。
 *
 * @param point - 新しく取得したGPSポイント。
 * @param previousPoint - 直前に保存済みのGPSポイント。初回はnull。
 * @param options - テストや将来設定で差し替える閾値。
 * @returns 保存対象ならtrue。
 */
export function shouldSaveLocationPoint(
  point: NewLocationPoint,
  previousPoint: CoordinateLike | null,
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
  const movementMode = classifyMovement(estimateSpeedMps(point, previousPoint, distance));

  switch (movementMode) {
    case 'stationary':
      return accuracy <= 30 && distance >= STATIONARY_MIN_DISTANCE_METERS;
    case 'walk':
      return accuracy <= 35 && distance >= minDistanceMeters && distance >= accuracy * 0.75;
    case 'vehicle':
      return accuracy <= 50 && distance >= VEHICLE_MIN_DISTANCE_METERS && distance >= accuracy * 0.5;
    case 'fast':
      return distance >= FAST_MIN_DISTANCE_METERS && distance >= accuracy * 0.4;
  }
}

/**
 * GPSポイントの速度をm/sで推定する。
 *
 * @param point - 新しく取得したGPSポイント。
 * @param previousPoint - 直前に保存済みのGPSポイント。
 * @param distance - 2点間距離。未指定時は関数内で計算する。
 * @returns 推定速度。計算できない場合は0。
 */
export function estimateSpeedMps(
  point: NewLocationPoint,
  previousPoint: TimedCoordinateLike,
  distance = distanceMeters(previousPoint, point),
): number {
  if (point.speed != null && point.speed >= 0) {
    return point.speed;
  }

  if (!previousPoint.recordedAt) {
    return 0;
  }

  const elapsedSeconds = (Date.parse(point.recordedAt) - Date.parse(previousPoint.recordedAt)) / 1000;

  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) {
    return 0;
  }

  return distance / elapsedSeconds;
}

/**
 * 速度から保存判定用の移動モードを分類する。
 *
 * @param speedMps - m/s単位の速度。
 * @returns 移動モード。
 */
export function classifyMovement(speedMps: number): MovementMode {
  if (speedMps < STATIONARY_MAX_SPEED_MPS) {
    return 'stationary';
  }

  if (speedMps < WALK_MAX_SPEED_MPS) {
    return 'walk';
  }

  if (speedMps < VEHICLE_MAX_SPEED_MPS) {
    return 'vehicle';
  }

  return 'fast';
}
