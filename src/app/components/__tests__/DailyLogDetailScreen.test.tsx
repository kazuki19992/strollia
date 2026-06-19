import { Text } from 'react-native';

import { getLocationPointAdminAreaName } from '../../../features/achievements/adminAreaRepository';
import { getAchievementUnlocksByDate } from '../../../features/achievements/achievementRepository';
import { getVisitedCellsByIds } from '../../../features/location/visitedCellRepository';
import { getLocationPointsByDate } from '../../../features/logs/logRepository';
import { lightTheme } from '../../../theme/theme';
import { DailyLogDetailScreen } from '../DailyLogDetailScreen';
import { DailyLogShareCard } from '../DailyLogShareCard';
import { StepSlider } from '../StepSlider';

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

jest.mock('../../../features/achievements/adminAreaRepository', () => ({
  getLocationPointAdminAreaName: jest.fn().mockResolvedValue({ locationPointId: 1, areaName: '船橋市' }),
}));

jest.mock('../../../features/logs/logRepository', () => ({
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

jest.mock('../../../features/location/visitedCellRepository', () => ({
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

jest.mock('../../../features/achievements/achievementRepository', () => ({
  getAchievementUnlocksByDate: jest.fn().mockResolvedValue([
    { achievementId: 'distance-100', unlockedAt: '2026-05-31T09:00:00.000Z', unlockedLocalDate: '2026-05-31', progressValue: 100000 },
  ]),
}));

jest.mock('../../../features/achievements/achievementDefinitions', () => ({
  getAchievementDefinition: jest.fn(() => ({ id: 'distance-100', title: '100km移動した', trophyImage: { uri: 'badge.png' } })),
}));

jest.mock('../../dailyRouteTimeline', () => ({
  ...jest.requireActual('../../dailyRouteTimeline'),
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

jest.mock('../../../features/export/routeGifExporter', () => ({
  exportRouteGif: jest.fn().mockResolvedValue(true),
}));

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

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
    let renderer: any;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DailyLogDetailScreen log={log} styles={styles as never} theme={lightTheme} premiumAccessState={plusAccessState} onBackToDailyLogs={jest.fn()} onOpenPremiumPaywall={onOpenPremiumPaywall} />,
      );
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).toEqual(expect.arrayContaining(['日ごとの記録', '5月31日', '2026年', '移動のデータ', '移動距離', '146.20km', '船橋市 ▶ 船橋市', 'おもいで', 'この日に獲得した実績', 'この日の記録を共有', '移動距離はGPSのブレにより本来の距離より多く記録される場合があります。']));
    expect(texts).not.toContain('開始');
    expect(texts).not.toContain('最新');
    expect(renderer.root.findByProps({ accessibilityLabel: 'この日の記録を共有' })).toBeTruthy();
    expect(getLocationPointsByDate).toHaveBeenCalledWith('2026-05-31');
    expect(getVisitedCellsByIds).toHaveBeenCalledTimes(1);
    expect(getAchievementUnlocksByDate).toHaveBeenCalledWith('2026-05-31');
    expect(getLocationPointAdminAreaName).toHaveBeenCalledWith(1);
    expect(getLocationPointAdminAreaName).toHaveBeenCalledWith(2);
  });

  test('詳細画面の地図はスクロール可能なMapViewとして表示する', async () => {
    let renderer: any;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DailyLogDetailScreen log={log} styles={styles as never} theme={lightTheme} premiumAccessState={plusAccessState} onBackToDailyLogs={jest.fn()} onOpenPremiumPaywall={onOpenPremiumPaywall} />,
      );
    });

    const routeMap = renderer.root.findAll((node: any) => node.props.scrollEnabled === true && node.props.zoomEnabled === true)[0];

    expect(routeMap).toBeTruthy();
  });

  test('スライダーを動かすと選択時刻までの移動記録だけを地図へ渡す', async () => {
    let renderer: any;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DailyLogDetailScreen log={log} styles={styles as never} theme={lightTheme} premiumAccessState={plusAccessState} onBackToDailyLogs={jest.fn()} onOpenPremiumPaywall={onOpenPremiumPaywall} />,
      );
    });

    expect(renderer.root.findAll((node: any) => node.props.strokeWidth === 5 && node.props.coordinates?.length === 2).length).toBeGreaterThan(0);

    await act(async () => {
      renderer.root.findByType(StepSlider).props.onValueChange(0);
    });

    expect(renderer.root.findAll((node: any) => node.props.strokeWidth === 5 && node.props.coordinates?.length === 2)).toHaveLength(0);
    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).toEqual(expect.arrayContaining(['0:00', '24:00']));
    expect(texts).not.toContain('移動地図を表示できません');
  });

  test('同じ日付でlogオブジェクトが変わった場合も詳細データを再読み込みする', async () => {
    let renderer: any;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DailyLogDetailScreen log={log} styles={styles as never} theme={lightTheme} premiumAccessState={plusAccessState} onBackToDailyLogs={jest.fn()} onOpenPremiumPaywall={onOpenPremiumPaywall} />,
      );
    });

    expect(getLocationPointsByDate).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer.update(
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

    let renderer: any;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DailyLogDetailScreen log={log} styles={styles as never} theme={lightTheme} premiumAccessState={plusAccessState} onBackToDailyLogs={jest.fn()} onOpenPremiumPaywall={onOpenPremiumPaywall} />,
      );
    });

    const scrollView = renderer.root.findByType(ScrollView);
    expect(scrollView.props.scrollEnabled).not.toBe(false);

    await act(async () => {
      renderer.root.findByType(StepSlider).props.onDragStart?.();
    });

    expect(scrollView.props.scrollEnabled).toBe(false);

    await act(async () => {
      renderer.root.findByType(StepSlider).props.onDragEnd?.();
    });

    expect(scrollView.props.scrollEnabled).not.toBe(false);
  });

  test('共有の画像生成中に画面を離れると、別画面をキャプチャせず中断する', async () => {
    const { captureRef } = require('react-native-view-shot');
    const Sharing = require('expo-sharing');

    let renderer: any;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DailyLogDetailScreen log={log} styles={styles as never} theme={lightTheme} premiumAccessState={plusAccessState} onBackToDailyLogs={jest.fn()} onOpenPremiumPaywall={onOpenPremiumPaywall} />,
      );
    });

    // 共有開始（地図ロード完了 onMapLoaded はまだ発火させない＝キャプチャ前で待機中）。
    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: 'この日の記録を共有' }).props.onPress();
    });

    // 画面を離れる（アンマウント）。
    await act(async () => {
      renderer.unmount();
    });

    // 別画面をキャプチャせず、共有もしない。
    expect(captureRef).not.toHaveBeenCalled();
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  test('共有ボタンを押すと詳細コンテンツを画像キャプチャして共有する', async () => {
    const { captureRef } = require('react-native-view-shot');
    const Sharing = require('expo-sharing');

    let renderer: any;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DailyLogDetailScreen log={log} styles={styles as never} theme={lightTheme} premiumAccessState={plusAccessState} onBackToDailyLogs={jest.fn()} onOpenPremiumPaywall={onOpenPremiumPaywall} />,
      );
    });

    const shareButton = renderer.root.findByProps({ accessibilityLabel: 'この日の記録を共有' });
    await act(async () => {
      shareButton.props.onPress();
    });

    // 画面外の共有カードがマウントされ、地図のタイル描画完了を発火させるとキャプチャが走る。
    await act(async () => {
      renderer.root.findByType(DailyLogShareCard).props.onMapLoaded();
      await flushAnimationFrames();
    });

    expect(captureRef).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ format: 'png', quality: 1, result: 'tmpfile' }),
    );
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      '/tmp/daily-log-detail.png',
      expect.objectContaining({ mimeType: 'image/png' }),
    );
  });

  test('今日以外の日付はスライダーの最大値が 24:00 になる', async () => {
    let renderer: any;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DailyLogDetailScreen log={log} styles={styles as never} theme={lightTheme} premiumAccessState={plusAccessState} onBackToDailyLogs={jest.fn()} onOpenPremiumPaywall={onOpenPremiumPaywall} />,
      );
    });

    expect(renderer.root.findByType(StepSlider).props.maxValue).toBe(1440);
  });

  test('今日の日付はスライダーの最大値が現在時刻（30 分単位）までになる', async () => {
    const { getTodayLocalDate, getCurrentMinutesOfDay } = require('../../dailyRouteTimeline');
    getTodayLocalDate.mockReturnValue('2026-05-31');
    getCurrentMinutesOfDay.mockReturnValue(750);

    let renderer: any;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DailyLogDetailScreen log={log} styles={styles as never} theme={lightTheme} premiumAccessState={plusAccessState} onBackToDailyLogs={jest.fn()} onOpenPremiumPaywall={onOpenPremiumPaywall} />,
      );
    });

    expect(renderer.root.findByType(StepSlider).props.maxValue).toBe(750);
  });

  test('今日の 0:00〜0:05 の間はスライダーを非表示にする', async () => {
    const { getTodayLocalDate, getCurrentMinutesOfDay } = require('../../dailyRouteTimeline');
    getTodayLocalDate.mockReturnValue('2026-05-31');
    getCurrentMinutesOfDay.mockReturnValue(3);

    let renderer: any;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DailyLogDetailScreen log={log} styles={styles as never} theme={lightTheme} premiumAccessState={plusAccessState} onBackToDailyLogs={jest.fn()} onOpenPremiumPaywall={onOpenPremiumPaywall} />,
      );
    });

    expect(renderer.root.findAllByType(StepSlider)).toHaveLength(0);
  });

  test('共有処理中は共有ボタンを無効化する', async () => {
    let captureResolve: () => void;
    const { captureRef } = require('react-native-view-shot');
    captureRef.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        captureResolve = () => resolve('/tmp/daily-log-detail.png');
      }),
    );

    let renderer: any;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DailyLogDetailScreen log={log} styles={styles as never} theme={lightTheme} premiumAccessState={plusAccessState} onBackToDailyLogs={jest.fn()} onOpenPremiumPaywall={onOpenPremiumPaywall} />,
      );
    });

    expect(renderer.root.findByProps({ accessibilityLabel: 'この日の記録を共有' }).props.disabled).toBeFalsy();

    act(() => {
      renderer.root.findByProps({ accessibilityLabel: 'この日の記録を共有' }).props.onPress();
    });

    // 共有中はラベルが「画像を作っています……」に変わり、無効化される。
    expect(renderer.root.findByProps({ accessibilityLabel: '画像を作っています……' }).props.disabled).toBe(true);

    await act(async () => {
      renderer.root.findByType(DailyLogShareCard).props.onMapLoaded();
      await flushAnimationFrames();
      captureResolve!();
    });

    expect(renderer.root.findByProps({ accessibilityLabel: 'この日の記録を共有' }).props.disabled).toBeFalsy();
  });

  test('Plusユーザーの場合はスライダー・訪問エリア・おもいでが表示される', async () => {
    let renderer: any;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DailyLogDetailScreen
          log={log}
          styles={styles as never}
          theme={lightTheme}
          premiumAccessState={plusAccessState}
          onBackToDailyLogs={jest.fn()}
          onOpenPremiumPaywall={jest.fn()}
        />,
      );
    });

    await act(async () => {});

    const texts = renderer.root.findAllByType(Text).map((n: any) => n.props.children);
    expect(texts).toEqual(expect.arrayContaining(['おもいで', '訪問したエリア数', '新しく訪問したエリア数']));
    expect(renderer.root.findAllByType(StepSlider).length).toBeGreaterThan(0);
    expect(texts).not.toContain('Plusでもっと詳しく！');
  });

  test('一般ユーザーの場合はスライダー・訪問エリアが非表示でおもいでがブラーされる', async () => {
    let renderer: any;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DailyLogDetailScreen
          log={log}
          styles={styles as never}
          theme={lightTheme}
          premiumAccessState={freeAccessState}
          onBackToDailyLogs={jest.fn()}
          onOpenPremiumPaywall={jest.fn()}
        />,
      );
    });

    await act(async () => {});

    const texts = renderer.root.findAllByType(Text).map((n: any) => n.props.children);
    expect(renderer.root.findAllByType(StepSlider)).toHaveLength(0);
    expect(texts).not.toContain('訪問したエリア数');
    expect(texts).not.toContain('新しく訪問したエリア数');
    expect(texts).toEqual(expect.arrayContaining(['Plusでくわしく！']));
    expect(texts).toEqual(expect.arrayContaining(['Plusでもっと詳しく！']));
  });

  test('一般ユーザーの場合「移動距離は〜」テキストが「移動のデータ」タイトル直下に表示される', async () => {
    let renderer: any;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DailyLogDetailScreen
          log={log}
          styles={styles as never}
          theme={lightTheme}
          premiumAccessState={freeAccessState}
          onBackToDailyLogs={jest.fn()}
          onOpenPremiumPaywall={jest.fn()}
        />,
      );
    });

    await act(async () => {});

    const texts = renderer.root.findAllByType(Text).map((n: any) => n.props.children);
    expect(texts).toEqual(expect.arrayContaining(['移動距離はGPSのブレにより本来の距離より多く記録される場合があります。']));
  });

  test('一般ユーザーの場合「Plusでもっと詳しく！」ボタンを押すと onOpenPremiumPaywall が呼ばれる', async () => {
    const onOpen = jest.fn();
    let renderer: any;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DailyLogDetailScreen
          log={log}
          styles={styles as never}
          theme={lightTheme}
          premiumAccessState={freeAccessState}
          onBackToDailyLogs={jest.fn()}
          onOpenPremiumPaywall={onOpen}
        />,
      );
    });

    await act(async () => {});

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: 'Plusでもっと詳しく！' }).props.onPress();
    });

    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
