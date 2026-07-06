import { useRef } from 'react';
import { useMapFollowState, UseMapFollowStateResult } from '@/app/hooks/useMapFollowState';
import type { ResolvedUserLocationIcon } from '@/features/customization/customizationResolver';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

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

type HookProbeProps = {
  /** フックの戻り値をテストへ渡すコールバック。 */
  onResult: (result: UseMapFollowStateResult) => void;
  /** 現在の画面モード。 */
  screenMode?: 'map' | 'dailyLogs' | 'achievements' | 'monthlyReport' | 'settings';
  /** アイコン解決結果。 */
  userLocationIcon?: ResolvedUserLocationIcon;
};

/** フックを実行するための最小コンポーネント。 */
function HookProbe({ onResult, screenMode = 'map', userLocationIcon = NATIVE_USER_LOCATION_ICON }: HookProbeProps) {
  const incrementRef = useRef<() => void>(() => undefined);
  const result = useMapFollowState({
    screenMode,
    userLocationIcon,
    incrementVisitedGridRefreshVersionRef: incrementRef,
  });
  onResult(result);
  return null;
}

describe('地図追従・センタリングフック useMapFollowState', () => {
  describe('初期状態', () => {
    it('初期 isFollowingUserLocation は true（追従ON）になる', () => {
      let result: UseMapFollowStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.isFollowingUserLocation).toBe(true);
    });

    it('初期 userCoordinate は null になる', () => {
      let result: UseMapFollowStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.userCoordinate).toBeNull();
    });

    it('初期 isMapReady は false になる', () => {
      let result: UseMapFollowStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.isMapReady).toBe(false);
    });

    it('初期 visibleRegion は null になる', () => {
      let result: UseMapFollowStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.visibleRegion).toBeNull();
    });

    it('初期 currentSpeedKmh は 0 になる', () => {
      let result: UseMapFollowStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.currentSpeedKmh).toBe(0);
    });

    it('初期 mapType は standard になる', () => {
      let result: UseMapFollowStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.mapType).toBe('standard');
    });
  });

  describe('handleMapPanDrag — ドラッグで追従 OFF', () => {
    it('ドラッグ操作後は isFollowingUserLocation が false になる', () => {
      let result: UseMapFollowStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      act(() => {
        result!.handleMapPanDrag();
      });

      expect(result!.isFollowingUserLocation).toBe(false);
    });
  });

  describe('recenterOnUserLocation — 現在地ボタンで追従 ON', () => {
    it('現在地ボタン押下後は isFollowingUserLocation が true に戻る', () => {
      let result: UseMapFollowStateResult | undefined;
      const mockAnimateToRegion = jest.fn();

      act(() => {
        ReactTestRenderer.create(
          <HookProbe
            onResult={(r) => {
              result = r;
              // mapRef に mock を注入
              (r.mapRef as React.MutableRefObject<{ animateToRegion: jest.Mock } | null>).current = {
                animateToRegion: mockAnimateToRegion,
              };
            }}
          />,
        );
      });

      // ドラッグで追従 OFF にする
      act(() => {
        result!.handleMapPanDrag();
      });

      expect(result!.isFollowingUserLocation).toBe(false);

      // 現在地を設定してから recenter
      act(() => {
        result!.applyUserLocation(35.681236, 139.767125, null);
      });

      act(() => {
        result!.recenterOnUserLocation();
      });

      expect(result!.isFollowingUserLocation).toBe(true);
    });

    it('userCoordinate が null のときは recenterOnUserLocation を呼んでも追従状態は変わらない', () => {
      let result: UseMapFollowStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      // ドラッグで追従 OFF
      act(() => {
        result!.handleMapPanDrag();
      });

      // 現在地なしで recenter → 何も起きない
      act(() => {
        result!.recenterOnUserLocation();
      });

      expect(result!.isFollowingUserLocation).toBe(false);
    });
  });

  describe('追従の自動復帰禁止 — 現在地更新だけでは追従 ON に戻らない', () => {
    it('ドラッグ後に現在地が更新されても isFollowingUserLocation は false のまま', () => {
      let result: UseMapFollowStateResult | undefined;
      const mockAnimateToRegion = jest.fn();

      act(() => {
        ReactTestRenderer.create(
          <HookProbe
            onResult={(r) => {
              result = r;
              (r.mapRef as React.MutableRefObject<{ animateToRegion: jest.Mock } | null>).current = {
                animateToRegion: mockAnimateToRegion,
              };
            }}
          />,
        );
      });

      // ドラッグで追従 OFF
      act(() => {
        result!.handleMapPanDrag();
      });

      expect(result!.isFollowingUserLocation).toBe(false);

      // 現在地更新（OS標準アイコン時も追従は自動復帰しない）
      act(() => {
        result!.applyUserLocation(35.681236, 139.767125, null);
      });

      // 追従が勝手に ON に戻っていないことを確認
      expect(result!.isFollowingUserLocation).toBe(false);
    });
  });

  describe('applyUserLocation — 現在地と速度の更新', () => {
    it('有効な緯度経度で userCoordinate が更新される', () => {
      let result: UseMapFollowStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      act(() => {
        result!.applyUserLocation(35.681236, 139.767125, null);
      });

      expect(result!.userCoordinate).toEqual({ latitude: 35.681236, longitude: 139.767125 });
    });

    it('速度が渡された場合は currentSpeedKmh が更新される', () => {
      let result: UseMapFollowStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      // 10 m/s = 36 km/h
      act(() => {
        result!.applyUserLocation(35.681236, 139.767125, 10);
      });

      expect(result!.currentSpeedKmh).toBeGreaterThan(0);
    });

    it('無効な座標（NaN）は無視される', () => {
      let result: UseMapFollowStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      act(() => {
        result!.applyUserLocation(NaN, 139.767125, null);
      });

      expect(result!.userCoordinate).toBeNull();
    });
  });

  describe('handleMapReady', () => {
    it('handleMapReady 呼び出し後は isMapReady が true になる', () => {
      let result: UseMapFollowStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      act(() => {
        result!.handleMapReady();
      });

      expect(result!.isMapReady).toBe(true);
    });
  });

  describe('地図から離れると isMapReady がリセットされる', () => {
    it('screenMode が map 以外になると isMapReady が false に戻る', () => {
      let result: UseMapFollowStateResult | undefined;
      let renderer: ReturnType<typeof ReactTestRenderer.create>;

      act(() => {
        renderer = ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} screenMode="map" />);
      });

      act(() => {
        result!.handleMapReady();
      });

      expect(result!.isMapReady).toBe(true);

      act(() => {
        renderer.update(<HookProbe onResult={(r) => (result = r)} screenMode="settings" />);
      });

      expect(result!.isMapReady).toBe(false);
    });
  });

  describe('handleRegionChangeComplete — 表示範囲の保存', () => {
    it('表示範囲が更新される', () => {
      let result: UseMapFollowStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      const region = { latitude: 35.68, longitude: 139.76, latitudeDelta: 0.01, longitudeDelta: 0.01 };

      act(() => {
        result!.handleRegionChangeComplete(region);
      });

      expect(result!.visibleRegion).toEqual(region);
    });
  });

  describe('toggleMapType — 地図種別の切り替え', () => {
    it('初期状態から toggleMapType を呼ぶと hybrid になる', () => {
      let result: UseMapFollowStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      act(() => {
        result!.toggleMapType();
      });

      expect(result!.mapType).toBe('hybrid');
    });

    it('再度 toggleMapType を呼ぶと standard に戻る', () => {
      let result: UseMapFollowStateResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      act(() => {
        result!.toggleMapType();
      });

      act(() => {
        result!.toggleMapType();
      });

      expect(result!.mapType).toBe('standard');
    });
  });
});
