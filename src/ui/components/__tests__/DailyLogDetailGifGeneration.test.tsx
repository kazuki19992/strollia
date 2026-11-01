import type React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react-native';

import { getLocationPointsByDate } from '@/features/logs/logRepository';
import { lightTheme } from '@/theme/theme';
import { DailyLogDetailScreen } from '@/ui/components/DailyLogDetailScreen';

/**
 * 合成コンポーネント名ごとに、マウント中のインスタンスが受け取った最新propsを保持する。
 * RNTL v14 はホスト要素しか検索できないため、画面外のGIF描画コンポーネントや区間スライダーへ渡したpropsの検証に使う。
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

/** マウント中の指定コンポーネントがちょうど1つであることを確認し、そのpropsを返す。 */
function getMountedProps(name: string): Record<string, any> {
  const all = [...(mockMountedProps[name]?.values() ?? [])];
  if (all.length !== 1) {
    throw new Error(`${name} のマウント数が1ではありません: ${all.length}`);
  }
  return all[0];
}

jest.mock('@/ui/components/GifFrameRenderer', () => {
  const actual = jest.requireActual('@/ui/components/GifFrameRenderer');
  return { ...actual, GifFrameRenderer: mockTrackProps('GifFrameRenderer', actual.GifFrameRenderer) };
});

jest.mock('@/ui/components/RangeSlider', () => {
  const actual = jest.requireActual('@/ui/components/RangeSlider');
  return { ...actual, RangeSlider: mockTrackProps('RangeSlider', actual.RangeSlider) };
});

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
      recordedAt: new Date(2026, 4, 31, 0, 5).toISOString(),
      localDate: '2026-05-31',
      latitude: 35.682,
      longitude: 139.767125,
      altitude: null,
      speed: null,
      heading: null,
      accuracy: 10,
      altitudeAccuracy: null,
    },
  ]),
}));

jest.mock('@/features/location/visitedCellRepository', () => ({
  getVisitedCellsByIds: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/features/achievements/achievementRepository', () => ({
  getAchievementUnlocksByDate: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/features/achievements/achievementDefinitions', () => ({
  getAchievementDefinition: jest.fn(() => null),
}));

jest.mock('@/ui/dailyRouteTimeline', () => ({
  ...jest.requireActual('@/ui/dailyRouteTimeline'),
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
const defaultLocationPoints = [
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
    recordedAt: new Date(2026, 4, 31, 0, 5).toISOString(),
    localDate: '2026-05-31',
    latitude: 35.682,
    longitude: 139.767125,
    altitude: null,
    speed: null,
    heading: null,
    accuracy: 10,
    altitudeAccuracy: null,
  },
];
const mockGetLocationPointsByDate = getLocationPointsByDate as jest.MockedFunction<typeof getLocationPointsByDate>;
describe('DailyLogDetailScreen GIF生成（実ループ）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockGetLocationPointsByDate.mockReset();
    mockGetLocationPointsByDate.mockResolvedValue(defaultLocationPoints);
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  test('日全体でプライバシー適用後の描画可能な線分がなければGIF出力を開始できない', async () => {
    await render(
      <DailyLogDetailScreen
        log={log}
        styles={styles as never}
        theme={lightTheme}
        premiumAccessState={plusAccessState}
        activeStayPlaces={activeStayPlaces}
        onBackToDailyLogs={jest.fn()}
        onOpenPremiumPaywall={jest.fn()}
      />,
    );

    await act(async () => {});

    expect(screen.queryByLabelText('移動記録をGIFで出力')).toBeNull();
  });

  test('選択範囲がすべて非表示ならGIF出力の確定操作を無効化する', async () => {
    mockGetLocationPointsByDate.mockResolvedValue([
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
        recordedAt: new Date(2026, 4, 31, 0, 5).toISOString(),
        localDate: '2026-05-31',
        latitude: 35.6813,
        longitude: 139.7672,
        altitude: null,
        speed: null,
        heading: null,
        accuracy: 10,
        altitudeAccuracy: null,
      },
      {
        id: 3,
        recordedAt: new Date(2026, 4, 31, 0, 20).toISOString(),
        localDate: '2026-05-31',
        latitude: 35.690921,
        longitude: 139.700258,
        altitude: null,
        speed: null,
        heading: null,
        accuracy: 10,
        altitudeAccuracy: null,
      },
      {
        id: 4,
        recordedAt: new Date(2026, 4, 31, 0, 25).toISOString(),
        localDate: '2026-05-31',
        latitude: 35.691,
        longitude: 139.7001,
        altitude: null,
        speed: null,
        heading: null,
        accuracy: 10,
        altitudeAccuracy: null,
      },
    ]);
    await render(
      <DailyLogDetailScreen
        log={log}
        styles={styles as never}
        theme={lightTheme}
        premiumAccessState={plusAccessState}
        activeStayPlaces={activeStayPlaces}
        onBackToDailyLogs={jest.fn()}
        onOpenPremiumPaywall={jest.fn()}
      />,
    );

    await act(async () => {});
    await fireEvent.press(screen.getByLabelText('移動記録をGIFで出力'));
    // RangeSliderの公開callbackを使うのは、両端の選択値を一度に変えるため。
    await act(() => {
      const rangeSlider = getMountedProps('RangeSlider');
      rangeSlider.onChange(rangeSlider.minValue, rangeSlider.minValue + 15);
    });
    await act(async () => {});

    expect(screen.getByLabelText('この範囲で出力')).toBeDisabled();
  });

  test('GIF出力ボタンを押すと初回フレームでデッドロックせず生成・共有まで完了する', async () => {
    const Sharing = require('expo-sharing');

    const { unmount } = await render(
      <DailyLogDetailScreen
        log={log}
        styles={styles as never}
        theme={lightTheme}
        premiumAccessState={plusAccessState}
        activeStayPlaces={[]}
        onBackToDailyLogs={jest.fn()}
        onOpenPremiumPaywall={jest.fn()}
      />,
    );

    // 詳細データ読み込み完了を待つ
    await act(async () => {});

    // GIFボタンを押すと、まず区間指定ダイアログが開く。
    await act(async () => {
      await fireEvent.press(screen.getByLabelText('移動記録をGIFで出力'));
    });

    // 区間指定ダイアログの「この範囲で出力」を押すと生成が始まる（区間は初期値＝記録全体）。
    await act(async () => {
      await fireEvent.press(screen.getByLabelText('この範囲で出力'));
    });

    // isGeneratingGif が true になった際に走る useEffect の RAF を先に消化しておく。
    // これにより、フレーム0の解決は「index の実際の変化に伴う effect 再実行」だけに依存する。
    // 初期値 0 + setGifFrameIndex(0) のバグ実装ではここで再実行が起きず、デッドロックする。
    await act(async () => {
      await flushAnimationFrames();
    });

    // 画面外のGIF描画コンポーネントへ渡したpropsを確認する。
    expect(getMountedProps('GifFrameRenderer').activeStayPlaces).toEqual([]);
    expect(getMountedProps('GifFrameRenderer').altitudePoints).toBeUndefined();

    // 画面外の GifFrameRenderer がマウントされ、地図のタイル描画完了を発火させる
    await act(async () => {
      getMountedProps('GifFrameRenderer').onMapLoaded();
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

    expect(Sharing.shareAsync).toHaveBeenCalledWith('/tmp/strollia-2026-05-31.gif', expect.objectContaining({ mimeType: 'image/gif' }));

    await unmount();
  });

  it('生成中にキャンセルすると共有せず区間選択へ戻る', async () => {
    const Sharing = require('expo-sharing');
    const { unmount } = await render(
      <DailyLogDetailScreen
        log={log}
        styles={styles as never}
        theme={lightTheme}
        premiumAccessState={plusAccessState}
        activeStayPlaces={[]}
        onBackToDailyLogs={jest.fn()}
        onOpenPremiumPaywall={jest.fn()}
      />,
    );
    await act(async () => {});

    await act(async () => {
      await fireEvent.press(screen.getByLabelText('移動記録をGIFで出力'));
    });
    // 「この範囲で出力」を押すと生成が始まり、地図のタイル描画完了待ち（onMapLoaded前）で停止する。
    await act(async () => {
      await fireEvent.press(screen.getByLabelText('この範囲で出力'));
    });

    // 生成中（キャンセルボタンが出ている）状態でキャンセルする。
    await act(async () => {
      await fireEvent.press(screen.getByLabelText('GIF生成をキャンセル'));
    });
    await act(async () => {
      await flushAnimationFrames();
    });

    // 共有されず、区間選択（「この範囲で出力」）へ戻っている。
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
    expect(screen.getByLabelText('この範囲で出力')).toBeTruthy();

    await unmount();
  });

  it('キャンセル直後に再度生成しても、前のループを待ってから生成・共有できる', async () => {
    const Sharing = require('expo-sharing');
    const { unmount } = await render(
      <DailyLogDetailScreen
        log={log}
        styles={styles as never}
        theme={lightTheme}
        premiumAccessState={plusAccessState}
        activeStayPlaces={[]}
        onBackToDailyLogs={jest.fn()}
        onOpenPremiumPaywall={jest.fn()}
      />,
    );
    await act(async () => {});

    await act(async () => {
      await fireEvent.press(screen.getByLabelText('移動記録をGIFで出力'));
    });
    // 1回目の出力 → 地図ロード待ちで停止 → キャンセル。
    await act(async () => {
      await fireEvent.press(screen.getByLabelText('この範囲で出力'));
    });
    await act(async () => {
      await fireEvent.press(screen.getByLabelText('GIF生成をキャンセル'));
    });

    // 2回目の出力。前のループ完了を待ってから新しい生成が走る。
    await act(async () => {
      await fireEvent.press(screen.getByLabelText('この範囲で出力'));
    });
    await act(async () => {
      getMountedProps('GifFrameRenderer').onMapLoaded();
    });
    for (let i = 0; i < 50; i += 1) {
      if (Sharing.shareAsync.mock.calls.length > 0) {
        break;
      }
      await act(async () => {
        await flushAnimationFrames();
      });
    }

    expect(Sharing.shareAsync).toHaveBeenCalledTimes(1);
    expect(Sharing.shareAsync).toHaveBeenCalledWith('/tmp/strollia-2026-05-31.gif', expect.objectContaining({ mimeType: 'image/gif' }));

    await unmount();
  });
});
