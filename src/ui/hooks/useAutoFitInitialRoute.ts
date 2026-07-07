import { useEffect, RefObject } from 'react';
import MapView from 'react-native-maps';
import type { LatLng } from 'react-native-maps';

/** 初回の現在地取得前に保存済みルート全体が見えるよう地図をフィットする。 */
export function useAutoFitInitialRoute(
  mapRef: RefObject<MapView | null>,
  screenMode: string,
  routeCoordinates: LatLng[],
  userCoordinate: LatLng | null,
): void {
  useEffect(() => {
    if (screenMode !== 'map' || routeCoordinates.length < 2 || userCoordinate) {
      return;
    }

    mapRef.current?.fitToCoordinates(routeCoordinates, {
      animated: true,
      edgePadding: { bottom: 180, left: 48, right: 48, top: 96 },
    });
  }, [mapRef, routeCoordinates, screenMode, userCoordinate]);
}
