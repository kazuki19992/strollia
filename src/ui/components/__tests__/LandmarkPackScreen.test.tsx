import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { LandmarkPack, LandmarkSpot } from '@/features/landmarks/landmarkCatalog';
import { createUserCenteredRegion } from '@/ui/mapRegion';
import { lightTheme } from '@/theme/theme';
import { createStyles } from '@/ui/appStyles';
import { LANDMARK_SPOT_RETIRED_NOTE } from '@/ui/appText';
import { LandmarkPackScreen } from '@/ui/components/LandmarkPackScreen';
import type { LandmarkSpotListItem } from '@/ui/hooks/useLandmarkPackState';

jest.mock('@expo/vector-icons', () => ({
  Feather: require('react-native').Text,
}));

/** モックMapViewのrefへ差し込む animateToRegion。未到達行タップ時のズーム先の検証に使う。 */
const mockAnimateToRegion = jest.fn();

/**
 * 埋め込み地図(LandmarkPackMapPreview)は実MapViewを描画できないためモックする。
 * この画面テストの関心は「未到達行を押すと地図がそのスポットへズームすること」であり、
 * LandmarkPackMapPreview自体の初期表示範囲計算などは別ファイルで検証済み。
 */
jest.mock('react-native-maps', () => {
  const React = require('react'); // eslint-disable-line @typescript-eslint/no-require-imports
  const { View } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports

  const MapViewMock = React.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({ animateToRegion: mockAnimateToRegion }));
    React.useEffect(() => {
      (props.onMapReady as (() => void) | undefined)?.();
    }, [props.onMapReady]);

    return React.createElement(View, props, props.children);
  });
  MapViewMock.displayName = 'MapViewMock';
  const MarkerMock = (props: Record<string, unknown>) => React.createElement(View, props, props.children);
  MarkerMock.displayName = 'MarkerMock';

  return { __esModule: true, default: MapViewMock, Marker: MarkerMock };
});

const styles = createStyles(lightTheme);

/** テスト用の日本三名瀑パック。 */
const pack: LandmarkPack = {
  id: '01a0c450-6c00-7000-8000-000000000001',
  name: '日本三名瀑',
  description: '日本を代表する3つの名瀑',
  trophyImage: 1,
  trophyImageUri: null,
  sortOrder: 100,
};

/** スポット1件を組み立てる。到達日以外はパック詳細の表示に必要な最小構成。 */
function createSpot(overrides: Partial<LandmarkSpot> & Pick<LandmarkSpot, 'id' | 'name' | 'prefectures'>): LandmarkSpot {
  return {
    latitude: 36.737917,
    longitude: 139.501972,
    radiusMeters: 200,
    dwellSeconds: 180,
    packs: [{ packId: pack.id, order: 1 }],
    ...overrides,
  };
}

/** 到達済み1件・未到達1件のスポット行。 */
const spotItems: LandmarkSpotListItem[] = [
  {
    spot: createSpot({ id: '01a0c450-6c00-7000-8000-000000000101', name: '華厳の滝', prefectures: ['TOCHIGI'] }),
    visitedLocalDate: '2026-04-12',
  },
  {
    spot: createSpot({ id: '01a0c450-6c00-7000-8000-000000000102', name: '那智の滝', prefectures: ['WAKAYAMA'] }),
    visitedLocalDate: null,
  },
];

/** パック詳細画面を描画する。 */
function renderScreen(
  overrides: Partial<{
    spotItems: LandmarkSpotListItem[];
    onBack: () => void;
    onSelectVisitedSpot: (localDate: string) => void;
  }> = {},
) {
  render(
    <LandmarkPackScreen
      pack={pack}
      spotItems={overrides.spotItems ?? spotItems}
      styles={styles}
      theme={lightTheme}
      onBack={overrides.onBack ?? jest.fn()}
      onSelectVisitedSpot={overrides.onSelectVisitedSpot ?? jest.fn()}
    />,
  );
}

describe('パック詳細画面 LandmarkPackScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // SafeAreaView の deprecation 警告でテスト出力が埋まるのを避ける(既存テストと同じ扱い)
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ヘッダーにパック名と分数の進捗を表示する', () => {
    renderScreen();

    expect(screen.getByText('日本三名瀑')).toBeTruthy();
    expect(screen.getByText('1/2')).toBeTruthy();
  });

  it('スポット名・都道府県・到達日を並べる', () => {
    renderScreen();

    expect(screen.getByText('華厳の滝')).toBeTruthy();
    expect(screen.getByText('栃木県')).toBeTruthy();
    expect(screen.getByText('2026/04/12')).toBeTruthy();
    expect(screen.getByText('那智の滝')).toBeTruthy();
    expect(screen.getByText('和歌山県')).toBeTruthy();
  });

  it('先頭から何番目かを1始まりの番号バッジで表示する(order生値ではなく配列indexを使う)', () => {
    renderScreen();

    // 埋め込み地図にも同じ番号のマーカーが出るため、リスト行と合わせて2箇所ずつ現れる
    expect(screen.getAllByText('1')).toHaveLength(2);
    expect(screen.getAllByText('2')).toHaveLength(2);
  });

  it('到達済みの行だけ訪問済みスタンプを表示する', () => {
    renderScreen();

    expect(screen.getAllByLabelText('訪問済み')).toHaveLength(1);
  });

  it('到達済みの行を押すとその日の記録へ遷移する', () => {
    const onSelectVisitedSpot = jest.fn();
    renderScreen({ onSelectVisitedSpot });

    act(() => {
      fireEvent.press(screen.getByLabelText('華厳の滝の記録を開く'));
    });

    expect(onSelectVisitedSpot).toHaveBeenCalledWith('2026-04-12');
  });

  it('未到達の行を押すと埋め込み地図がそのスポットへズームする', () => {
    renderScreen();

    act(() => {
      fireEvent.press(screen.getByLabelText('那智の滝を地図で見る'));
    });

    const nachiSpot = spotItems[1]?.spot;
    expect(mockAnimateToRegion).toHaveBeenCalledWith(
      createUserCenteredRegion({ latitude: nachiSpot?.latitude, longitude: nachiSpot?.longitude }),
      expect.any(Number),
    );
  });

  it('戻るボタンで実績一覧へ戻る', () => {
    const onBack = jest.fn();
    renderScreen({ onBack });

    act(() => {
      fireEvent.press(screen.getByLabelText('実績へ戻る'));
    });

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('スポットが1件も無い場合でも進捗を0件として表示する', () => {
    renderScreen({ spotItems: [] });

    expect(screen.getByText('0/0')).toBeTruthy();
  });

  describe('現存しないスポット(retired)', () => {
    /** 未到達のまま現存しなくなったスポットを含む行。 */
    const retiredSpotItems: LandmarkSpotListItem[] = [
      ...spotItems,
      {
        spot: createSpot({
          id: '01a0c450-6c00-7000-8000-000000000199',
          name: '幻の滝',
          prefectures: ['IBARAKI'],
          retired: true,
        }),
        visitedLocalDate: null,
      },
    ];

    it('都道府県と併記して現存しないことを示す', () => {
      renderScreen({ spotItems: retiredSpotItems });

      expect(screen.getByText(`茨城県・${LANDMARK_SPOT_RETIRED_NOTE}`)).toBeTruthy();
    });

    it('完走判定の分母から外す', () => {
      renderScreen({ spotItems: retiredSpotItems });

      expect(screen.getByText('1/2')).toBeTruthy();
    });

    it('押下時は未到達と同じ扱いで地図がズームする', () => {
      renderScreen({ spotItems: retiredSpotItems });

      act(() => {
        fireEvent.press(screen.getByLabelText('幻の滝を地図で見る'));
      });

      const retiredSpot = retiredSpotItems[2]?.spot;
      expect(mockAnimateToRegion).toHaveBeenCalledWith(
        createUserCenteredRegion({ latitude: retiredSpot?.latitude, longitude: retiredSpot?.longitude }),
        expect.any(Number),
      );
    });
  });
});
