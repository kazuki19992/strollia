import { lightTheme } from '../../../theme/theme';
import { DailyLogDetailScreen } from '../DailyLogDetailScreen';
import { GifFrameRenderer } from '../GifFrameRenderer';

jest.mock('@expo/vector-icons', () => ({
  Feather: require('react-native').Text,
  MaterialCommunityIcons: require('react-native').Text,
}));

jest.mock('expo-blur', () => ({
  BlurView: require('react-native').View,
}));

jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn().mockResolvedValue('AAAA'),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: '/tmp/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
}));

// Native GIF encoding leaves are mocked; the real exportRouteGif/buildRouteGif and
// the component's renderFrame/effect coordination are exercised end-to-end.
jest.mock('gifenc', () => ({
  GIFEncoder: () => ({ writeFrame: jest.fn(), finish: jest.fn(), bytes: () => new Uint8Array([0]) }),
  quantize: () => [],
  applyPalette: () => new Uint8Array([0]),
}));
jest.mock('upng-js', () => ({
  __esModule: true,
  default: { decode: () => ({ width: 480, height: 480 }), toRGBA8: () => [new ArrayBuffer(4)] },
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
      recordedAt: new Date(2026, 4, 31, 0, 30).toISOString(),
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
  getVisitedCellsByIds: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../features/achievements/achievementRepository', () => ({
  getAchievementUnlocksByDate: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../features/achievements/achievementDefinitions', () => ({
  getAchievementDefinition: jest.fn(() => null),
}));

jest.mock('../../dailyRouteTimeline', () => ({
  ...jest.requireActual('../../dailyRouteTimeline'),
  getTodayLocalDate: jest.fn(() => '2026-06-04'),
  getCurrentMinutesOfDay: jest.fn(() => 750),
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

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

/** requestAnimationFrame の連鎖を消化する。 */
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

describe('DailyLogDetailScreen GIF生成（実ループ）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('GIF出力ボタンを押すと初回フレームでデッドロックせず生成・共有まで完了する', async () => {
    const Sharing = require('expo-sharing');

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

    // 詳細データ読み込み完了を待つ
    await act(async () => {});

    // GIFボタンを押すと、まず区間指定ダイアログが開く。
    const gifButton = renderer.root.findByProps({ accessibilityLabel: '移動記録をGIFで出力' });
    await act(async () => {
      gifButton.props.onPress();
    });

    // 区間指定ダイアログの「この範囲で出力」を押すと生成が始まる（区間は初期値＝記録全体）。
    const exportButton = renderer.root.findByProps({ accessibilityLabel: 'この範囲で出力' });
    await act(async () => {
      exportButton.props.onPress();
    });

    // isGeneratingGif が true になった際に走る useEffect の RAF を先に消化しておく。
    // これにより、フレーム0の解決は「index の実際の変化に伴う effect 再実行」だけに依存する。
    // 初期値 0 + setGifFrameIndex(0) のバグ実装ではここで再実行が起きず、デッドロックする。
    await act(async () => {
      await flushAnimationFrames();
    });

    // 画面外の GifFrameRenderer がマウントされ、地図のタイル描画完了を発火させる
    await act(async () => {
      renderer.root.findByType(GifFrameRenderer).props.onMapLoaded();
    });

    // RAF駆動のフレーム解決を上限付きで進め、生成完了まで待つ
    for (let i = 0; i < 50; i += 1) {
      if (Sharing.shareAsync.mock.calls.length > 0) {
        break;
      }
      await act(async () => {
        await flushAnimationFrames();
      });
    }

    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      '/tmp/strollia-2026-05-31.gif',
      expect.objectContaining({ mimeType: 'image/gif' }),
    );
  });

  it('生成中にキャンセルすると共有せず区間選択へ戻る', async () => {
    const Sharing = require('expo-sharing');
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

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '移動記録をGIFで出力' }).props.onPress();
    });
    // 「この範囲で出力」を押すと生成が始まり、地図のタイル描画完了待ち（onMapLoaded前）で停止する。
    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: 'この範囲で出力' }).props.onPress();
    });

    // 生成中（キャンセルボタンが出ている）状態でキャンセルする。
    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: 'GIF生成をキャンセル' }).props.onPress();
    });
    await act(async () => {
      await flushAnimationFrames();
    });

    // 共有されず、区間選択（「この範囲で出力」）へ戻っている。
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
    expect(renderer.root.findByProps({ accessibilityLabel: 'この範囲で出力' })).toBeTruthy();
  });
});
