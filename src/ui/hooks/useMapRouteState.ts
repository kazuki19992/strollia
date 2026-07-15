import { useMemo } from 'react';
import type { Region } from 'react-native-maps';

import { createInitialRegion, RouteCoordinate, toRenderRouteCoordinates } from '@/features/map/routeMapper';
import { DailyLogSummary, LocationPoint } from '@/types/gps';
import { totalDistanceMeters } from '@/utils/distance';

export type MapRouteState = {
  /** 全履歴から生成した簡略化済み描画座標。 */
  renderRouteCoordinates: RouteCoordinate[];
  /** GPSログ全体が収まる初期表示範囲。 */
  initialRegion: Region;
  /** 画面に表示する総移動距離。 */
  distance: number;
};

/**
 * 日別サマリーの累積距離を優先し、未計算データがある場合だけ全点距離へフォールバックする。
 *
 * @param dailyLogs - DBから取得した日別サマリー一覧。
 * @param points - 全期間の保存済みGPSポイント。
 * @returns 画面表示に使う総移動距離メートル。
 */
export function calculateDisplayDistance(dailyLogs: DailyLogSummary[], points: LocationPoint[]): number {
  const canUseStoredDistance = dailyLogs.every((log) => log.distanceMeters != null);

  if (canUseStoredDistance) {
    return dailyLogs.reduce((total, log) => total + (log.distanceMeters ?? 0), 0);
  }

  return totalDistanceMeters(points);
}

/**
 * メインマップで使うルート派生状態をまとめて計算する。
 *
 * @param points - 全期間の保存済みGPSポイント。
 * @param dailyLogs - DBから取得した日別サマリー一覧。
 * @returns メインマップ描画に必要な派生状態一式。
 */
export function useMapRouteState(points: LocationPoint[], dailyLogs: DailyLogSummary[]): MapRouteState {
  const renderRouteCoordinates = useMemo(() => toRenderRouteCoordinates(points), [points]);
  const initialRegion = useMemo(() => createInitialRegion(points), [points]);
  const distance = useMemo(() => calculateDisplayDistance(dailyLogs, points), [dailyLogs, points]);

  return {
    renderRouteCoordinates,
    initialRegion,
    distance,
  };
}
