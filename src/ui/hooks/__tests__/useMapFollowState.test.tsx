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

  describe('地図から離れると isMapReady がリセットされる', () => {
    it('screenMode が map 以外になると isMapReady が false に戻る', () => {
      const { result, rerender } = renderHook(
        ({ screenMode }: { screenMode: 'map' | 'dailyLogs' | 'achievements' | 'monthlyReport' | 'settings' }) => {
          const incrementRef = useRef<() => void>(() => undefined);
          return useMapFollowState({
            screenMode,
            userLocationIcon: NATIVE_USER_LOCATION_ICON,
            incrementVisitedGridRefreshVersionRef: incrementRef,
          });
        },
        { initialProps: { screenMode: 'map' as const } },
      );

      act(() => {
        result.current.handleMapReady();
      });

      expect(result.current.isMapReady).toBe(true);

      act(() => {
        rerender({ screenMode: 'settings' });
      });

      expect(result.current.isMapReady).toBe(false);
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
