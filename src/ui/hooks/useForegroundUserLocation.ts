import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';

import { bufferLocationsDuringGpxImport, isGpxImportPriorityActive } from '@/features/location/gpxImportPriority';
import { createLocationRecordingSession, LocationRecordingSession } from '@/features/location/locationRecordingSession';
import { ensureForegroundLocationPermission } from '@/features/location/locationService';
import type { StayPlace } from '@/features/stayPlaces/stayPlaceTypes';

/** 位置更新を受け取るコールバック。speedはm/s（取得できない場合はnull）。 */
export type ForegroundUserLocationCallback = (latitude: number, longitude: number, speed: number | null) => void;

/** 前景位置監視の表示・保存用途を指定する。 */
export type ForegroundUserLocationOptions = {
  /** 位置購読を有効にするか。 */
  enabled: boolean;
  /** 新しく取得した位置をGPSログへ保存するか。 */
  shouldPersist: boolean;
  /** 現在地表示へ位置更新を渡す場合のコールバック。 */
  onLocation?: ForegroundUserLocationCallback;
  /** 監視開始または保存処理の失敗通知。 */
  onError?: (error: unknown) => void;
  /** 現在の契約状態を反映した、GPS吸着に使う滞在場所の取得関数。 */
  getActiveStayPlaces?: () => Promise<StayPlace[]>;
};

/**
 * Subscribes to foreground location updates for display and optional GPS recording.
 *
 * The last known position is sent only to the display callback. New observations
 * are recorded sequentially when persistence is enabled.
 *
 * @param enabled - Whether to start the foreground location subscription
 * @param shouldPersist - Whether to persist new location observations
 * @param onLocation - Callback invoked with the latitude, longitude, and speed of each displayed location
 * @param onError - Callback invoked when setup or recording fails
 * @param getActiveStayPlaces - Optional callback used to retrieve active stay places for recording
 */
export function useForegroundUserLocation({
  enabled,
  shouldPersist,
  onLocation,
  onError,
  getActiveStayPlaces,
}: ForegroundUserLocationOptions): void {
  const onLocationRef = useRef(onLocation);
  const onErrorRef = useRef(onError);
  const getActiveStayPlacesRef = useRef(getActiveStayPlaces);

  useEffect(() => {
    onLocationRef.current = onLocation;
  }, [onLocation]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    getActiveStayPlacesRef.current = getActiveStayPlaces;
  }, [getActiveStayPlaces]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    let sessionPromise: Promise<LocationRecordingSession> | null = null;
    let recordingQueue = Promise.resolve();

    (async () => {
      const granted = await ensureForegroundLocationPermission();

      if (!granted || cancelled) {
        return;
      }

      // 初回表示の遅延を抑える。古い観測の可能性があるため保存はしない。
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown && !cancelled) {
        onLocationRef.current?.(lastKnown.coords.latitude, lastKnown.coords.longitude, lastKnown.coords.speed);
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: shouldPersist ? Location.Accuracy.High : Location.Accuracy.Balanced,
          distanceInterval: 5,
          timeInterval: 2000,
        },
        (location) => {
          if (cancelled) {
            return;
          }

          onLocationRef.current?.(location.coords.latitude, location.coords.longitude, location.coords.speed);

          if (!shouldPersist) {
            return;
          }

          recordingQueue = recordingQueue.then(async () => {
            try {
              // GPXインポート中はセッション生成(initializeDatabase等のDBアクセス)より前に退避する
              if (isGpxImportPriorityActive()) {
                bufferLocationsDuringGpxImport([location]);
                return;
              }

              sessionPromise ??= createLocationRecordingSession({
                getActiveStayPlaces: async () => (await getActiveStayPlacesRef.current?.()) ?? [],
              });
              const session = await sessionPromise;
              await session.recordLocations([location]);
            } catch (error: unknown) {
              // 部分保存後のメモリ状態を再利用せず、次の更新でDBから再初期化する。
              sessionPromise = null;
              if (!cancelled) {
                onErrorRef.current?.(error);
              }
            }
          });
        },
      );

      if (cancelled) {
        subscription.remove();
        subscription = null;
      }
    })().catch((error: unknown) => {
      if (!cancelled) {
        onErrorRef.current?.(error);
      }
    });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled, shouldPersist]);
}
