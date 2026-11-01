import type React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';

import { getLocationPointAdminAreaName } from '@/features/achievements/adminAreaRepository';
import { getAchievementUnlocksByDate } from '@/features/achievements/achievementRepository';
import { getVisitedCellsByIds } from '@/features/location/visitedCellRepository';
import { getLocationPointsByDate } from '@/features/logs/logRepository';
import { lightTheme } from '@/theme/theme';
import { DailyLogDetailScreen } from '@/ui/components/DailyLogDetailScreen';
import { DailyLogShareCard } from '@/ui/components/DailyLogShareCard';

/**
 * 合成コンポーネント名ごとに、マウント中のインスタンスが受け取った最新propsを保持する。
 * RNTL v14 はホスト要素しか検索できないため、画面外の共有カードやスライダーへ渡したpropsの検証に使う。
 */
const mockMountedProps: Record<string, Map<object, Record<string, any>>> = {};

/**
 * 実コンポーネントをそのまま描画しつつ、受け取ったpropsを mockMountedProps へ記録するラッパーを作る。
 * jest.mock のファクトリから呼ぶため、巻き上げられる関数宣言にしている。
 */
function mockTrackProps<P extends object>(name: string, Actual: React.ComponentType<P>): React.ComponentType<P> {
  return function TrackedComponent(props: P) {
    const ReactActual = jest.requireActual<typeof React>('react');
    const key = ReactActual.useRef({}).current;
    (mockMountedProps[name] ??= new Map()).set(key, props as Record<string, any>);
    ReactActual.useEffect(
      () => () => {
        mockMountedProps[name]?.delete(key);
      },
      [key],
    );
    return ReactActual.createElement(Actual, props);
  };
}

/** マウント中の指定コンポーネントのprops一覧を返す。 */
function getAllMountedProps(name: string): Record<string, any>[] {
  return [...(mockMountedProps[name]?.values() ?? [])];
}

/** マウント中の指定コンポーネントがちょうど1つであることを確認し、そのpropsを返す。 */
function getMountedProps(name: string): Record<string, any> {
  const all = getAllMountedProps(name);
  if (all.length !== 1) {
    throw new Error(`${name} のマウント数が1ではありません: ${all.length}`);
  }
  return all[0];
}

/** 画面本体の縦スクロール ScrollView(横スクロールの実績一覧を除く)のホスト要素がちょうど1つであることを確認し、返す。 */
function getVerticalScrollView() {
  const nodes = screen.container.queryAll((node) => node.type === 'RCTScrollView' && node.props.horizontal !== true);
  if (nodes.length !== 1) {
    throw new Error(`縦スクロールの ScrollView のホスト要素数が1ではありません: ${nodes.length}`);
  }
  return nodes[0];
}

/** 経路 Polyline(strokeWidth=5 かつ2点)のホスト要素を返す。 */
function queryRoutePolylines() {
  return screen.container.queryAll((node) => node.props.strokeWidth === 5 && node.props.coordinates?.length === 2);
}

jest.mock('@/ui/components/StepSlider', () => {
  const actual = jest.requireActual('@/ui/components/StepSlider');
  return { ...actual, StepSlider: mockTrackProps('StepSlider', actual.StepSlider) };
});

jest.mock('@/ui/components/DailyLogShareCard', () => {
  const actual = jest.requireActual('@/ui/components/DailyLogShareCard');
  return { ...actual, DailyLogShareCard: mockTrackProps('DailyLogShareCard', actual.DailyLogShareCard) };
});

jest.mock('@expo/vector-icons', () => ({
  Feather: require('react-native').Text,
  MaterialCommunityIcons: require('react-native').Text,
}));

jest.mock('expo-blur', () => ({
  BlurView: require('react-native').View,
}));

jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn().mockResolvedValue('/tmp/daily-log-detail.png'),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/achievements/adminAreaRepository', () => ({
  getLocationPointAdminAreaName: jest.fn().mockResolvedValue({ locationPointId: 1, areaName: '船橋市' }),
}));

jest.mock('@/features/logs/logRepository', () => ({
  getLocationPointsByDate: jest.fn().mockResolvedValue([
    {
      id: 1,
      recordedAt: new Date(2026, 4, 31, 0, 0).toISOString(),
      localDate: '2026-05-31',
      latitude: 35.681236,
      longitude: 139.767125,
      altitude: 10,
      speed: null,
      heading: null,
      accuracy: 10,
      altitudeAccuracy: null,
    },
    {
      id: 2,
      recordedAt: new Date(2026, 4, 31, 0, 10).toISOString(),
      localDate: '2026-05-31',
      latitude: 35.690921,
      longitude: 139.700258,
      altitude: 30,
      speed: null,
      heading: null,
      accuracy: 10,
      altitudeAccuracy: null,
    },
  ]),
}));

jest.mock('@/features/location/visitedCellRepository', () => ({
  getVisitedCellsByIds: jest.fn().mockResolvedValue([
    {
      cellId: '100:155582:425804',
      cellSizeMeters: 100,
      x: 155582,
      y: 425804,
      firstVisitedAt: '2026-05-31T00:00:00.000Z',
      lastVisitedAt: '2026-05-31T00:00:00.000Z',
      visitCount: 1,
    },
  ]),
}));

jest.mock('@/features/achievements/achievementRepository', () => ({
  getAchievementUnlocksByDate: jest
    .fn()
    .mockResolvedValue([
      { achievementId: 'distance-100', unlockedAt: '2026-05-31T09:00:00.000Z', unlockedLocalDate: '2026-05-31', progressValue: 100000 },
    ]),
}));

jest.mock('@/features/achievements/achievementDefinitions', () => ({
  getAchievementDefinition: jest.fn(() => ({ id: 'distance-100', title: '100km移動した', trophyImage: { uri: 'badge.png' } })),
}));

jest.mock('@/ui/dailyRouteTimeline', () => ({
  ...jest.requireActual('@/ui/dailyRouteTimeline'),
  getTodayLocalDate: jest.fn(),
  getCurrentMinutesOfDay: jest.fn(),
}));

jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: View,
    Marker: View,
    Polyline: View,
    Polygon: View,
  };
});

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: '/tmp/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
}));

jest.mock('@/features/export/routeGifExporter', () => ({
  exportRouteGif: jest.fn().mockResolvedValue(true),
}));

/** requestAnimationFrame の連鎖（共有キャプチャ前の2フレーム待ち等）を消化する。 */
async function flushAnimationFrames(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
}

const styles = new Proxy({}, { get: (_target, prop) => prop });
const log = {
  localDate: '2026-05-31',
  pointCount: 2,
  startedAt: '2026-05-31T00:00:00.000Z',
  endedAt: '2026-05-31T00:10:00.000Z',
  distanceMeters: 146200,
  startLocationPointId: 1,
  endLocationPointId: 2,
};

const plusAccessState = { isPlusActive: true, entitlementId: 'Strollia Plus' };
const freeAccessState = { isPlusActive: false, entitlementId: 'Strollia Plus' };
const onOpenPremiumPaywall = jest.fn();
const shareAltitudePoints = [
  {
    id: 1,
    recordedAt: new Date(2026, 4, 31, 9, 0).toISOString(),
    localDate: '2026-05-31',
    latitude: 35.681236,
    longitude: 139.767125,
    altitude: 10,
    speed: null,
    heading: null,
    accuracy: 10,
    altitudeAccuracy: null,
  },
  {
    id: 2,
    recordedAt: new Date(2026, 4, 31, 9, 30).toISOString(),
    localDate: '2026-05-31',
    latitude: 35.685,
    longitude: 139.74,
    altitude: 10,
    speed: null,
    heading: null,
    accuracy: 10,
    altitudeAccuracy: null,
  },
  {
    id: 3,
    recordedAt: new Date(2026, 4, 31, 10, 0).toISOString(),
    localDate: '2026-05-31',
    latitude: 35.690921,
    longitude: 139.700258,
    altitude: 20,
    speed: null,
    heading: null,
    accuracy: 10,
    altitudeAccuracy: null,
  },
  {
    id: 4,
    recordedAt: new Date(2026, 4, 31, 10, 30).toISOString(),
    localDate: '2026-05-31',
    latitude: 35.695,
    longitude: 139.68,
    altitude: 30,
    speed: null,
    heading: null,
    accuracy: 10,
    altitudeAccuracy: null,
  },
  {
    id: 5,
    recordedAt: new Date(2026, 4, 31, 11, 0).toISOString(),
    localDate: '2026-05-31',
    latitude: 35.7,
    longitude: 139.66,
    altitude: 30,
    speed: null,
    heading: null,
    accuracy: 10,
    altitudeAccuracy: null,
  },
];

describe('日別ログ詳細画面 DailyLogDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { getTodayLocalDate, getCurrentMinutesOfDay } = require('../../dailyRouteTimeline');
    getTodayLocalDate.mockReturnValue('2026-06-04'); // デフォルト: ログ日付と異なる過去日
    getCurrentMinutesOfDay.mockReturnValue(750);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('共通ヘッダーと移動データ、獲得実績を表示する', async () => {
    await render(
      <DailyLogDetailScreen
        log={log}
        styles={styles as never}
        theme={lightTheme}
        premiumAccessState={plusAccessState}
        activeStayPlaces={[]}
        onBackToDailyLogs={jest.fn()}
        onOpenPremiumPaywall={onOpenPremiumPaywall}
      />,
    );

    // 非同期のデータ読み込みを待つ
    await act(async () => {});

    expect(screen.getByText('日ごとの記録')).toBeTruthy();
    expect(screen.getByText('5月31日')).toBeTruthy();
    expect(screen.getByText('2026年')).toBeTruthy();
    expect(screen.getByText('移動のデータ')).toBeTruthy();
    expect(screen.getByText('移動距離')).toBeTruthy();
    expect(screen.getByText('146.20km')).toBeTruthy();
    expect(screen.getByText('船橋市 ▶ 船橋市')).toBeTruthy();
    expect(screen.getByText('おもいで')).toBeTruthy();
    expect(screen.getByText('高度')).toBeTruthy();
    expect(screen.getAllByText('20m')).toHaveLength(2);
    expect(screen.getByText('この日に獲得した実績')).toBeTruthy();
    expect(screen.getByText('この日の記録を共有')).toBeTruthy();
    expect(screen.getByText('移動距離はGPSのブレにより本来の距離より多く記録される場合があります。')).toBeTruthy();
    expect(screen.queryByText('開始')).toBeNull();
    expect(screen.queryByText('最新')).toBeNull();
    expect(screen.getByLabelText('この日の記録を共有')).toBeTruthy();
    expect(getLocationPointsByDate).toHaveBeenCalledWith('2026-05-31');
    expect(getVisitedCellsByIds).toHaveBeenCalledTimes(1);
    expect(getAchievementUnlocksByDate).toHaveBeenCalledWith('2026-05-31');
    expect(getLocationPointAdminAreaName).toHaveBeenCalledWith(1);
    expect(getLocationPointAdminAreaName).toHaveBeenCalledWith(2);
  });

  test('詳細画面の地図はスクロール可能なMapViewとして表示する', async () => {
    await render(
      <DailyLogDetailScreen
        log={log}
        styles={styles as never}
        theme={lightTheme}
        premiumAccessState={plusAccessState}
        activeStayPlaces={[]}
        onBackToDailyLogs={jest.fn()}
        onOpenPremiumPaywall={onOpenPremiumPaywall}
      />,
    );

    await act(async () => {});

    // scrollEnabled と zoomEnabled という非セマンティックな props で MapView(View としてモック)のホスト要素を検索する
    const routeMap = screen.container.queryAll((node) => node.props.scrollEnabled === true && node.props.zoomEnabled === true)[0];
    expect(routeMap).toBeTruthy();
  });

  test('スライダーを動かすと選択時刻までの移動記録だけを地図へ渡す', async () => {
    await render(
      <DailyLogDetailScreen
        log={log}
        styles={styles as never}
        theme={lightTheme}
        premiumAccessState={plusAccessState}
        onBackToDailyLogs={jest.fn()}
        onOpenPremiumPaywall={onOpenPremiumPaywall}
      />,
    );

    await act(async () => {});

    // strokeWidth と coordinates という非セマンティックな props で Polyline のホスト要素を検索する
    expect(queryRoutePolylines().length).toBeGreaterThan(0);

    await act(async () => {
      getMountedProps('StepSlider').onValueChange(0);
    });

    expect(queryRoutePolylines()).toHaveLength(0);
    expect(screen.getAllByText('0:00').length).toBeGreaterThan(0);
    expect(screen.getByText('24:00')).toBeTruthy();
    expect(screen.queryByText('移動地図を表示できません')).toBeNull();
  });

  test('同じ日付でlogオブジェクトが変わった場合も詳細データを再読み込みする', async () => {
    const { rerender } = await render(
      <DailyLogDetailScreen
        log={log}
        styles={styles as never}
        theme={lightTheme}
        premiumAccessState={plusAccessState}
        onBackToDailyLogs={jest.fn()}
        onOpenPremiumPaywall={onOpenPremiumPaywall}
      />,
    );
    await act(async () => {});

    expect(getLocationPointsByDate).toHaveBeenCalledTimes(1);

    await act(async () => {
      await rerender(
        <DailyLogDetailScreen
          log={{ ...log, distanceMeters: 147000, endLocationPointId: 3 }}
          styles={styles as never}
          theme={lightTheme}
          premiumAccessState={plusAccessState}
          onBackToDailyLogs={jest.fn()}
          onOpenPremiumPaywall={onOpenPremiumPaywall}
        />,
      );
    });

    expect(getLocationPointsByDate).toHaveBeenCalledTimes(2);
    expect(getLocationPointsByDate).toHaveBeenLastCalledWith('2026-05-31');
  });

  test('スライダーのドラッグ中は ScrollView のスクロールを無効化する', async () => {
    await render(
      <DailyLogDetailScreen
        log={log}
        styles={styles as never}
        theme={lightTheme}
        premiumAccessState={plusAccessState}
        onBackToDailyLogs={jest.fn()}
        onOpenPremiumPaywall={onOpenPremiumPaywall}
      />,
    );

    await act(async () => {});

    // scrollEnabled という非セマンティックな props を検証するため ScrollView のホスト要素を取得する
    const scrollView = getVerticalScrollView();
    expect(scrollView.props.scrollEnabled).not.toBe(false);

    await act(async () => {
      getMountedProps('StepSlider').onDragStart?.();
    });

    expect(getVerticalScrollView().props.scrollEnabled).toBe(false);

    await act(async () => {
      getMountedProps('StepSlider').onDragEnd?.();
    });

    expect(getVerticalScrollView().props.scrollEnabled).not.toBe(false);
  });

  test('共有の画像生成中に画面を離れると、別画面をキャプチャせず中断する', async () => {
    const { captureRef } = require('react-native-view-shot');
    const Sharing = require('expo-sharing');

    const { unmount } = await render(
      <DailyLogDetailScreen
        log={log}
        styles={styles as never}
        theme={lightTheme}
        premiumAccessState={plusAccessState}
        activeStayPlaces={[]}
        onBackToDailyLogs={jest.fn()}
        onOpenPremiumPaywall={onOpenPremiumPaywall}
      />,
    );

    await act(async () => {});

    // 共有開始（地図ロード完了 onMapLoaded はまだ発火させない＝キャプチャ前で待機中）。
    await act(async () => {
      await fireEvent.press(screen.getByLabelText('この日の記録を共有'));
    });

    // 画面を離れる（アンマウント）。
    await act(async () => {
      await unmount();
    });

    // 別画面をキャプチャせず、共有もしない。
    expect(captureRef).not.toHaveBeenCalled();
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  test('共有ボタンを押すと詳細コンテンツを画像キャプチャして共有する', async () => {
    const { captureRef } = require('react-native-view-shot');
    const Sharing = require('expo-sharing');

    await render(
      <DailyLogDetailScreen
        log={log}
        styles={styles as never}
        theme={lightTheme}
        premiumAccessState={plusAccessState}
        activeStayPlaces={[]}
        onBackToDailyLogs={jest.fn()}
        onOpenPremiumPaywall={onOpenPremiumPaywall}
      />,
    );

    await act(async () => {});

    await act(async () => {
      await fireEvent.press(screen.getByLabelText('この日の記録を共有'));
    });

    expect(getMountedProps('DailyLogShareCard').altitudePoints).toHaveLength(2);

    // 画面外の共有カードがマウントされ、地図のタイル描画完了を発火させるとキャプチャが走る。
    await act(async () => {
      getMountedProps('DailyLogShareCard').onMapLoaded();
      await flushAnimationFrames();
    });

    expect(captureRef).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ format: 'png', quality: 1, result: 'tmpfile' }));
    expect(Sharing.shareAsync).toHaveBeenCalledWith('/tmp/daily-log-detail.png', expect.objectContaining({ mimeType: 'image/png' }));
  });

  test('高度を含む詳細データの読込中は共有を開始しない', async () => {
    const { captureRef } = require('react-native-view-shot');
    let resolvePoints: ((points: unknown[]) => void) | undefined;
    (getLocationPointsByDate as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePoints = resolve;
        }),
    );

    await render(
      <DailyLogDetailScreen
        log={log}
        styles={styles as never}
        theme={lightTheme}
        premiumAccessState={plusAccessState}
        activeStayPlaces={[]}
        onBackToDailyLogs={jest.fn()}
        onOpenPremiumPaywall={onOpenPremiumPaywall}
      />,
    );

    expect(screen.getByLabelText('この日の記録を共有')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('この日の記録を共有'));
    expect(captureRef).not.toHaveBeenCalled();
    expect(getAllMountedProps('DailyLogShareCard')).toHaveLength(0);

    await act(async () => {
      resolvePoints?.([]);
    });
  });

  test('PNG共有カードはPlusの有効高度だけを表示する', async () => {
    const baseProps = {
      width: 390,
      points: shareAltitudePoints,
      activeStayPlaces: [],
      regionPoints: shareAltitudePoints,
      altitudePoints: shareAltitudePoints,
      distanceLabel: '1.00km',
      routeEndpointsLabel: '船橋市 ▶ 船橋市',
      dailyDetailReport: null,
      isLoadingDetail: false,
      dateLabel: '2026年5月31日 (日)',
      styles: styles as never,
      theme: lightTheme,
      onMapLoaded: jest.fn(),
    };
    const { rerender } = await render(<DailyLogShareCard {...baseProps} isPlusActive />);

    expect(screen.getByText('高度')).toBeTruthy();
    expect(screen.getByText('10m')).toBeTruthy();
    expect(screen.getByText('30m')).toBeTruthy();

    await rerender(<DailyLogShareCard {...baseProps} isPlusActive={false} />);
    expect(screen.queryByText('高度')).toBeNull();

    await rerender(
      <DailyLogShareCard {...baseProps} altitudePoints={shareAltitudePoints.map((point) => ({ ...point, altitude: null }))} isPlusActive />,
    );
    expect(screen.queryByText('高度')).toBeNull();
    expect(screen.queryByText('高度データを表示できません')).toBeNull();
  });

  test('Plusでも有効高度が不足する画面ではデータ不足を表示する', async () => {
    (getLocationPointsByDate as jest.Mock).mockResolvedValueOnce(shareAltitudePoints.map((point) => ({ ...point, altitude: null })));

    await render(
      <DailyLogDetailScreen
        log={log}
        styles={styles as never}
        theme={lightTheme}
        premiumAccessState={plusAccessState}
        activeStayPlaces={[]}
        onBackToDailyLogs={jest.fn()}
        onOpenPremiumPaywall={onOpenPremiumPaywall}
      />,
    );

    await act(async () => {});
    expect(screen.getByText('高度')).toBeTruthy();
    expect(screen.getByText('高度データを表示できません')).toBeTruthy();
  });

  test('滞在場所の読込中は共有画像とGIFを開始せず共有用地図もマウントしない', async () => {
    const { captureRef } = require('react-native-view-shot');

    await render(
      <DailyLogDetailScreen
        log={log}
        styles={styles as never}
        theme={lightTheme}
        premiumAccessState={plusAccessState}
        activeStayPlaces={null}
        onBackToDailyLogs={jest.fn()}
        onOpenPremiumPaywall={onOpenPremiumPaywall}
      />,
    );

    await act(async () => {});

    expect(screen.getByLabelText('この日の記録を共有')).toBeDisabled();
    expect(screen.queryByLabelText('移動記録をGIFで出力')).toBeNull();

    await fireEvent.press(screen.getByLabelText('この日の記録を共有'));

    expect(captureRef).not.toHaveBeenCalled();
    expect(getAllMountedProps('DailyLogShareCard')).toHaveLength(0);
  });

  test('滞在場所の読込失敗時は共有を無効化して安全なエラー状態を表示する', async () => {
    await render(
      <DailyLogDetailScreen
        log={log}
        styles={styles as never}
        theme={lightTheme}
        premiumAccessState={plusAccessState}
        activeStayPlaces={null}
        stayPlacesStatus="error"
        onBackToDailyLogs={jest.fn()}
        onOpenPremiumPaywall={onOpenPremiumPaywall}
      />,
    );

    await act(async () => {});

    expect(screen.getByText('滞在場所を読み込めないため、共有を準備できません。')).toBeTruthy();
    expect(screen.getByLabelText('この日の記録を共有')).toBeDisabled();
  });

  test('不正な共有時非表示半径を含む場合は日別共有をfail-closedにする', async () => {
    await render(
      <DailyLogDetailScreen
        log={log}
        styles={styles as never}
        theme={lightTheme}
        premiumAccessState={plusAccessState}
        activeStayPlaces={[
          {
            id: 1,
            name: '自宅',
            iconHexcode: '1F3E0',
            latitude: 35.681236,
            longitude: 139.767125,
            privacyRadiusMeters: 50,
            createdAt: '2026-08-20T00:00:00.000Z',
            updatedAt: '2026-08-20T00:00:00.000Z',
          },
        ]}
        stayPlacesStatus="ready"
        onBackToDailyLogs={jest.fn()}
        onOpenPremiumPaywall={onOpenPremiumPaywall}
      />,
    );

    await act(async () => {});

    expect(screen.getByLabelText('この日の記録を共有')).toBeDisabled();
    expect(screen.queryByLabelText('移動記録をGIFで出力')).toBeNull();
  });

  test('共有画像には有効な滞在場所の非表示範囲を渡す', async () => {
    const activeStayPlaces = [
      {
        id: 1,
        name: '自宅',
        iconHexcode: '1F3E0',
        latitude: 35.681236,
        longitude: 139.767125,
        privacyRadiusMeters: 100,
        createdAt: '2026-08-19T00:00:00.000Z',
        updatedAt: '2026-08-19T00:00:00.000Z',
      },
    ];

    await render(
      <DailyLogDetailScreen
        log={log}
        styles={styles as never}
        theme={lightTheme}
        premiumAccessState={plusAccessState}
        activeStayPlaces={activeStayPlaces}
        onBackToDailyLogs={jest.fn()}
        onOpenPremiumPaywall={onOpenPremiumPaywall}
      />,
    );

    await act(async () => {});
    await act(async () => {
      await fireEvent.press(screen.getByLabelText('この日の記録を共有'));
    });

    // 画面外の共有専用コンポーネントへ渡したpropsを確認する。
    expect(getMountedProps('DailyLogShareCard').activeStayPlaces).toEqual(activeStayPlaces);
  });

  test('今日以外の日付はスライダーの最大値が 24:00 になる', async () => {
    await render(
      <DailyLogDetailScreen
        log={log}
        styles={styles as never}
        theme={lightTheme}
        premiumAccessState={plusAccessState}
        activeStayPlaces={[]}
        onBackToDailyLogs={jest.fn()}
        onOpenPremiumPaywall={onOpenPremiumPaywall}
      />,
    );

    await act(async () => {});

    // StepSlider へ渡したpropsを確認する
    expect(getMountedProps('StepSlider').maxValue).toBe(1440);
  });

  test('今日の日付はスライダーの最大値が現在時刻（30 分単位）までになる', async () => {
    const { getTodayLocalDate, getCurrentMinutesOfDay } = require('../../dailyRouteTimeline');
    getTodayLocalDate.mockReturnValue('2026-05-31');
    getCurrentMinutesOfDay.mockReturnValue(750);

    await render(
      <DailyLogDetailScreen
        log={log}
        styles={styles as never}
        theme={lightTheme}
        premiumAccessState={plusAccessState}
        onBackToDailyLogs={jest.fn()}
        onOpenPremiumPaywall={onOpenPremiumPaywall}
      />,
    );

    await act(async () => {});

    // StepSlider へ渡したpropsを確認する
    expect(getMountedProps('StepSlider').maxValue).toBe(750);
  });

  test('今日の 0:00〜0:05 の間はスライダーを非表示にする', async () => {
    const { getTodayLocalDate, getCurrentMinutesOfDay } = require('../../dailyRouteTimeline');
    getTodayLocalDate.mockReturnValue('2026-05-31');
    getCurrentMinutesOfDay.mockReturnValue(3);

    await render(
      <DailyLogDetailScreen
        log={log}
        styles={styles as never}
        theme={lightTheme}
        premiumAccessState={plusAccessState}
        onBackToDailyLogs={jest.fn()}
        onOpenPremiumPaywall={onOpenPremiumPaywall}
      />,
    );

    await act(async () => {});

    // StepSlider がマウントされていないことを確認する
    expect(getAllMountedProps('StepSlider')).toHaveLength(0);
  });

  test('共有処理中は共有ボタンを無効化する', async () => {
    let captureResolve: () => void;
    const { captureRef } = require('react-native-view-shot');
    captureRef.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        captureResolve = () => resolve('/tmp/daily-log-detail.png');
      }),
    );

    await render(
      <DailyLogDetailScreen
        log={log}
        styles={styles as never}
        theme={lightTheme}
        premiumAccessState={plusAccessState}
        activeStayPlaces={[]}
        onBackToDailyLogs={jest.fn()}
        onOpenPremiumPaywall={onOpenPremiumPaywall}
      />,
    );

    await act(async () => {});

    expect(screen.getByLabelText('この日の記録を共有')).not.toBeDisabled();

    await act(async () => {
      await fireEvent.press(screen.getByLabelText('この日の記録を共有'));
    });

    // 共有中はラベルが「画像を作っています……」に変わり、無効化される。
    expect(screen.getByLabelText('画像を作っています……')).toBeDisabled();

    await act(async () => {
      getMountedProps('DailyLogShareCard').onMapLoaded();
      await flushAnimationFrames();
      captureResolve!();
    });

    expect(screen.getByLabelText('この日の記録を共有')).not.toBeDisabled();
  });

  test('Plusユーザーの場合はスライダー・訪問エリア・おもいでが表示される', async () => {
    await render(
      <DailyLogDetailScreen
        log={log}
        styles={styles as never}
        theme={lightTheme}
        premiumAccessState={plusAccessState}
        onBackToDailyLogs={jest.fn()}
        onOpenPremiumPaywall={jest.fn()}
      />,
    );

    await act(async () => {});

    expect(screen.getByText('おもいで')).toBeTruthy();
    expect(screen.getByText('訪問したエリア数')).toBeTruthy();
    expect(screen.getByText('新しく訪問したエリア数')).toBeTruthy();
    // StepSlider がマウントされていることを確認する
    expect(getAllMountedProps('StepSlider').length).toBeGreaterThan(0);
    expect(screen.queryByText('Plusでもっと詳しく！')).toBeNull();
  });

  test('一般ユーザーの場合はスライダー・訪問エリアが非表示でおもいでがブラーされる', async () => {
    await render(
      <DailyLogDetailScreen
        log={log}
        styles={styles as never}
        theme={lightTheme}
        premiumAccessState={freeAccessState}
        onBackToDailyLogs={jest.fn()}
        onOpenPremiumPaywall={jest.fn()}
      />,
    );

    await act(async () => {});

    // StepSlider がマウントされていないことを確認する
    expect(getAllMountedProps('StepSlider')).toHaveLength(0);
    expect(screen.queryByText('訪問したエリア数')).toBeNull();
    expect(screen.queryByText('新しく訪問したエリア数')).toBeNull();
    expect(screen.getByText('Plusでくわしく！')).toBeTruthy();
    expect(screen.getByText('Plusでもっと詳しく！')).toBeTruthy();
    expect(screen.queryByText('高度')).toBeNull();
    expect(screen.queryByText('高度データを表示できません')).toBeNull();
  });

  test('一般ユーザーの場合「移動距離は〜」テキストが「移動のデータ」タイトル直下に表示される', async () => {
    await render(
      <DailyLogDetailScreen
        log={log}
        styles={styles as never}
        theme={lightTheme}
        premiumAccessState={freeAccessState}
        onBackToDailyLogs={jest.fn()}
        onOpenPremiumPaywall={jest.fn()}
      />,
    );

    await act(async () => {});

    expect(screen.getByText('移動距離はGPSのブレにより本来の距離より多く記録される場合があります。')).toBeTruthy();
  });

  test('一般ユーザーの場合「Plusでもっと詳しく！」ボタンを押すと onOpenPremiumPaywall が呼ばれる', async () => {
    const onOpen = jest.fn();
    await render(
      <DailyLogDetailScreen
        log={log}
        styles={styles as never}
        theme={lightTheme}
        premiumAccessState={freeAccessState}
        onBackToDailyLogs={jest.fn()}
        onOpenPremiumPaywall={onOpen}
      />,
    );

    await act(async () => {});

    await act(async () => {
      await fireEvent.press(screen.getByLabelText('Plusでもっと詳しく！'));
    });

    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
