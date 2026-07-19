import { act, renderHook } from '@testing-library/react-native';
import { useRef } from 'react';
import { useMapFollowState, UseMapFollowStateResult } from '@/ui/hooks/useMapFollowState';
import type { ResolvedUserLocationIcon } from '@/features/customization/customizationResolver';
import type { ScreenMode } from '@/ui/appTypes';

jest.mock('react-native-maps', () => {
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: View,
    Marker: View,
    Polygon: View,
    Polyline: View,
  };
});

/** テスト用のネイティブアイコン解決結果。 */
const NATIVE_USER_LOCATION_ICON = {
  useNativeUserLocation: true,
  customIconId: null,
  customImageUri: null,
} as const;

/** テスト用のカスタムアイコン（walker）解決結果。 */
const CUSTOM_USER_LOCATION_ICON = {
  useNativeUserLocation: false,
  customIconId: 'walker',
  customImageUri: null,
} as const;

/** useMapFollowState を既定値でレンダリングするヘルパー。テストごとの冗長な incrementRef 定義を集約する。 */
function renderMapFollowState(overrides: { screenMode?: ScreenMode; userLocationIcon?: ResolvedUserLocationIcon } = {}) {
  return renderHook(() => {
    const incrementRef = useRef<() => void>(() => undefined);
    return useMapFollowState({
      screenMode: overrides.screenMode ?? 'map',
      userLocationIcon: overrides.userLocationIcon ?? NATIVE_USER_LOCATION_ICON,
      incrementVisitedGridRefreshVersionRef: incrementRef,
    });
  });
}

/**
 * カスタムアイコン時の追従センタリング挙動を検証するためのヘルパー。
 * mapRef に animateToRegion モックを注入し、rerender で screenMode を切り替えられるようにする。
 */
function renderCustomIconMapFollowState(overrides: { screenMode?: ScreenMode } = {}) {
  const mockAnimateToRegion = jest.fn();
  const rendered = renderHook(
    ({ screenMode }: { screenMode: ScreenMode }) => {
      const incrementRef = useRef<() => void>(() => undefined);
      const hookResult = useMapFollowState({
        screenMode,
        userLocationIcon: CUSTOM_USER_LOCATION_ICON,
        incrementVisitedGridRefreshVersionRef: incrementRef,
      });
      (hookResult.mapRef as React.MutableRefObject<{ animateToRegion: jest.Mock } | null>).current = {
        animateToRegion: mockAnimateToRegion,
      };
      return hookResult;
    },
    { initialProps: { screenMode: overrides.screenMode ?? 'map' } },
  );

  return { ...rendered, mockAnimateToRegion };
}

describe('地図追従・センタリングフック useMapFollowState', () => {
  describe('初期状態', () => {
    it('初期 isFollowingUserLocation は true（追従ON）になる', () => {
      const { result } = renderMapFollowState();

      expect(result.current.isFollowingUserLocation).toBe(true);
    });

    it('初期 userCoordinate は null になる', () => {
      const { result } = renderMapFollowState();

      expect(result.current.userCoordinate).toBeNull();
    });

    it('初期 isMapReady は false になる', () => {
      const { result } = renderMapFollowState();

      expect(result.current.isMapReady).toBe(false);
    });

    it('初期 visibleRegion は null になる', () => {
      const { result } = renderMapFollowState();

      expect(result.current.visibleRegion).toBeNull();
    });

    it('初期 currentSpeedKmh は 0 になる', () => {
      const { result } = renderMapFollowState();

      expect(result.current.currentSpeedKmh).toBe(0);
    });

    it('初期 mapType は standard になる', () => {
      const { result } = renderMapFollowState();

      expect(result.current.mapType).toBe('standard');
    });
  });

  describe('handleMapPanDrag — ドラッグで追従 OFF', () => {
    it('ドラッグ操作後は isFollowingUserLocation が false になる', () => {
      const { result } = renderMapFollowState();

      act(() => {
        result.current.handleMapPanDrag();
      });

      expect(result.current.isFollowingUserLocation).toBe(false);
    });
  });

  describe('recenterOnUserLocation — 現在地ボタンで追従 ON', () => {
    it('現在地ボタン押下後は isFollowingUserLocation が true に戻る', () => {
      const mockAnimateToRegion = jest.fn();
      const { result } = renderHook(() => {
        const incrementRef = useRef<() => void>(() => undefined);
        const hookResult = useMapFollowState({
          screenMode: 'map',
          userLocationIcon: NATIVE_USER_LOCATION_ICON,
          incrementVisitedGridRefreshVersionRef: incrementRef,
        });
        // mapRef に mock を注入
        (hookResult.mapRef as React.MutableRefObject<{ animateToRegion: jest.Mock } | null>).current = {
          animateToRegion: mockAnimateToRegion,
        };
        return hookResult;
      });

      // ドラッグで追従 OFF にする
      act(() => {
        result.current.handleMapPanDrag();
      });

      expect(result.current.isFollowingUserLocation).toBe(false);

      // 現在地を設定してから recenter
      act(() => {
        result.current.applyUserLocation(35.681236, 139.767125, null);
      });

      act(() => {
        result.current.recenterOnUserLocation();
      });

      expect(result.current.isFollowingUserLocation).toBe(true);
    });

    it('userCoordinate が null のときは recenterOnUserLocation を呼んでも追従状態は変わらない', () => {
      const { result } = renderMapFollowState();

      // ドラッグで追従 OFF
      act(() => {
        result.current.handleMapPanDrag();
      });

      // 現在地なしで recenter → 何も起きない
      act(() => {
        result.current.recenterOnUserLocation();
      });

      expect(result.current.isFollowingUserLocation).toBe(false);
    });
  });

  describe('追従の自動復帰禁止 — 現在地更新だけでは追従 ON に戻らない', () => {
    it('ドラッグ後に現在地が更新されても isFollowingUserLocation は false のまま', () => {
      const mockAnimateToRegion = jest.fn();
      const { result } = renderHook(() => {
        const incrementRef = useRef<() => void>(() => undefined);
        const hookResult = useMapFollowState({
          screenMode: 'map',
          userLocationIcon: NATIVE_USER_LOCATION_ICON,
          incrementVisitedGridRefreshVersionRef: incrementRef,
        });
        (hookResult.mapRef as React.MutableRefObject<{ animateToRegion: jest.Mock } | null>).current = {
          animateToRegion: mockAnimateToRegion,
        };
        return hookResult;
      });

      // ドラッグで追従 OFF
      act(() => {
        result.current.handleMapPanDrag();
      });

      expect(result.current.isFollowingUserLocation).toBe(false);

      // 現在地更新（OS標準アイコン時も追従は自動復帰しない）
      act(() => {
        result.current.applyUserLocation(35.681236, 139.767125, null);
      });

      // 追従が勝手に ON に戻っていないことを確認
      expect(result.current.isFollowingUserLocation).toBe(false);
    });
  });

  describe('applyUserLocation — 現在地と速度の更新', () => {
    it('有効な緯度経度で userCoordinate が更新される', () => {
      const { result } = renderMapFollowState();

      act(() => {
        result.current.applyUserLocation(35.681236, 139.767125, null);
      });

      expect(result.current.userCoordinate).toEqual({ latitude: 35.681236, longitude: 139.767125 });
    });

    it('速度が渡された場合は currentSpeedKmh が更新される', () => {
      const { result } = renderMapFollowState();

      // 10 m/s = 36 km/h
      act(() => {
        result.current.applyUserLocation(35.681236, 139.767125, 10);
      });

      expect(result.current.currentSpeedKmh).toBeGreaterThan(0);
    });

    it('無効な座標（NaN）は無視される', () => {
      const { result } = renderMapFollowState();

      act(() => {
        result.current.applyUserLocation(NaN, 139.767125, null);
      });

      expect(result.current.userCoordinate).toBeNull();
    });
  });

  describe('handleMapReady', () => {
    it('handleMapReady 呼び出し後は isMapReady が true になる', () => {
      const { result } = renderMapFollowState();

      act(() => {
        result.current.handleMapReady();
      });

      expect(result.current.isMapReady).toBe(true);
    });
  });

  describe('handleRegionChangeComplete — 表示範囲の保存', () => {
    it('表示範囲が更新される', () => {
      const { result } = renderMapFollowState();

      const region = { latitude: 35.68, longitude: 139.76, latitudeDelta: 0.01, longitudeDelta: 0.01 };

      act(() => {
        result.current.handleRegionChangeComplete(region);
      });

      expect(result.current.visibleRegion).toEqual(region);
    });
  });

  describe('カスタムアイコン時の追従センタリング（issue #126）', () => {
    it('継続追従: handleMapReady 後は現在地更新のたびにセンタリングされ続ける', () => {
      const { result, mockAnimateToRegion } = renderCustomIconMapFollowState();

      act(() => {
        result.current.handleMapReady();
      });

      act(() => {
        result.current.applyUserLocation(35.681236, 139.767125, null);
      });
      expect(mockAnimateToRegion).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.applyUserLocation(35.6813, 139.7672, null);
      });
      expect(mockAnimateToRegion).toHaveBeenCalledTimes(2);

      act(() => {
        result.current.applyUserLocation(35.6814, 139.7673, null);
      });
      expect(mockAnimateToRegion).toHaveBeenCalledTimes(3);
    });

    it('画面往復後の継続追従: 他画面へ遷移してから地図へ戻っても（MapView 再マウントなし）追従センタリングが継続する', () => {
      const { result, rerender, mockAnimateToRegion } = renderCustomIconMapFollowState({ screenMode: 'map' });

      act(() => {
        result.current.handleMapReady();
      });

      act(() => {
        result.current.applyUserLocation(35.681236, 139.767125, null);
      });
      expect(mockAnimateToRegion).toHaveBeenCalledTimes(1);

      // 他画面へ遷移 → 地図へ戻る。expo-router 構成では MapView は再マウントされないため
      // handleMapReady は再度呼ばれない（isMapReady はリセットされず true のまま）。
      act(() => {
        rerender({ screenMode: 'settings' });
      });
      act(() => {
        rerender({ screenMode: 'map' });
      });

      expect(result.current.isMapReady).toBe(true);
      const callsAfterRoundTrip = mockAnimateToRegion.mock.calls.length;

      act(() => {
        result.current.applyUserLocation(35.6813, 139.7672, null);
      });

      // 画面往復後も、旧ラッチ挙動のように isMapReady が false のまま固まらず追従が続く。
      expect(mockAnimateToRegion.mock.calls.length).toBeGreaterThan(callsAfterRoundTrip);
    });

    it('onMapReady 不発火フォールバック: 最初の onRegionChangeComplete で保留中の現在地へセンタリングされる', () => {
      const { result, mockAnimateToRegion } = renderCustomIconMapFollowState();

      // handleMapReady は一度も呼ばない（New Architecture実機での不発火を再現）。
      act(() => {
        result.current.applyUserLocation(35.681236, 139.767125, null);
      });
      expect(result.current.isMapReady).toBe(false);
      expect(mockAnimateToRegion).not.toHaveBeenCalled();

      const region = { latitude: 35.68, longitude: 139.76, latitudeDelta: 0.01, longitudeDelta: 0.01 };

      act(() => {
        result.current.handleRegionChangeComplete(region);
      });

      // onRegionChangeComplete が isMapReady を true にし、保留中の現在地へセンタリングする。
      expect(result.current.isMapReady).toBe(true);
      expect(mockAnimateToRegion).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.applyUserLocation(35.6813, 139.7672, null);
      });
      expect(mockAnimateToRegion).toHaveBeenCalledTimes(2);
    });

    it('再追従の継続: ドラッグでOFFの間はカメラが動かず、現在地ボタンでONに戻すと以後も追従が続く', () => {
      const { result, mockAnimateToRegion } = renderCustomIconMapFollowState();

      act(() => {
        result.current.handleMapReady();
      });

      act(() => {
        result.current.handleMapPanDrag();
      });
      expect(result.current.isFollowingUserLocation).toBe(false);

      const callsWhileFollowing = mockAnimateToRegion.mock.calls.length;

      act(() => {
        result.current.applyUserLocation(35.681236, 139.767125, null);
      });
      // 追従OFF時は位置更新だけではカメラが動かない。
      expect(mockAnimateToRegion).toHaveBeenCalledTimes(callsWhileFollowing);

      act(() => {
        result.current.recenterOnUserLocation();
      });
      expect(result.current.isFollowingUserLocation).toBe(true);
      const callsAfterRecenter = mockAnimateToRegion.mock.calls.length;
      expect(callsAfterRecenter).toBeGreaterThan(callsWhileFollowing);

      act(() => {
        result.current.applyUserLocation(35.6814, 139.7673, null);
      });
      // 再追従ON後は後続の現在地更新でもセンタリングが続く。
      expect(mockAnimateToRegion.mock.calls.length).toBeGreaterThan(callsAfterRecenter);
    });
  });

  describe('toggleMapType — 地図種別の切り替え', () => {
    it('初期状態から toggleMapType を呼ぶと hybrid になる', () => {
      const { result } = renderMapFollowState();

      act(() => {
        result.current.toggleMapType();
      });

      expect(result.current.mapType).toBe('hybrid');
    });

    it('再度 toggleMapType を呼ぶと standard に戻る', () => {
      const { result } = renderMapFollowState();

      act(() => {
        result.current.toggleMapType();
      });

      act(() => {
        result.current.toggleMapType();
      });

      expect(result.current.mapType).toBe('standard');
    });
  });
});
