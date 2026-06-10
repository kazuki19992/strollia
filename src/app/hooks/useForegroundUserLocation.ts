import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';

import { ensureForegroundLocationPermission } from '../../features/location/locationService';

/** 位置更新を受け取るコールバック。speedはm/s（取得できない場合はnull）。 */
export type ForegroundUserLocationCallback = (latitude: number, longitude: number, speed: number | null) => void;

/**
 * カスタム現在地アイコン使用時に前景の位置情報を購読する。
 *
 * OS標準の現在地ドット（showsUserLocation）を非表示にすると
 * react-native-mapsの `onUserLocationChange` が発火しなくなるため、
 * カスタムアイコン表示中はこのフックがexpo-locationで位置を供給する。
 *
 * @param enabled - 位置購読を有効にするか（カスタムアイコン選択中）。
 * @param onLocation - 位置更新を受け取るコールバック。
 */
export function useForegroundUserLocation(enabled: boolean, onLocation: ForegroundUserLocationCallback): void {
  const onLocationRef = useRef(onLocation);

  useEffect(() => {
    onLocationRef.current = onLocation;
  }, [onLocation]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      const granted = await ensureForegroundLocationPermission();

      if (!granted || cancelled) {
        return;
      }

      // 初回表示の遅延を抑えるため、最後に取得した位置があれば即時反映する。
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown && !cancelled) {
        onLocationRef.current(lastKnown.coords.latitude, lastKnown.coords.longitude, lastKnown.coords.speed);
      }

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 5, timeInterval: 2000 },
        (location) => {
          onLocationRef.current(location.coords.latitude, location.coords.longitude, location.coords.speed);
        },
      );

      if (cancelled) {
        subscription.remove();
        subscription = null;
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled]);
}
