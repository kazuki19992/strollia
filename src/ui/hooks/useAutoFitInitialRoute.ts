import { useEffect, RefObject } from 'react';
import MapView from 'react-native-maps';
import type { LatLng, Region } from 'react-native-maps';

/**
 * 初回の現在地取得前に、保存済みGPSログの初期表示範囲(境界+マージン)へ地図をアニメーションする。
 *
 * `MapView` の `initialRegion` propは初回マウント時の値で固定されるため、境界計算が
 * マウント後に非同期で確定した場合はこのeffectで明示的に移動させる必要がある。
 */
export function useAutoFitInitialRoute(
  mapRef: RefObject<MapView | null>,
  screenMode: string,
  initialRegion: Region,
  hasAnyLocationPoints: boolean,
  userCoordinate: LatLng | null,
): void {
  useEffect(() => {
    if (screenMode !== 'map' || !hasAnyLocationPoints || userCoordinate) {
      return;
    }

    mapRef.current?.animateToRegion(initialRegion);
  }, [mapRef, initialRegion, hasAnyLocationPoints, screenMode, userCoordinate]);
}
