import { useMemo } from 'react';

import { estimateAcceptedSegmentSpeedMps } from '../../features/location/locationSpeed';
import { LocationPoint } from '../../types/gps';

/**
 * 最後に採用された2点から速度メーター表示用の速度を求める。
 *
 * @param points - 品質判定後に保存されたGPSポイント。
 * @returns km/h単位の現在速度。区間を作れない場合は0。
 */
export function calculateReliableCurrentSpeedKmh(points: LocationPoint[]): number {
  const latest = points.at(-1);
  const previous = points.at(-2);

  if (!latest || !previous) {
    return 0;
  }

  return estimateAcceptedSegmentSpeedMps(previous, latest) * 3.6;
}

/**
 * 品質判定後の保存済み点に追従する速度メーター用速度を返す。
 *
 * @param points - 品質判定後に保存されたGPSポイント。
 * @returns km/h単位の現在速度。
 */
export function useReliableCurrentSpeed(points: LocationPoint[]): number {
  return useMemo(() => calculateReliableCurrentSpeedKmh(points), [points]);
}
