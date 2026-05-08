import { useEffect, useState } from 'react';
import { AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import type { LatLng } from 'react-native-maps';

import { getAreaNameFromAddress } from '../areaName';

/** 現在地地域名hookの引数。 */
export type UseCurrentAreaNameArgs = {
  /** 現在地座標。 */
  userCoordinate: LatLng | null;
  /** 現在のアプリ状態。 */
  appState: AppStateStatus;
};

/** 現在地座標から市区町村表示用の地域名を取得する。 */
export function useCurrentAreaName({ userCoordinate, appState }: UseCurrentAreaNameArgs): string {
  const [currentAreaName, setCurrentAreaName] = useState('現在地を確認中');

  useEffect(() => {
    if (!userCoordinate || appState !== 'active') {
      return;
    }

    let cancelled = false;

    Location.reverseGeocodeAsync(userCoordinate)
      .then((addresses) => {
        if (cancelled) {
          return;
        }

        setCurrentAreaName(getAreaNameFromAddress(addresses[0]));
      })
      .catch(() => {
        if (!cancelled) {
          setCurrentAreaName('現在地付近');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [appState, userCoordinate]);

  return currentAreaName;
}
