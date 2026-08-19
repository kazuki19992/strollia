import { render, screen, fireEvent, act } from '@testing-library/react-native';

import { getLocationPointAdminAreaName } from '@/features/achievements/adminAreaRepository';
import { getAchievementUnlocksByDate } from '@/features/achievements/achievementRepository';
import { getVisitedCellsByIds } from '@/features/location/visitedCellRepository';
import { getLocationPointsByDate } from '@/features/logs/logRepository';
import { lightTheme } from '@/theme/theme';
import { DailyLogDetailScreen } from '@/ui/components/DailyLogDetailScreen';
import { DailyLogShareCard } from '@/ui/components/DailyLogShareCard';
import { StepSlider } from '@/ui/components/StepSlider';

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
      altitude: null,
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
      altitude: null,
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
    render(
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
    render(
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

    // UNSAFE_getAllByProps を使うのは scrollEnabled と zoomEnabled という非セマンティックな props で MapView を検索するため
    const routeMap = screen.UNSAFE_getAllByProps({ scrollEnabled: true, zoomEnabled: true })[0];
    expect(routeMap).toBeTruthy();
  });

  test('スライダーを動かすと選択時刻までの移動記録だけを地図へ渡す', async () => {
    render(
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

    // UNSAFE_getAllByProps を使うのは strokeWidth と coordinates という非セマンティックな props で Polyline を検索するため
    expect(
      screen.UNSAFE_getAllByProps({}).filter((node) => node.props.strokeWidth === 5 && node.props.coordinates?.length === 2).length,
    ).toBeGreaterThan(0);

    await act(async () => {
      screen.UNSAFE_getByType(StepSlider).props.onValueChange(0);
    });

    expect(
      screen.UNSAFE_getAllByProps({}).filter((node) => node.props.strokeWidth === 5 && node.props.coordinates?.length === 2),
    ).toHaveLength(0);
    expect(screen.getAllByText('0:00').length).toBeGreaterThan(0);
    expect(screen.getByText('24:00')).toBeTruthy();
    expect(screen.queryByText('移動地図を表示できません')).toBeNull();
  });

  test('同じ日付でlogオブジェクトが変わった場合も詳細データを再読み込みする', async () => {
    const { rerender } = render(
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
      rerender(
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
    const { ScrollView } = require('react-native');

    render(
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

    // UNSAFE_getByType を使うのは ScrollView という型で要素を取得するため
    const scrollView = screen.UNSAFE_getByType(ScrollView);
    expect(scrollView.props.scrollEnabled).not.toBe(false);

    await act(async () => {
      screen.UNSAFE_getByType(StepSlider).props.onDragStart?.();
    });

    expect(screen.UNSAFE_getByType(ScrollView).props.scrollEnabled).toBe(false);

    await act(async () => {
      screen.UNSAFE_getByType(StepSlider).props.onDragEnd?.();
    });

    expect(screen.UNSAFE_getByType(ScrollView).props.scrollEnabled).not.toBe(false);
  });

  test('共有の画像生成中に画面を離れると、別画面をキャプチャせず中断する', async () => {
    const { captureRef } = require('react-native-view-shot');
    const Sharing = require('expo-sharing');

    const { unmount } = render(
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
      fireEvent.press(screen.getByLabelText('この日の記録を共有'));
    });

    // 画面を離れる（アンマウント）。
    await act(async () => {
      unmount();
    });

    // 別画面をキャプチャせず、共有もしない。
    expect(captureRef).not.toHaveBeenCalled();
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  test('共有ボタンを押すと詳細コンテンツを画像キャプチャして共有する', async () => {
    const { captureRef } = require('react-native-view-shot');
    const Sharing = require('expo-sharing');

    render(
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
      fireEvent.press(screen.getByLabelText('この日の記録を共有'));
    });

    // 画面外の共有カードがマウントされ、地図のタイル描画完了を発火させるとキャプチャが走る。
    await act(async () => {
      screen.UNSAFE_getByType(DailyLogShareCard).props.onMapLoaded();
      await flushAnimationFrames();
    });

    expect(captureRef).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ format: 'png', quality: 1, result: 'tmpfile' }));
    expect(Sharing.shareAsync).toHaveBeenCalledWith('/tmp/daily-log-detail.png', expect.objectContaining({ mimeType: 'image/png' }));
  });

  test('滞在場所の読込中は共有画像とGIFを開始せず共有用地図もマウントしない', async () => {
    const { captureRef } = require('react-native-view-shot');

    render(
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

    expect(screen.UNSAFE_getAllByProps({ accessibilityLabel: 'この日の記録を共有' })[0].props.disabled).toBe(true);
    expect(screen.queryByLabelText('移動記録をGIFで出力')).toBeNull();

    fireEvent.press(screen.getByLabelText('この日の記録を共有'));

    expect(captureRef).not.toHaveBeenCalled();
    expect(screen.UNSAFE_queryAllByType(DailyLogShareCard)).toHaveLength(0);
  });

  test('滞在場所の読込失敗時は共有を無効化して安全なエラー状態を表示する', async () => {
    render(
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
    expect(screen.UNSAFE_getAllByProps({ accessibilityLabel: 'この日の記録を共有' })[0].props.disabled).toBe(true);
  });

  test('不正な共有時非表示半径を含む場合は日別共有をfail-closedにする', async () => {
    render(
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

    expect(screen.UNSAFE_getAllByProps({ accessibilityLabel: 'この日の記録を共有' })[0].props.disabled).toBe(true);
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

    render(
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
      fireEvent.press(screen.getByLabelText('この日の記録を共有'));
    });

    // UNSAFE_getByType は画面外の共有専用コンポーネントへ渡したpropsを確認するために使う。
    expect(screen.UNSAFE_getByType(DailyLogShareCard).props.activeStayPlaces).toEqual(activeStayPlaces);
  });

  test('今日以外の日付はスライダーの最大値が 24:00 になる', async () => {
    render(
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

    // UNSAFE_getByType を使うのは StepSlider という型で要素を取得するため
    expect(screen.UNSAFE_getByType(StepSlider).props.maxValue).toBe(1440);
  });

  test('今日の日付はスライダーの最大値が現在時刻（30 分単位）までになる', async () => {
    const { getTodayLocalDate, getCurrentMinutesOfDay } = require('../../dailyRouteTimeline');
    getTodayLocalDate.mockReturnValue('2026-05-31');
    getCurrentMinutesOfDay.mockReturnValue(750);

    render(
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

    // UNSAFE_getByType を使うのは StepSlider という型で要素を取得するため
    expect(screen.UNSAFE_getByType(StepSlider).props.maxValue).toBe(750);
  });

  test('今日の 0:00〜0:05 の間はスライダーを非表示にする', async () => {
    const { getTodayLocalDate, getCurrentMinutesOfDay } = require('../../dailyRouteTimeline');
    getTodayLocalDate.mockReturnValue('2026-05-31');
    getCurrentMinutesOfDay.mockReturnValue(3);

    render(
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

    // UNSAFE_queryAllByType を使うのは StepSlider という型で要素が0件であることを確認するため
    expect(screen.UNSAFE_queryAllByType(StepSlider)).toHaveLength(0);
  });

  test('共有処理中は共有ボタンを無効化する', async () => {
    let captureResolve: () => void;
    const { captureRef } = require('react-native-view-shot');
    captureRef.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        captureResolve = () => resolve('/tmp/daily-log-detail.png');
      }),
    );

    render(
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

    expect(screen.UNSAFE_getAllByProps({ accessibilityLabel: 'この日の記録を共有' })[0].props.disabled).toBeFalsy();

    act(() => {
      fireEvent.press(screen.getByLabelText('この日の記録を共有'));
    });

    // 共有中はラベルが「画像を作っています……」に変わり、無効化される。
    // UNSAFE_getAllByProps を使うのは accessibilityLabel と disabled を同時に検証するため
    const sharingButton = screen.UNSAFE_getAllByProps({ accessibilityLabel: '画像を作っています……' })[0];
    expect(sharingButton.props.disabled).toBe(true);

    await act(async () => {
      screen.UNSAFE_getByType(DailyLogShareCard).props.onMapLoaded();
      await flushAnimationFrames();
      captureResolve!();
    });

    expect(screen.UNSAFE_getAllByProps({ accessibilityLabel: 'この日の記録を共有' })[0].props.disabled).toBeFalsy();
  });

  test('Plusユーザーの場合はスライダー・訪問エリア・おもいでが表示される', async () => {
    render(
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
    // UNSAFE_getAllByType を使うのは StepSlider という型で要素件数を確認するため
    expect(screen.UNSAFE_getAllByType(StepSlider).length).toBeGreaterThan(0);
    expect(screen.queryByText('Plusでもっと詳しく！')).toBeNull();
  });

  test('一般ユーザーの場合はスライダー・訪問エリアが非表示でおもいでがブラーされる', async () => {
    render(
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

    // UNSAFE_queryAllByType を使うのは StepSlider という型で要素が0件であることを確認するため
    expect(screen.UNSAFE_queryAllByType(StepSlider)).toHaveLength(0);
    expect(screen.queryByText('訪問したエリア数')).toBeNull();
    expect(screen.queryByText('新しく訪問したエリア数')).toBeNull();
    expect(screen.getByText('Plusでくわしく！')).toBeTruthy();
    expect(screen.getByText('Plusでもっと詳しく！')).toBeTruthy();
  });

  test('一般ユーザーの場合「移動距離は〜」テキストが「移動のデータ」タイトル直下に表示される', async () => {
    render(
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
    render(
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
      fireEvent.press(screen.getByLabelText('Plusでもっと詳しく！'));
    });

    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
