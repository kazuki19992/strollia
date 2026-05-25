import { useMemo } from 'react';

import { estimateAcceptedSegmentSpeedMps } from '../../features/location/locationSpeed';
import { LocationPoint } from '../../types/gps';
import { distanceMeters } from '../../utils/distance';

/** 停止ドリフト判定に使う直近点数。 */
const STATIONARY_DRIFT_WINDOW_POINT_COUNT = 4;

/** この範囲内に直近点が収まる場合は停止中の揺れとみなす。 */
const STATIONARY_DRIFT_RADIUS_METERS = 25;

/** 低速ドリフトとして停止表示へ倒す最大区間速度。 */
const STATIONARY_DRIFT_MAX_SPEED_KMH = 5;

/**
 * 最後に採用された2点から速度メーター表示用の速度を求める。
 *
 * @param points - 軽量保存判定を通ったGPSポイント。
 * @returns km/h単位の現在速度。区間を作れない場合は0。
 */
export function calculateReliableCurrentSpeedKmh(points: LocationPoint[]): number {
  const latest = points.at(-1);
  const previous = points.at(-2);

  if (!latest || !previous) {
    return 0;
  }

  const speedKmh = estimateAcceptedSegmentSpeedMps(previous, latest) * 3.6;

  if (isStationaryDrift(points, speedKmh)) {
    return 0;
  }

  return speedKmh;
}

/**
 * 直近の保存済み点が狭い範囲で揺れているだけなら停止中のGPSドリフトとみなす。
 *
 * @param points - 軽量保存判定を通ったGPSポイント。
 * @param latestSegmentSpeedKmh - 最後の保存区間速度。単位はkm/h。
 * @returns 停止表示へ倒すべきドリフトならtrue。
 */
function isStationaryDrift(points: LocationPoint[], latestSegmentSpeedKmh: number): boolean {
  if (latestSegmentSpeedKmh > STATIONARY_DRIFT_MAX_SPEED_KMH) {
    return false;
  }

  const recentPoints = points.slice(-STATIONARY_DRIFT_WINDOW_POINT_COUNT);

  if (recentPoints.length < 3) {
    return false;
  }

  const latest = recentPoints.at(-1);

  if (!latest) {
    return false;
  }

  return recentPoints.every((point) => distanceMeters(point, latest) <= STATIONARY_DRIFT_RADIUS_METERS);
}

/**
 * 保存済み点に追従する速度メーター用速度を返す。
 *
 * @param points - 軽量保存判定を通ったGPSポイント。
 * @returns km/h単位の現在速度。
 */
export function useReliableCurrentSpeed(points: LocationPoint[]): number {
  return useMemo(() => calculateReliableCurrentSpeedKmh(points), [points]);
}
