import { act, render, screen } from '@testing-library/react-native';

import type { LandmarkSpot } from '@/features/landmarks/landmarkCatalog';
import { createRegionFromBounds } from '@/features/map/routeMapper';
import { lightTheme } from '@/theme/theme';
import { createStyles } from '@/ui/appStyles';
import { LandmarkPackMapPreview, type LandmarkSpotFocusRequest } from '@/ui/components/LandmarkPackMapPreview';
import type { LandmarkSpotListItem } from '@/ui/hooks/useLandmarkPackState';
import { createUserCenteredRegion } from '@/ui/mapRegion';

/** モックMapViewのrefへ差し込む animateToRegion。フォーカス移動先の検証に使う。 */
const mockAnimateToRegion = jest.fn();

/** 最後に描画されたモックMapViewのprops。initialRegion検証と onMapReady の手動発火に使う。 */
const mockMapViewProps: { current: { initialRegion?: unknown; onMapReady?: () => void } | null } = { current: null };

jest.mock('react-native-maps', () => {
  const React = require('react'); // eslint-disable-line @typescript-eslint/no-require-imports
  const { View } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports

  type MockMapComponentProps = Record<string, unknown> & { children?: React.ReactNode };

  // 実 MapView は描画できないため、ref へ animateToRegion だけを差し込んだ View で代替する。
  // onMapReady はテストから明示的に発火させたいので、propsを外へ公開して自動発火はしない。
  const MapViewMock = React.forwardRef((props: MockMapComponentProps, ref: React.Ref<unknown>) => {
    // mock定義側のローカル型と、テスト本体側で参照する型が構造的には同じでも別名として扱われるため明示キャストする
    mockMapViewProps.current = props as { initialRegion?: unknown; onMapReady?: () => void };
    React.useImperativeHandle(ref, () => ({ animateToRegion: mockAnimateToRegion }));

    return React.createElement(View, props, props.children);
  });
  MapViewMock.displayName = 'MapViewMock';
  const MarkerMock = (props: MockMapComponentProps) => React.createElement(View, props, props.children);
  MarkerMock.displayName = 'MarkerMock';

  return { __esModule: true, default: MapViewMock, Marker: MarkerMock };
});

const styles = createStyles(lightTheme);

/** スポット1件を組み立てる。地図表示に必要な緯度経度以外は既定値で足りる。 */
function createSpot(overrides: Pick<LandmarkSpot, 'id' | 'name' | 'latitude' | 'longitude'>): LandmarkSpot {
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
    spot: createSpot({ id: 'spot-2', name: '那智の滝', latitude: 33.675278, longitude: 135.8875 }),
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
function renderPreview(focusRequest: LandmarkSpotFocusRequest = null, items: LandmarkSpotListItem[] = spotItems) {
  const view = render(<LandmarkPackMapPreview spotItems={items} focusRequest={focusRequest} styles={styles} theme={lightTheme} />);

  return {
    rerender: (nextFocusRequest: LandmarkSpotFocusRequest, nextItems: LandmarkSpotListItem[] = items) =>
      view.rerender(<LandmarkPackMapPreview spotItems={nextItems} focusRequest={nextFocusRequest} styles={styles} theme={lightTheme} />),
  };
}

/** モックMapViewの onMapReady を発火し、ネイティブ地図の準備完了を再現する。 */
function fireMapReady(): void {
  act(() => {
    mockMapViewProps.current?.onMapReady?.();
  });
}

describe('パック詳細の埋め込み地図 LandmarkPackMapPreview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMapViewProps.current = null;
  });

  it('全スポットが収まる表示範囲を initialRegion に渡す', () => {
    renderPreview();

    // 期待値はパック内の全スポット(retired含む)の外接境界から作った範囲と一致する
    const expectedRegion = createRegionFromBounds({
      minLatitude: 33.675278,
      maxLatitude: 36.767222,
      minLongitude: 135.8875,
      maxLongitude: 140.398333,
    });

    expect(screen.getByTestId('landmark-pack-map').props.initialRegion).toEqual(expectedRegion);
  });

  it('各スポットへマーカーを置き、配列indexベースの1始まりの番号を振る', () => {
    renderPreview();

    expect(screen.getByLabelText('1番目のスポット 華厳の滝')).toBeTruthy();
    expect(screen.getByLabelText('2番目のスポット 那智の滝')).toBeTruthy();
    expect(screen.getByLabelText('3番目のスポット 袋田の滝')).toBeTruthy();
    // バッジの表示番号もリスト側と同じ 1,2,3 の連番になる
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('focusRequestが変わるとそのスポット中心へアニメーションする', () => {
    const { rerender } = renderPreview();
    fireMapReady();

    act(() => {
      rerender(focusRequestFor('spot-2'));
    });

    expect(mockAnimateToRegion).toHaveBeenCalledTimes(1);
    expect(mockAnimateToRegion).toHaveBeenCalledWith(createUserCenteredRegion({ latitude: 33.675278, longitude: 135.8875 }), 250);
  });

  it('同じスポットへ連続で再タップ(nonceだけ増加)しても再アニメーションする', () => {
    // spotIdだけを見て変化を判定すると、同じ値のためReactが更新をスキップし、
    // 地図を動かしてから同じ行を再タップしてもズームし直せない不具合があった
    const { rerender } = renderPreview();
    fireMapReady();

    act(() => {
      rerender(focusRequestFor('spot-2', 1));
    });
    expect(mockAnimateToRegion).toHaveBeenCalledTimes(1);

    act(() => {
      rerender(focusRequestFor('spot-2', 2));
    });

    expect(mockAnimateToRegion).toHaveBeenCalledTimes(2);
    expect(mockAnimateToRegion).toHaveBeenNthCalledWith(2, createUserCenteredRegion({ latitude: 33.675278, longitude: 135.8875 }), 250);
  });

  it('focusRequestがnullへ戻っても追加のアニメーションは行わず初期表示のズームを保つ', () => {
    const { rerender } = renderPreview();
    fireMapReady();

    act(() => {
      rerender(focusRequestFor('spot-2'));
    });
    mockAnimateToRegion.mockClear();

    act(() => {
      rerender(null);
    });

    expect(mockAnimateToRegion).not.toHaveBeenCalled();
  });

  it('onMapReady前のフォーカス指定はネイティブ側で無視されるため、準備完了まで待ってから移動する', () => {
    renderPreview(focusRequestFor('spot-3'));

    expect(mockAnimateToRegion).not.toHaveBeenCalled();

    fireMapReady();

    expect(mockAnimateToRegion).toHaveBeenCalledWith(createUserCenteredRegion({ latitude: 36.767222, longitude: 140.398333 }), 250);
  });

  it('表示できるスポットが1件も無い場合は地図を描画しない', () => {
    renderPreview(null, []);

    expect(screen.queryByTestId('landmark-pack-map')).toBeNull();
  });

  it('緯度経度が壊れたスポットはマーカーから除き、番号の連番は残りのスポットで保つ', () => {
    const brokenItems: LandmarkSpotListItem[] = [
      { spot: createSpot({ id: 'spot-broken', name: '幻の滝', latitude: Number.NaN, longitude: 139 }), visitedLocalDate: null },
      spotItems[1],
    ];

    renderPreview(null, brokenItems);

    expect(screen.queryByLabelText('1番目のスポット 幻の滝')).toBeNull();
    // 2件目は配列indexのまま2番として描画され、リスト側の番号とズレない
    expect(screen.getByLabelText('2番目のスポット 那智の滝')).toBeTruthy();
  });
});
