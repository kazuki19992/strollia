import { useEffect, useRef, useState } from 'react';
import { AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import type { LatLng } from 'react-native-maps';

import { AreaLabel, getAreaLabelFromAddress, getAreaNameFromAddress } from '../areaName';

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
  const lastKnownNameRef = useRef<string | null>(null);

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

        const name = getAreaNameFromAddress(addresses[0]);
        if (name !== null) {
          lastKnownNameRef.current = name;
          setCurrentAreaName(name);
        } else {
          setCurrentAreaName(lastKnownNameRef.current ?? '取得中…');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCurrentAreaName(lastKnownNameRef.current ?? '取得中…');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [appState, userCoordinate]);

  return currentAreaName;
}

/** 現在地座標から地図下部ダッシュボード用の地域名を取得する。 */
export function useCurrentAreaLabel({ userCoordinate, appState }: UseCurrentAreaNameArgs): AreaLabel {
  const [currentAreaLabel, setCurrentAreaLabel] = useState<AreaLabel>({ primary: '現在地を確認中', secondary: null });
  const lastKnownLabelRef = useRef<AreaLabel | null>(null);

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

        const label = getAreaLabelFromAddress(addresses[0]);
        if (label !== null) {
          lastKnownLabelRef.current = label;
          setCurrentAreaLabel(label);
        } else {
          setCurrentAreaLabel(lastKnownLabelRef.current ?? { primary: '取得中…', secondary: null });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCurrentAreaLabel(lastKnownLabelRef.current ?? { primary: '取得中…', secondary: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [appState, userCoordinate]);

  return currentAreaLabel;
}
