import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { LandmarkSpot } from '@/features/landmarks/landmarkCatalog';
import { createLandmarkSpotFocusRegion, type LandmarkMapRegion } from '@/features/landmarks/landmarkSpotMapDetails';
import { createRegionFromBounds } from '@/features/map/routeMapper';
import { lightTheme } from '@/theme/theme';
import { createStyles } from '@/ui/appStyles';
import { LandmarkPackMapPreview, type LandmarkSpotFocusRequest } from '@/ui/components/LandmarkPackMapPreview';
import type { LandmarkSpotListItem } from '@/ui/hooks/useLandmarkPackState';

/** モックMapViewのrefへ差し込む animateToRegion。フォーカス移動先の検証に使う。 */
const mockAnimateToRegion = jest.fn();

/** 最後に描画されたモックMapViewのprops。initialRegion検証と onMapReady の手動発火に使う。 */
const mockMapViewProps: {
  current: { initialRegion?: unknown; onMapReady?: () => void; onRegionChangeComplete?: (region: LandmarkMapRegion) => void } | null;
} = { current: null };

jest.mock('react-native-maps', () => {
  const React = require('react'); // eslint-disable-line @typescript-eslint/no-require-imports
  const { View } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports

  type MockMapComponentProps = Record<string, unknown> & { children?: React.ReactNode };

  // 実 MapView は描画できないため、ref へ animateToRegion だけを差し込んだ View で代替する。
  // onMapReady はテストから明示的に発火させたいので、propsを外へ公開して自動発火はしない。
  const MapViewMock = React.forwardRef((props: MockMapComponentProps, ref: React.Ref<unknown>) => {
    // mock定義側のローカル型と、テスト本体側で参照する型が構造的には同じでも別名として扱われるため明示キャストする
    mockMapViewProps.current = props as {
      initialRegion?: unknown;
      onMapReady?: () => void;
      onRegionChangeComplete?: (region: LandmarkMapRegion) => void;
    };
    React.useImperativeHandle(ref, () => ({ animateToRegion: mockAnimateToRegion }));

    return React.createElement(View, props, props.children);
  });
  MapViewMock.displayName = 'MapViewMock';
  const MarkerMock = (props: MockMapComponentProps) => React.createElement(View, props, props.children);
  MarkerMock.displayName = 'MarkerMock';
  // Circle は子を持たない地図オーバーレイ。radius などの props を検証できるよう View で代替する
  const CircleMock = (props: MockMapComponentProps) => React.createElement(View, props);
  CircleMock.displayName = 'CircleMock';

  return { __esModule: true, default: MapViewMock, Marker: MarkerMock, Circle: CircleMock };
});

const styles = createStyles(lightTheme);

/** スポット1件を組み立てる。地図表示に必要な緯度経度以外は既定値で足りる。 */
function createSpot(
  overrides: Pick<LandmarkSpot, 'id' | 'name' | 'latitude' | 'longitude'> & Partial<Pick<LandmarkSpot, 'radiusMeters' | 'dwellSeconds'>>,
): LandmarkSpot {
  return {
    prefectures: ['TOCHIGI'],
    radiusMeters: 200,
    dwellSeconds: 180,
    packs: [{ packId: '01a0c450-6c00-7000-8000-000000000001', order: 1 }],
    ...overrides,
  };
}

/** 到達済み1件・未到達2件のスポット行(order昇順)。 */
const spotItems: LandmarkSpotListItem[] = [
  {
    spot: createSpot({ id: 'spot-1', name: '華厳の滝', latitude: 36.737917, longitude: 139.501972 }),
    visitedLocalDate: '2026-04-12',
  },
  {
    spot: createSpot({ id: 'spot-2', name: '那智の滝', latitude: 33.675278, longitude: 135.8875, radiusMeters: 650, dwellSeconds: 5400 }),
    visitedLocalDate: null,
  },
  {
    spot: createSpot({ id: 'spot-3', name: '袋田の滝', latitude: 36.767222, longitude: 140.398333 }),
    visitedLocalDate: null,
  },
];

/** 指定スポットへの1回目のフォーカス要求を作る。 */
function focusRequestFor(spotId: string, nonce = 1): LandmarkSpotFocusRequest {
  return { spotId, nonce };
}

/** 地図プレビューを描画する。focusRequest を切り替えるため rerender を返す。 */
async function renderPreview(focusRequest: LandmarkSpotFocusRequest = null, items: LandmarkSpotListItem[] = spotItems) {
  const view = await render(<LandmarkPackMapPreview spotItems={items} focusRequest={focusRequest} styles={styles} theme={lightTheme} />);

  return {
    rerender: async (nextFocusRequest: LandmarkSpotFocusRequest, nextItems: LandmarkSpotListItem[] = items) =>
      await view.rerender(
        <LandmarkPackMapPreview spotItems={nextItems} focusRequest={nextFocusRequest} styles={styles} theme={lightTheme} />,
      ),
  };
}

/** モックMapViewの onRegionChangeComplete を発火し、ユーザー操作やアニメーション後の表示範囲通知を再現する。 */
async function fireRegionChange(region: LandmarkMapRegion): Promise<void> {
  await act(() => {
    mockMapViewProps.current?.onRegionChangeComplete?.(region);
  });
}

/** 全マーカーの onLayout を発火し、初回描画時のスナップショット追跡が終わった状態にする。 */
async function layoutAllMarkers(items: LandmarkSpotListItem[] = spotItems): Promise<void> {
  for (const { spot } of items) {
    await fireEvent(screen.getByTestId(`landmark-spot-marker-${spot.id}`), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 30, height: 78 } },
    });
  }
}

/** モックMapViewの onMapReady を発火し、ネイティブ地図の準備完了を再現する。 */
async function fireMapReady(): Promise<void> {
  await act(() => {
    mockMapViewProps.current?.onMapReady?.();
  });
}

describe('パック詳細の埋め込み地図 LandmarkPackMapPreview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMapViewProps.current = null;
  });

  it('全スポットが収まる表示範囲を initialRegion に渡す', async () => {
    await renderPreview();

    // 期待値はパック内の全スポット(retired含む)の外接境界から作った範囲と一致する
    const expectedRegion = createRegionFromBounds({
      minLatitude: 33.675278,
      maxLatitude: 36.767222,
      minLongitude: 135.8875,
      maxLongitude: 140.398333,
    });

    expect(screen.getByTestId('landmark-pack-map').props.initialRegion).toEqual(expectedRegion);
  });

  it('各スポットへマーカーを置き、配列indexベースの1始まりの番号を振る', async () => {
    await renderPreview();

    expect(screen.getByLabelText('1番目のスポット 華厳の滝')).toBeTruthy();
    expect(screen.getByLabelText('2番目のスポット 那智の滝')).toBeTruthy();
    expect(screen.getByLabelText('3番目のスポット 袋田の滝')).toBeTruthy();
    // バッジの表示番号もリスト側と同じ 1,2,3 の連番になる
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('番号バッジをvariant="map"の見た目(白文字・塗りつぶし)で描画する(地図タイル色に左右されないコントラスト確保)', async () => {
    await renderPreview();

    // variant='map'の場合、到達済み・未到達とも landmarkSpotNumberBadgeTextMap(白文字)を使う。
    // list variantならcolorはprimaryText/mutedTextになり#ffffffにはならないため、variant切り替えの検証になる
    const visitedBadgeText = screen.getByText('1');
    expect(StyleSheet.flatten(visitedBadgeText.props.style)).toMatchObject({ color: '#ffffff' });

    const unvisitedBadgeText = screen.getByText('2');
    expect(StyleSheet.flatten(unvisitedBadgeText.props.style)).toMatchObject({ color: '#ffffff' });
  });

  it('focusRequestが変わると、そのスポットの到達エリアの円が余白付きで収まる範囲へアニメーションする', async () => {
    const { rerender } = await renderPreview();
    await fireMapReady();

    await act(async () => {
      await rerender(focusRequestFor('spot-2'));
    });

    expect(mockAnimateToRegion).toHaveBeenCalledTimes(1);
    expect(mockAnimateToRegion).toHaveBeenCalledWith(createLandmarkSpotFocusRegion({ latitude: 33.675278, longitude: 135.8875 }, 650), 250);
  });

  it('同じスポットへ連続で再タップ(nonceだけ増加)しても再アニメーションする', async () => {
    // spotIdだけを見て変化を判定すると、同じ値のためReactが更新をスキップし、
    // 地図を動かしてから同じ行を再タップしてもズームし直せない不具合があった
    const { rerender } = await renderPreview();
    await fireMapReady();

    await act(async () => {
      await rerender(focusRequestFor('spot-2', 1));
    });
    expect(mockAnimateToRegion).toHaveBeenCalledTimes(1);

    await act(async () => {
      await rerender(focusRequestFor('spot-2', 2));
    });

    expect(mockAnimateToRegion).toHaveBeenCalledTimes(2);
    expect(mockAnimateToRegion).toHaveBeenNthCalledWith(
      2,
      createLandmarkSpotFocusRegion({ latitude: 33.675278, longitude: 135.8875 }, 650),
      250,
    );
  });

  it('focusRequestがnullへ戻っても追加のアニメーションは行わず初期表示のズームを保つ', async () => {
    const { rerender } = await renderPreview();
    await fireMapReady();

    await act(async () => {
      await rerender(focusRequestFor('spot-2'));
    });
    mockAnimateToRegion.mockClear();

    await act(async () => {
      await rerender(null);
    });

    expect(mockAnimateToRegion).not.toHaveBeenCalled();
  });

  it('onMapReady前のフォーカス指定はネイティブ側で無視されるため、準備完了まで待ってから移動する', async () => {
    await renderPreview(focusRequestFor('spot-3'));

    expect(mockAnimateToRegion).not.toHaveBeenCalled();

    await fireMapReady();

    expect(mockAnimateToRegion).toHaveBeenCalledWith(
      createLandmarkSpotFocusRegion({ latitude: 36.767222, longitude: 140.398333 }, 200),
      250,
    );
  });

  it('表示できるスポットが1件も無い場合は地図を描画しない', async () => {
    await renderPreview(null, []);

    expect(screen.queryByTestId('landmark-pack-map')).toBeNull();
  });

  it('緯度経度が壊れたスポットはマーカーから除き、番号の連番は残りのスポットで保つ', async () => {
    const brokenItems: LandmarkSpotListItem[] = [
      { spot: createSpot({ id: 'spot-broken', name: '幻の滝', latitude: Number.NaN, longitude: 139 }), visitedLocalDate: null },
      spotItems[1],
    ];

    await renderPreview(null, brokenItems);

    expect(screen.queryByLabelText('1番目のスポット 幻の滝')).toBeNull();
    // 2件目は配列indexのまま2番として描画され、リスト側の番号とズレない
    expect(screen.getByLabelText('2番目のスポット 那智の滝')).toBeTruthy();
  });
  describe('拡大時のスポット詳細(スポット名・解放条件・到達エリアの円)', () => {
    /** パック全体を見渡す初期表示範囲。 */
    const overviewRegion = createRegionFromBounds({
      minLatitude: 33.675278,
      maxLatitude: 36.767222,
      minLongitude: 135.8875,
      maxLongitude: 140.398333,
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('全体を見渡す表示ではスポット名・解放条件・円をどれも出さない', async () => {
      await renderPreview();
      await fireRegionChange(overviewRegion);

      expect(screen.queryByText('華厳の滝')).toBeNull();
      expect(screen.queryByText('1時間30分以上滞在で解放')).toBeNull();
      expect(screen.queryByText('到達済み')).toBeNull();
      expect(screen.queryByTestId('landmark-spot-circle-spot-2')).toBeNull();
    });

    it('寄った範囲を通知すると、そのスポットのスポット名・解放条件・到達エリアの円(半径=radiusMeters)を出す', async () => {
      await renderPreview();
      await fireRegionChange(createLandmarkSpotFocusRegion({ latitude: 33.675278, longitude: 135.8875 }, 650));

      expect(screen.getByText('那智の滝')).toBeTruthy();
      expect(screen.getByText('1時間30分以上滞在で解放')).toBeTruthy();
      const circle = screen.getByTestId('landmark-spot-circle-spot-2');
      expect(circle.props.radius).toBe(650);
      expect(circle.props.center).toEqual({ latitude: 33.675278, longitude: 135.8875 });
      // 滞在場所の設定画面と同じ見た目の薄い円にする
      expect(circle.props.fillColor).toBe(`${lightTheme.colors.primary}24`);
      expect(circle.props.strokeColor).toBe(lightTheme.colors.primary);
      expect(circle.props.strokeWidth).toBe(1);
      // しきい値はスポットごとの半径に連動する。半径200mのスポットは、半径650mのスポットへ寄った範囲ではまだ出さない
      expect(screen.queryByText('華厳の滝')).toBeNull();
      expect(screen.queryByTestId('landmark-spot-circle-spot-1')).toBeNull();
    });

    it('到達済みスポットは解放条件の代わりに「到達済み」を出す', async () => {
      await renderPreview();
      await fireRegionChange(createLandmarkSpotFocusRegion({ latitude: 36.737917, longitude: 139.501972 }, 200));

      const visitedMarker = within(screen.getByTestId('landmark-spot-marker-spot-1'));
      expect(visitedMarker.getByText('華厳の滝')).toBeTruthy();
      expect(visitedMarker.getByText('到達済み')).toBeTruthy();
      expect(visitedMarker.queryByText('3分以上滞在で解放')).toBeNull();
    });

    it('フェード中だけマーカーのビュー変化を追跡し、フェード完了後は止める(Androidのビットマップ撮り直しのため)', async () => {
      jest.useFakeTimers();
      await renderPreview();
      await layoutAllMarkers();
      // 初回描画ぶんの追跡が止まっていることを前提にする
      expect(screen.getByLabelText('2番目のスポット 那智の滝').props.tracksViewChanges).toBe(false);
      await fireRegionChange(createLandmarkSpotFocusRegion({ latitude: 33.675278, longitude: 135.8875 }, 650));

      expect(screen.getByLabelText('2番目のスポット 那智の滝').props.tracksViewChanges).toBe(true);

      await act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(screen.getByLabelText('2番目のスポット 那智の滝').props.tracksViewChanges).toBe(false);
    });

    it('再び広い範囲を通知するとフェードアウトし、完了後にスポット名・解放条件・円を消す', async () => {
      jest.useFakeTimers();
      await renderPreview();
      await layoutAllMarkers();
      // 初回描画ぶんの追跡が止まっていることを前提にする
      expect(screen.getByLabelText('2番目のスポット 那智の滝').props.tracksViewChanges).toBe(false);
      await fireRegionChange(createLandmarkSpotFocusRegion({ latitude: 33.675278, longitude: 135.8875 }, 650));
      await act(() => {
        jest.advanceTimersByTime(1000);
      });

      await fireRegionChange(overviewRegion);
      await act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(screen.queryByText('那智の滝')).toBeNull();
      expect(screen.queryByText('1時間30分以上滞在で解放')).toBeNull();
      expect(screen.queryByTestId('landmark-spot-circle-spot-2')).toBeNull();
      expect(screen.getByLabelText('2番目のスポット 那智の滝').props.tracksViewChanges).toBe(false);
    });

    it('行タップで寄った範囲では、そのスポットの詳細が必ず表示される', async () => {
      const { rerender } = await renderPreview();
      await fireMapReady();

      await act(async () => {
        await rerender(focusRequestFor('spot-3'));
      });
      const [focusRegion] = mockAnimateToRegion.mock.calls[0] as [LandmarkMapRegion];
      await fireRegionChange(focusRegion);

      expect(screen.getByText('袋田の滝')).toBeTruthy();
      expect(screen.getByText('3分以上滞在で解放')).toBeTruthy();
      expect(screen.getByTestId('landmark-spot-circle-spot-3').props.radius).toBe(200);
    });
  });
});
