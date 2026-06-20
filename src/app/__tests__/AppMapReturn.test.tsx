import App from '../App';
import { createUserCenteredRegion } from '../mapRegion';
import { Alert, AppState, Pressable, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getVisitedCellsInBounds } from '../../features/location/visitedCellRepository';
import { getGridBoundsForRegion, isGridBoundsContained } from '../../features/location/grid/gridCell';
import { getLocationPermissionState } from '../../features/location/locationPermission';
import {
  isBackgroundLocationRecording,
  startBackgroundLocationRecording,
  stopBackgroundLocationRecording,
  updateBackgroundLocationTaskOptionsIfNeeded,
} from '../../features/location/locationService';
import { resolveUserLocationIcon } from '../../features/customization/customizationResolver';
import { deleteManagedCustomIcon, resolveCustomIconReference } from '../../features/customization/customIconStorage';
import { replaceCustomIconSelection } from '../../features/customization/customIconSelection';
import { getDailyLogs } from '../../features/logs/logRepository';
import { pickAndReadGpxFile } from '../../features/import/gpxImportService';
import { parseGpxToLocationPoints } from '../../features/import/gpxImporter';
import { importLocationPointsFromGpx } from '../../features/import/importRepository';
import { GpxImportProgressDialog } from '../components/GpxImportProgressDialog';
import {
  getPremiumAccessState,
  getPremiumOfferingSummary,
  getRevenueCatAppUserId,
  presentPremiumCustomerCenter,
  purchasePremiumPackage,
  restorePremiumPurchases,
  subscribePremiumAccessStateUpdates,
} from '../../features/premium/revenueCatAccess';
import { getBooleanSetting, getStringSetting, setSetting, setSettings } from '../../features/settings/settingsRepository';
import { requestAchievementNotificationPermissionOnFirstLaunch } from '../../features/achievements/achievementNotificationService';

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'Light' },
  impactAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ accessPrivileges: 'all' }),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('../../config/sentry', () => ({
  updateSentryScreenContext: jest.fn(),
  updateSentrySubscriptionContext: jest.fn(),
  updateSentryUserContext: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');

  return {
    AntDesign: Text,
    Entypo: Text,
    Feather: Text,
    MaterialCommunityIcons: Text,
    MaterialIcons: Text,
  };
});

const mockAnimateToRegion = jest.fn();
let mockLatestSettingsScreenProps: any = null;
let mockLatestMapScreenProps: any = null;
let mockLatestMonthlyReportScreenProps: any = null;
let mockLatestFirstLaunchTutorialProps: any = null;
let mockLatestForegroundLocationOptions: any = null;
let mockPremiumCustomerInfoUpdate: ((state: { isPlusActive: boolean; entitlementId: string }) => void) | null = null;
const mockPremiumUnsubscribe = jest.fn();

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

jest.mock('../components/MapScreen', () => ({
  MapScreen: (props: any) => {
    const { Pressable, Text } = require('react-native');

    mockLatestMapScreenProps = props;
    props.mapRef.current = { animateToRegion: mockAnimateToRegion };

    return (
      <>
        <Pressable accessibilityLabel="現在地更新" onPress={() => props.onUserLocationChange({
          nativeEvent: {
            coordinate: { latitude: 35.681236, longitude: 139.767125, speed: 1 },
          },
        })}>
          <Text>現在地更新</Text>
        </Pressable>
        <Pressable accessibilityLabel="不正な現在地更新" onPress={() => props.onUserLocationChange({
          nativeEvent: {
            coordinate: { latitude: Number.NaN, longitude: 139.767125, speed: 1 },
          },
        })}>
          <Text>不正な現在地更新</Text>
        </Pressable>
        <Pressable accessibilityLabel="現在地へ戻る" onPress={props.onRecenterOnUserLocation}>
          <Text>現在地へ戻る</Text>
        </Pressable>
        <Pressable accessibilityLabel="現在地中心へ地図移動" onPress={() => props.onRegionChangeComplete({
          latitude: 35.681236,
          longitude: 139.767125,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        })}>
          <Text>現在地中心へ地図移動</Text>
        </Pressable>
        <Pressable accessibilityLabel="地図をドラッグ" onPress={props.onPanDrag}>
          <Text>地図をドラッグ</Text>
        </Pressable>
        <Pressable accessibilityLabel="日ごとの記録" onPress={props.onOpenDailyLogs}>
          <Text>日ごとの記録</Text>
        </Pressable>
        <Pressable accessibilityLabel="設定" onPress={props.onOpenSettings}>
          <Text>設定</Text>
        </Pressable>
        <Pressable accessibilityLabel="月次レポート" onPress={props.onOpenMonthlyReport}>
          <Text>月次レポート</Text>
        </Pressable>
      </>
    );
  },
}));

jest.mock('../components/DailyLogsScreen', () => ({
  DailyLogsScreen: (props: any) => {
    const { Pressable, Text } = require('react-native');

    return (
      <>
        <Pressable accessibilityLabel="地図へ" onPress={props.onBackToMap}>
          <Text>地図へ</Text>
        </Pressable>
        <Pressable accessibilityLabel="日別詳細を開く" onPress={() => props.onOpenDailyLogDetail(props.dailyLogs[0])}>
          <Text>詳細を開く</Text>
        </Pressable>
      </>
    );
  },
}));

jest.mock('../components/PremiumPaywallModal', () => ({
  PremiumPaywallModal: (props: any) => {
    const { Pressable, Text } = require('react-native');

    if (!props.visible) return null;

    return (
      <>
        <Pressable accessibilityLabel="月払いで購入" onPress={props.onPurchaseMonthlyPremiumPackage}>
          <Text>月払いで購入</Text>
        </Pressable>
        <Pressable accessibilityLabel="購入を復元" onPress={props.onRestorePremiumPurchases}>
          <Text>購入を復元</Text>
        </Pressable>
      </>
    );
  },
}));

jest.mock('../components/DailyLogDetailScreen', () => ({
  DailyLogDetailScreen: ({ onBackToDailyLogs }: { onBackToDailyLogs: () => void }) => {
    const { Pressable, Text } = require('react-native');

    return (
      <Pressable accessibilityLabel="日別詳細から一覧へ戻る" onPress={onBackToDailyLogs}>
        <Text>日ごとの記録</Text>
      </Pressable>
    );
  },
}));

jest.mock('../components/AchievementListScreen', () => ({
  AchievementListScreen: () => null,
}));

jest.mock('../components/AchievementUnlockModal', () => ({
  AchievementUnlockModal: () => null,
}));

jest.mock('../components/FirstLaunchTutorialDialog', () => ({
  FirstLaunchTutorialDialog: (props: any) => {
    const { Pressable, Text } = require('react-native');
    mockLatestFirstLaunchTutorialProps = props;

    if (!props.visible) return null;

    return (
      <Pressable accessibilityLabel="初回チュートリアルを完了" onPress={props.onComplete}>
        <Text>初回チュートリアル</Text>
      </Pressable>
    );
  },
}));

jest.mock('../components/PhotoPreviewModals', () => ({
  PhotoPreviewModals: () => null,
}));

jest.mock('../components/reports/MonthlyReportScreen', () => ({
  MonthlyReportScreen: (props: any) => {
    mockLatestMonthlyReportScreenProps = props;
    return null;
  },
}));

jest.mock('../components/SettingsScreen', () => ({
  SettingsScreen: (props: any) => {
    mockLatestSettingsScreenProps = props;
    const { Pressable, Text } = require('react-native');

    return (
      <>
        <Pressable accessibilityLabel="チュートリアルを開く" onPress={props.onOpenFirstLaunchTutorial}>
          <Text>チュートリアル</Text>
        </Pressable>
        <Pressable accessibilityLabel="OSSライセンス" onPress={props.onOpenLicenseScreen}>
          <Text>OSSライセンス</Text>
        </Pressable>
        <Pressable accessibilityLabel="カスタムアイコンを選ぶ" onPress={() => props.onUpdateUserLocationIcon('custom')}>
          <Text>カスタムアイコン</Text>
        </Pressable>
      </>
    );
  },
}));

jest.mock('../components/LicenseScreen', () => ({
  LicenseScreen: ({
    onBackToSettings,
    onOpenLicenseDetail,
  }: {
    onBackToSettings: () => void;
    onOpenLicenseDetail: (license: { id: string; name: string }) => void;
  }) => {
    const { Pressable, Text } = require('react-native');

    return (
      <>
        <Pressable accessibilityLabel="設定画面へ戻る" onPress={onBackToSettings}>
          <Text>設定</Text>
        </Pressable>
        <Pressable accessibilityLabel="react のライセンス詳細を開く" onPress={() => onOpenLicenseDetail({ id: 'react@19.1.0', name: 'react' })}>
          <Text>react</Text>
        </Pressable>
      </>
    );
  },
  LicenseDetailScreen: ({ onBackToLicenseList }: { onBackToLicenseList: () => void }) => {
    const { Pressable, Text } = require('react-native');

    return (
      <Pressable accessibilityLabel="ライセンス一覧へ戻る" onPress={onBackToLicenseList}>
        <Text>ライセンス</Text>
      </Pressable>
    );
  },
}));

jest.mock('../hooks/useAchievementDialogEffects', () => ({
  useAchievementDialogEffects: jest.fn(),
}));

jest.mock('../hooks/useKeepScreenAwake', () => ({
  useKeepScreenAwake: jest.fn(),
}));

jest.mock('../hooks/usePhotoMapOverlay', () => ({
  usePhotoMapOverlay: () => ({ photos: [], isLoadingPhotos: false, photoErrorMessage: null }),
}));

jest.mock('../hooks/useScreenTransitionOpacity', () => ({
  useScreenTransitionOpacity: () => ({ interpolate: () => 0 }),
}));

jest.mock('../hooks/useCurrentAreaName', () => ({
  useCurrentAreaLabel: () => ({ primary: '船橋市', secondary: '行田' }),
}));

jest.mock('../hooks/useForegroundUserLocation', () => ({
  useForegroundUserLocation: (options: unknown) => {
    mockLatestForegroundLocationOptions = options;
  },
}));

jest.mock('../../db/database', () => ({
  initializeDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../theme/fonts', () => ({
  loadAppFonts: jest.fn().mockResolvedValue(undefined),
  NUMERIC_DISPLAY_FONT: 'DSEG7ClassicMini-Regular',
}));

jest.mock('../../config/developmentFlags', () => ({
  hasEnabledDevelopmentFlags: jest.fn(() => false),
  shouldResetAchievementsOnLaunch: jest.fn(() => false),
}));

jest.mock('../../features/settings/settingsRepository', () => ({
  getBooleanSetting: jest.fn().mockResolvedValue(false),
  getStringSetting: jest.fn().mockResolvedValue('default'),
  setSetting: jest.fn().mockResolvedValue(undefined),
  setSettings: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../features/customization/customIconStorage', () => ({
  deleteManagedCustomIcon: jest.fn().mockResolvedValue(undefined),
  resolveCustomIconReference: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../features/customization/customIconSelection', () => ({
  replaceCustomIconSelection: jest.fn(),
}));

jest.mock('../../features/location/locationService', () => ({
  isBackgroundLocationRecording: jest.fn().mockResolvedValue(true),
  updateBackgroundLocationTaskOptionsIfNeeded: jest.fn().mockResolvedValue(undefined),
  startBackgroundLocationRecording: jest.fn().mockResolvedValue(undefined),
  stopBackgroundLocationRecording: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../features/location/locationPermission', () => ({
  canRequestLocationPermissionInApp: jest.fn(() => true),
  getLocationPermissionState: jest.fn().mockResolvedValue({
    foregroundGranted: true,
    backgroundGranted: true,
    canAskForeground: true,
    canAskBackground: true,
  }),
  hasRequiredLocationPermission: jest.fn((state) => state.foregroundGranted && state.backgroundGranted),
  isWhileInUseOnlyMode: jest.fn((state) => state.foregroundGranted && !state.backgroundGranted),
}));

jest.mock('../../features/logs/logRepository', () => ({
  deleteAllUserData: jest.fn().mockResolvedValue(undefined),
  getAllLocationPoints: jest.fn().mockResolvedValue([]),
  getDailyLogs: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../features/achievements/achievementNotificationService', () => ({
  initializeAchievementNotificationHandler: jest.fn(),
  requestAchievementNotificationPermissionOnFirstLaunch: jest.fn().mockResolvedValue(undefined),
  setupAchievementNotificationChannel: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../features/achievements/achievementRepository', () => ({
  getAchievementListItems: jest.fn().mockResolvedValue([]),
  getPendingInAppAchievementNotifications: jest.fn().mockResolvedValue([]),
  markAchievementShownInApp: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../features/achievements/achievementEvaluationGate', () => ({
  canEvaluateAchievementsInForeground: jest.fn(() => true),
}));

jest.mock('../../features/achievements/achievementService', () => ({
  evaluateAchievementsAndNotify: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../features/achievements/pendingNotifications', () => ({
  filterDismissedAchievementNotifications: jest.fn(() => []),
}));

jest.mock('../../features/export/gpxExporter', () => ({
  shareGpx: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../features/import/gpxImportService', () => ({
  pickAndReadGpxFile: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../features/import/gpxImporter', () => ({
  parseGpxToLocationPoints: jest.fn().mockReturnValue([]),
}));

jest.mock('../../features/import/importRepository', () => ({
  importLocationPointsFromGpx: jest.fn().mockResolvedValue({ importedPointCount: 0, skippedPointCount: 0 }),
}));

jest.mock('../../features/reports/monthlyAreaReport', () => ({
  getMonthlyAreaReport: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../features/reports/monthlyReport', () => jest.requireActual('../../features/reports/monthlyReport'));

jest.mock('../../features/customization/customizationResolver', () => ({
  resolveUserLocationIcon: jest.fn(() => ({ useNativeUserLocation: true, customIconId: null })),
}));

jest.mock('../../features/customization/customizationOptions', () => ({
  DEFAULT_USER_LOCATION_ICON_ID: 'default',
  getUserLocationIconOption: jest.fn((id: string) => ({
    id,
    label: id === 'walker' ? 'さんぽ' : 'OS標準',
    premium: id === 'walker',
  })),
}));

jest.mock('../../features/premium/revenueCatAccess', () => ({
  getDefaultPremiumAccessState: jest.fn(() => ({ isPlusActive: false, entitlementId: 'strollia_plus' })),
  getPremiumAccessState: jest.fn().mockResolvedValue({ isPlusActive: true, entitlementId: 'strollia_plus' }),
  getPremiumOfferingSummary: jest.fn().mockResolvedValue(null),
  getRevenueCatAppUserId: jest.fn().mockResolvedValue(null),
  presentPremiumCustomerCenter: jest.fn().mockResolvedValue(true),
  purchasePremiumPackage: jest.fn().mockResolvedValue({ status: 'purchased', accessState: { isPlusActive: true, entitlementId: 'strollia_plus' } }),
  restorePremiumPurchases: jest.fn().mockResolvedValue({ isPlusActive: true, entitlementId: 'strollia_plus' }),
  subscribePremiumAccessStateUpdates: jest.fn((onUpdate) => {
    mockPremiumCustomerInfoUpdate = onUpdate;
    return mockPremiumUnsubscribe;
  }),
}));

jest.mock('../../features/photos/photoClusters', () => ({
  clusterMapPhotos: jest.fn(() => []),
  paginateMapPhotos: jest.fn(() => []),
}));

jest.mock('../../features/photos/photoLibrary', () => ({
  hasFullPhotoAccess: jest.fn(() => true),
}));

jest.mock('../../features/location/visitedCellRepository', () => ({
  getVisitedCellsInBounds: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../features/location/grid/gridCell', () => ({
  getGridBoundsForRegion: jest.fn((region: any) => ({
    minX: Math.round(region.latitude * 1000),
    maxX: Math.round(region.longitude * 1000),
    minY: Math.round(region.latitudeDelta * 1000),
    maxY: Math.round(region.longitudeDelta * 1000),
  })),
  isGridBoundsContained: jest.fn(() => false),
}));

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

const flushPromises = async () => {
  await act(async () => {
    for (let index = 0; index < 5; index += 1) {
      await Promise.resolve();
    }
  });
};

describe('App 地図復帰時の表示範囲復元', () => {
  let renderer: any;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active', writable: true });
    mockLatestSettingsScreenProps = null;
    mockLatestMapScreenProps = null;
    mockLatestMonthlyReportScreenProps = null;
    mockLatestFirstLaunchTutorialProps = null;
    mockLatestForegroundLocationOptions = null;
    mockPremiumCustomerInfoUpdate = null;
    (getLocationPermissionState as jest.Mock).mockResolvedValue({
      foregroundGranted: true,
      backgroundGranted: true,
      canAskForeground: true,
      canAskBackground: true,
    });
    (isBackgroundLocationRecording as jest.Mock).mockResolvedValue(true);
    (startBackgroundLocationRecording as jest.Mock).mockResolvedValue(undefined);
    (stopBackgroundLocationRecording as jest.Mock).mockResolvedValue(undefined);
    (updateBackgroundLocationTaskOptionsIfNeeded as jest.Mock).mockResolvedValue(undefined);
    (resolveUserLocationIcon as jest.Mock).mockReturnValue({ useNativeUserLocation: true, customIconId: null });
    (getBooleanSetting as jest.Mock).mockImplementation((key: string, fallback: boolean) => {
      if (key === 'firstLaunchTutorialCompleted') {
        return Promise.resolve(false);
      }

      return Promise.resolve(fallback);
    });
    (setSetting as jest.Mock).mockResolvedValue(undefined);
    (setSettings as jest.Mock).mockResolvedValue(undefined);
    (getPremiumAccessState as jest.Mock).mockResolvedValue({ isPlusActive: true, entitlementId: 'strollia_plus' });
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => Promise.resolve(fallback));
    (resolveCustomIconReference as jest.Mock).mockResolvedValue(null);
    (deleteManagedCustomIcon as jest.Mock).mockResolvedValue(undefined);
    (replaceCustomIconSelection as jest.Mock).mockImplementation(async ({ persistSelection }: any) => {
      await persistSelection('managed:new.jpg');
      return { reference: 'managed:new.jpg', uri: 'file:///documents/strollia-custom-icons/new.jpg' };
    });
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true });
    (pickAndReadGpxFile as jest.Mock).mockResolvedValue(null);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    if (renderer) {
      act(() => {
        renderer.unmount();
      });
      renderer = null;
    }
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('別画面から地図へ戻ると現在地中心へ復元しvisited grid取得範囲も同期する', async () => {
    const userRegion = createUserCenteredRegion({ latitude: 35.681236, longitude: 139.767125 });

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '現在地更新' }).props.onPress();
    });
    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '現在地へ戻る' }).props.onPress();
    });

    const callsBeforeReturn = mockAnimateToRegion.mock.calls.length;

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '日ごとの記録' }).props.onPress();
    });
    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '地図へ' }).props.onPress();
    });
    await flushPromises();

    expect(mockAnimateToRegion).toHaveBeenCalledTimes(callsBeforeReturn + 1);
    expect(mockAnimateToRegion).toHaveBeenLastCalledWith(userRegion, 250);
    expect(getGridBoundsForRegion).toHaveBeenLastCalledWith(userRegion, expect.any(Object));
    expect(getVisitedCellsInBounds).toHaveBeenCalledWith({
      minX: Math.round(userRegion.latitude * 1000),
      maxX: Math.round(userRegion.longitude * 1000),
      minY: Math.round(userRegion.latitudeDelta * 1000),
      maxY: Math.round(userRegion.longitudeDelta * 1000),
    });
  });

  test('取得済み範囲内(isGridBoundsContained=true)の再移動ではvisited cellを再取得しない', async () => {
    (isGridBoundsContained as jest.Mock).mockReturnValue(true);

    try {
      await act(async () => {
        renderer = ReactTestRenderer.create(<App />);
      });
      await flushPromises();

      // 同じ範囲へ一度移動して直近取得状態を確定させる。
      await act(async () => {
        renderer.root.findByProps({ accessibilityLabel: '現在地中心へ地図移動' }).props.onPress();
      });
      await flushPromises();
      const callsAfterFirst = (getVisitedCellsInBounds as jest.Mock).mock.calls.length;

      // 同じ範囲へ再移動 → 取得済み範囲内なので再取得しない（呼び出し回数が増えない）。
      await act(async () => {
        renderer.root.findByProps({ accessibilityLabel: '現在地中心へ地図移動' }).props.onPress();
      });
      await flushPromises();

      expect((getVisitedCellsInBounds as jest.Mock).mock.calls.length).toBe(callsAfterFirst);
    } finally {
      (isGridBoundsContained as jest.Mock).mockReturnValue(false);
    }
  });

  test('初回に権限不足でも復帰後に権限が揃ったら自動で記録開始する', async () => {
    let appStateHandler: ((state: string) => void) | null = null;
    const addEventListenerSpy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event: any, handler: any) => {
      appStateHandler = handler;
      return { remove: jest.fn() } as any;
    });
    (getLocationPermissionState as jest.Mock)
      .mockResolvedValueOnce({
        foregroundGranted: true,
        backgroundGranted: false,
        canAskForeground: true,
        canAskBackground: true,
      })
      .mockResolvedValue({
        foregroundGranted: true,
        backgroundGranted: true,
        canAskForeground: true,
        canAskBackground: true,
      });
    (isBackgroundLocationRecording as jest.Mock).mockResolvedValue(false);

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    expect(renderer).toBeTruthy();
    expect(startBackgroundLocationRecording).not.toHaveBeenCalled();

    await act(async () => {
      appStateHandler?.('active');
    });
    await flushPromises();

    expect(startBackgroundLocationRecording).toHaveBeenCalledTimes(1);
  });

  test('すでに記録中なら起動後に記録開始を重複実行しない', async () => {
    (isBackgroundLocationRecording as jest.Mock).mockResolvedValue(true);

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    expect(renderer).toBeTruthy();
    expect(startBackgroundLocationRecording).not.toHaveBeenCalled();
  });

  test('フォアグラウンド権限のみでは背景タスクを停止してから前景保存を有効にする', async () => {
    (getLocationPermissionState as jest.Mock).mockResolvedValue({
      foregroundGranted: true,
      backgroundGranted: false,
      canAskForeground: true,
      canAskBackground: false,
    });
    (isBackgroundLocationRecording as jest.Mock).mockResolvedValue(true);

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    expect(stopBackgroundLocationRecording).toHaveBeenCalledTimes(1);
    expect(updateBackgroundLocationTaskOptionsIfNeeded).not.toHaveBeenCalled();
    expect(mockLatestForegroundLocationOptions).toMatchObject({ enabled: true, shouldPersist: true });
  });

  test('常時許可では権限取得後に背景タスク設定を更新し、OS標準アイコンの前景監視を開始しない', async () => {
    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    expect((getLocationPermissionState as jest.Mock).mock.invocationCallOrder[0])
      .toBeLessThan((updateBackgroundLocationTaskOptionsIfNeeded as jest.Mock).mock.invocationCallOrder[0]);
    expect(stopBackgroundLocationRecording).not.toHaveBeenCalled();
    expect(mockLatestForegroundLocationOptions).toMatchObject({ enabled: false, shouldPersist: false });
  });

  test('常時許可かつカスタムアイコンでは表示用前景監視を1つ使い、前景保存しない', async () => {
    (resolveUserLocationIcon as jest.Mock).mockReturnValue({
      useNativeUserLocation: false,
      customIconId: 'walker',
      customImageUri: null,
    });

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    expect(updateBackgroundLocationTaskOptionsIfNeeded).toHaveBeenCalledTimes(1);
    expect(stopBackgroundLocationRecording).not.toHaveBeenCalled();
    expect(mockLatestForegroundLocationOptions).toMatchObject({ enabled: true, shouldPersist: false });
    expect(mockLatestForegroundLocationOptions.onLocation).toEqual(expect.any(Function));
  });

  test('inactiveとbackgroundでは前景限定監視を解除し、active復帰後に再開する', async () => {
    let appStateHandler: ((state: string) => void) | null = null;
    const addEventListenerSpy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event: any, handler: any) => {
      appStateHandler = handler;
      return { remove: jest.fn() } as any;
    });
    (getLocationPermissionState as jest.Mock).mockResolvedValue({
      foregroundGranted: true,
      backgroundGranted: false,
      canAskForeground: true,
      canAskBackground: false,
    });

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();
    expect(mockLatestForegroundLocationOptions).toMatchObject({ enabled: true, shouldPersist: true });

    await act(async () => {
      appStateHandler?.('inactive');
    });
    expect(mockLatestForegroundLocationOptions).toMatchObject({ enabled: false, shouldPersist: false });

    await act(async () => {
      appStateHandler?.('background');
    });
    expect(mockLatestForegroundLocationOptions).toMatchObject({ enabled: false, shouldPersist: false });

    await act(async () => {
      appStateHandler?.('active');
    });
    await flushPromises();
    expect(mockLatestForegroundLocationOptions).toMatchObject({ enabled: true, shouldPersist: true });
  });

  test('背景タスク停止に失敗した場合は前景保存を開始しない', async () => {
    (getLocationPermissionState as jest.Mock).mockResolvedValue({
      foregroundGranted: true,
      backgroundGranted: false,
      canAskForeground: true,
      canAskBackground: false,
    });
    (stopBackgroundLocationRecording as jest.Mock).mockRejectedValueOnce(new Error('stop failed'));

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    expect(mockLatestForegroundLocationOptions).toMatchObject({ enabled: false, shouldPersist: false });
  });

  test('起動後にRevenueCat由来のPlus状態を読み込む', async () => {
    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    expect(getPremiumAccessState).toHaveBeenCalledTimes(1);
  });

  test('起動後にRevenueCat Offeringを読み込む', async () => {
    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    expect(getPremiumOfferingSummary).toHaveBeenCalledTimes(1);
  });

  test('起動時にRevenueCat App User IDを取得し設定画面へ渡す', async () => {
    (getRevenueCatAppUserId as jest.Mock).mockResolvedValueOnce('$RCAnonymousID:abc123');

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    expect(getRevenueCatAppUserId).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '設定' }).props.onPress();
    });
    expect(mockLatestSettingsScreenProps.revenueCatAppUserId).toBe('$RCAnonymousID:abc123');
  });

  test('初回チュートリアル未完了の場合は初回チュートリアルを表示する', async () => {
    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    expect(renderer.root.findByProps({ accessibilityLabel: '初回チュートリアルを完了' })).toBeTruthy();
  });

  test('前回の写真表示有効化が未完了なら起動時に写真表示を自動OFFへ戻す', async () => {
    (getBooleanSetting as jest.Mock).mockImplementation((key: string, fallback: boolean) => {
      if (key === 'showPhotosOnMap') {
        return Promise.resolve(true);
      }
      if (key === 'showPhotosOnMapEnablePending') {
        return Promise.resolve(true);
      }
      if (key === 'firstLaunchTutorialCompleted') {
        return Promise.resolve(true);
      }

      return Promise.resolve(fallback);
    });

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    expect(mockLatestMapScreenProps.showPhotosOnMap).toBe(false);
    expect(setSetting).toHaveBeenCalledWith('showPhotosOnMap', false);
    expect(setSetting).toHaveBeenCalledWith('showPhotosOnMapEnablePending', false);
  });

  test('保存済みの写真表示ONは地図準備完了後にpendingを立ててから有効化する', async () => {
    (getBooleanSetting as jest.Mock).mockImplementation((key: string, fallback: boolean) => {
      if (key === 'showPhotosOnMap') {
        return Promise.resolve(true);
      }
      if (key === 'firstLaunchTutorialCompleted') {
        return Promise.resolve(true);
      }

      return Promise.resolve(fallback);
    });

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    expect(mockLatestMapScreenProps.showPhotosOnMap).toBe(false);

    await act(async () => {
      mockLatestMapScreenProps.onMapReady();
    });
    await flushPromises();

    expect(setSetting).toHaveBeenCalledWith('showPhotosOnMapEnablePending', true);
    expect(mockLatestMapScreenProps.showPhotosOnMap).toBe(true);
    const pendingWriteIndex = (setSetting as jest.Mock).mock.calls.findIndex(
      ([key, value]) => key === 'showPhotosOnMapEnablePending' && value === true,
    );
    const enabledWriteIndex = (setSetting as jest.Mock).mock.calls.findIndex(
      ([key, value]) => key === 'showPhotosOnMap' && value === true,
    );
    const pendingWriteOrder = (setSetting as jest.Mock).mock.invocationCallOrder[pendingWriteIndex];
    const enabledWriteOrder = (setSetting as jest.Mock).mock.invocationCallOrder[enabledWriteIndex];
    expect(pendingWriteOrder).toBeLessThan(enabledWriteOrder);
  });

  test('保存済み写真表示の復元中は手動OFFを割り込ませない', async () => {
    let resolvePendingEnable: (() => void) | null = null;
    (getBooleanSetting as jest.Mock).mockImplementation((key: string, fallback: boolean) => {
      if (key === 'showPhotosOnMap') {
        return Promise.resolve(true);
      }
      if (key === 'firstLaunchTutorialCompleted') {
        return Promise.resolve(true);
      }

      return Promise.resolve(fallback);
    });
    (setSetting as jest.Mock).mockImplementation((key: string, value: boolean) => {
      if (key === 'showPhotosOnMapEnablePending' && value === true) {
        return new Promise<void>((resolve) => {
          resolvePendingEnable = resolve;
        });
      }

      return Promise.resolve();
    });

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    await act(async () => {
      mockLatestMapScreenProps.onMapReady();
    });
    await flushPromises();

    await act(async () => {
      mockLatestMapScreenProps.onUpdateShowPhotosOnMap(false);
    });
    await flushPromises();

    expect(setSetting).not.toHaveBeenCalledWith('showPhotosOnMap', false);
    expect(setSetting).not.toHaveBeenCalledWith('showPhotosOnMapEnablePending', false);

    await act(async () => {
      resolvePendingEnable?.();
    });
    await flushPromises();

    expect(mockLatestMapScreenProps.showPhotosOnMap).toBe(true);
  });

  test('初回チュートリアル完了時に表示済み設定を保存する', async () => {
    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '初回チュートリアルを完了' }).props.onPress();
    });

    expect(setSetting).toHaveBeenCalledWith('firstLaunchTutorialCompleted', true);
  });

  test('初回チュートリアル未完了の場合は通知権限要求を完了後まで遅らせる', async () => {
    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    expect(requestAchievementNotificationPermissionOnFirstLaunch).not.toHaveBeenCalled();

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '初回チュートリアルを完了' }).props.onPress();
    });
    await flushPromises();

    expect(requestAchievementNotificationPermissionOnFirstLaunch).toHaveBeenCalledTimes(1);
  });

  test('初回チュートリアル完了済みの場合は表示しない', async () => {
    (getBooleanSetting as jest.Mock).mockImplementation((key: string, fallback: boolean) => {
      if (key === 'firstLaunchTutorialCompleted') {
        return Promise.resolve(true);
      }

      return Promise.resolve(fallback);
    });

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    expect(renderer.root.findAllByProps({ accessibilityLabel: '初回チュートリアルを完了' })).toHaveLength(0);
  });

  test('初回チュートリアル完了済みの場合は起動時に通知権限要求を実行する', async () => {
    (getBooleanSetting as jest.Mock).mockImplementation((key: string, fallback: boolean) => {
      if (key === 'firstLaunchTutorialCompleted') {
        return Promise.resolve(true);
      }

      return Promise.resolve(fallback);
    });

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    expect(requestAchievementNotificationPermissionOnFirstLaunch).toHaveBeenCalledTimes(1);
  });

  test('設定画面のチュートリアルから初回チュートリアルを再表示できる', async () => {
    (getBooleanSetting as jest.Mock).mockImplementation((key: string, fallback: boolean) => {
      if (key === 'firstLaunchTutorialCompleted') {
        return Promise.resolve(true);
      }

      return Promise.resolve(fallback);
    });

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    expect(renderer.root.findAllByProps({ accessibilityLabel: '初回チュートリアルを完了' })).toHaveLength(0);

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '設定' }).props.onPress();
    });
    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: 'チュートリアルを開く' }).props.onPress();
    });

    expect(renderer.root.findByProps({ accessibilityLabel: '初回チュートリアルを完了' })).toBeTruthy();
    expect(mockLatestFirstLaunchTutorialProps.completionButtonLabel).toBe('閉じる');
  });

  test('設定画面から再表示したチュートリアルを閉じても初回完了処理を再実行しない', async () => {
    (getBooleanSetting as jest.Mock).mockImplementation((key: string, fallback: boolean) => {
      if (key === 'firstLaunchTutorialCompleted') {
        return Promise.resolve(true);
      }

      return Promise.resolve(fallback);
    });

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    jest.clearAllMocks();

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '設定' }).props.onPress();
    });
    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: 'チュートリアルを開く' }).props.onPress();
    });
    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '初回チュートリアルを完了' }).props.onPress();
    });
    await flushPromises();

    expect(setSetting).not.toHaveBeenCalledWith('firstLaunchTutorialCompleted', true);
    expect(requestAchievementNotificationPermissionOnFirstLaunch).not.toHaveBeenCalled();
  });

  test('起動時にRevenueCat CustomerInfo更新を購読しアンマウント時に解除する', async () => {
    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    expect(subscribePremiumAccessStateUpdates).toHaveBeenCalledTimes(1);

    act(() => {
      renderer.unmount();
    });
    renderer = null;

    expect(mockPremiumUnsubscribe).toHaveBeenCalledTimes(1);
  });

  test('RevenueCat CustomerInfo更新でPlus状態を画面へ反映する', async () => {
    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '設定' }).props.onPress();
    });
    expect(mockLatestSettingsScreenProps.premiumAccessState.isPlusActive).toBe(true);

    act(() => {
      mockPremiumCustomerInfoUpdate?.({ isPlusActive: false, entitlementId: 'strollia_plus' });
    });

    expect(mockLatestSettingsScreenProps.premiumAccessState.isPlusActive).toBe(false);
  });

  test('Plus確認と管理参照の解決後に保存済みカスタムアイコンを復元する', async () => {
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'userLocationIcon') return Promise.resolve('custom');
      if (key === 'customIconImageUri') return Promise.resolve('managed:saved.jpg');
      return Promise.resolve(fallback);
    });
    (resolveCustomIconReference as jest.Mock).mockResolvedValue({
      reference: 'managed:saved.jpg',
      uri: 'file:///documents/strollia-custom-icons/saved.jpg',
      migrated: false,
    });
    (resolveUserLocationIcon as jest.Mock).mockImplementation((id, plus, uri) => ({
      useNativeUserLocation: !(id === 'custom' && plus && uri),
      customIconId: null,
      customImageUri: id === 'custom' && plus ? uri : null,
    }));

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    expect(mockLatestMapScreenProps.userLocationIcon.customImageUri).toBe('file:///documents/strollia-custom-icons/saved.jpg');
  });

  test('Plus状態の取得待機中は地図を描画せず、制限時間後は安全に起動する', async () => {
    jest.useFakeTimers();
    let resolvePremium!: (value: { isPlusActive: boolean; entitlementId: string }) => void;
    (getPremiumAccessState as jest.Mock).mockReturnValue(new Promise((resolve) => { resolvePremium = resolve; }));
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'userLocationIcon') return Promise.resolve('walker');
      return Promise.resolve(fallback);
    });
    (resolveUserLocationIcon as jest.Mock).mockImplementation((id, plus) => ({
      useNativeUserLocation: !(id === 'walker' && plus),
      customIconId: id === 'walker' && plus ? 'walker' : null,
      customImageUri: null,
    }));

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();
    expect(mockLatestMapScreenProps).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    await flushPromises();
    expect(mockLatestMapScreenProps).not.toBeNull();
    expect(mockLatestMapScreenProps.userLocationIcon.useNativeUserLocation).toBe(true);
    expect(setSettings).not.toHaveBeenCalled();
    expect(setSetting).not.toHaveBeenCalledWith('userLocationIcon', 'default');
    await act(async () => { resolvePremium({ isPlusActive: true, entitlementId: 'strollia_plus' }); });
    await flushPromises();
    jest.useRealTimers();
  });

  test('タイムアウト後に初回Plus取得が成功したら保存済みカスタムアイコンを復元する', async () => {
    jest.useFakeTimers();
    let resolvePremium!: (value: { isPlusActive: boolean; entitlementId: string }) => void;
    (getPremiumAccessState as jest.Mock).mockReturnValue(new Promise((resolve) => { resolvePremium = resolve; }));
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'userLocationIcon') return Promise.resolve('custom');
      if (key === 'customIconImageUri') return Promise.resolve('managed:saved.jpg');
      return Promise.resolve(fallback);
    });
    (resolveCustomIconReference as jest.Mock).mockResolvedValue({ reference: 'managed:saved.jpg', uri: 'file:///saved.jpg', migrated: false });
    (resolveUserLocationIcon as jest.Mock).mockImplementation((id, plus, uri) => ({
      useNativeUserLocation: !(id === 'custom' && plus && uri),
      customIconId: null,
      customImageUri: id === 'custom' && plus ? uri : null,
    }));

    await act(async () => { renderer = ReactTestRenderer.create(<App />); });
    await flushPromises();
    await act(async () => { jest.advanceTimersByTime(3000); });
    await flushPromises();
    expect(mockLatestMapScreenProps.userLocationIcon.useNativeUserLocation).toBe(true);

    await act(async () => { resolvePremium({ isPlusActive: true, entitlementId: 'strollia_plus' }); });
    await flushPromises();
    expect(mockLatestMapScreenProps.userLocationIcon.customImageUri).toBe('file:///saved.jpg');
    expect(setSettings).not.toHaveBeenCalled();
  });

  test('タイムアウト後の購読更新を遅延した古い初回取得結果で上書きしない', async () => {
    jest.useFakeTimers();
    let resolvePremium!: (value: { isPlusActive: boolean; entitlementId: string }) => void;
    (getPremiumAccessState as jest.Mock).mockReturnValue(new Promise((resolve) => { resolvePremium = resolve; }));
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => key === 'userLocationIcon' ? Promise.resolve('walker') : Promise.resolve(fallback));
    (resolveUserLocationIcon as jest.Mock).mockImplementation((id, plus) => ({
      useNativeUserLocation: !(id === 'walker' && plus),
      customIconId: id === 'walker' && plus ? 'walker' : null,
      customImageUri: null,
    }));

    await act(async () => { renderer = ReactTestRenderer.create(<App />); });
    await flushPromises();
    await act(async () => { jest.advanceTimersByTime(3000); });
    await flushPromises();
    act(() => { mockPremiumCustomerInfoUpdate?.({ isPlusActive: true, entitlementId: 'strollia_plus' }); });
    await act(async () => { resolvePremium({ isPlusActive: false, entitlementId: 'strollia_plus' }); });
    await flushPromises();

    expect(mockLatestMapScreenProps.userLocationIcon.customIconId).toBe('walker');
  });

  test('初回Plus取得中の購読更新を古い取得結果で上書きしない', async () => {
    let resolvePremium!: (value: { isPlusActive: boolean; entitlementId: string }) => void;
    (getPremiumAccessState as jest.Mock).mockReturnValue(new Promise((resolve) => { resolvePremium = resolve; }));
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => key === 'userLocationIcon' ? Promise.resolve('walker') : Promise.resolve(fallback));
    (resolveUserLocationIcon as jest.Mock).mockImplementation((id, plus) => ({
      useNativeUserLocation: !(id === 'walker' && plus),
      customIconId: id === 'walker' && plus ? 'walker' : null,
      customImageUri: null,
    }));

    await act(async () => { renderer = ReactTestRenderer.create(<App />); });
    await flushPromises();
    act(() => { mockPremiumCustomerInfoUpdate?.({ isPlusActive: true, entitlementId: 'strollia_plus' }); });
    await act(async () => { resolvePremium({ isPlusActive: false, entitlementId: 'strollia_plus' }); });
    await flushPromises();

    expect(mockLatestMapScreenProps.userLocationIcon.customIconId).toBe('walker');
  });

  test('カスタム画像の読込エラーはセッション内だけOS標準へ戻し設定を消さない', async () => {
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'userLocationIcon') return Promise.resolve('custom');
      if (key === 'customIconImageUri') return Promise.resolve('managed:saved.jpg');
      return Promise.resolve(fallback);
    });
    (resolveCustomIconReference as jest.Mock).mockResolvedValue({ reference: 'managed:saved.jpg', uri: 'file:///saved.jpg', migrated: false });
    (resolveUserLocationIcon as jest.Mock).mockImplementation((id, plus, uri) => ({
      useNativeUserLocation: !uri,
      customIconId: null,
      customImageUri: uri,
    }));

    await act(async () => { renderer = ReactTestRenderer.create(<App />); });
    await flushPromises();
    jest.clearAllMocks();
    await act(async () => { mockLatestMapScreenProps.onCustomIconError(); });

    expect(mockLatestMapScreenProps.userLocationIcon.useNativeUserLocation).toBe(true);
    expect(resolveUserLocationIcon).toHaveBeenLastCalledWith('custom', true, null);
    expect(setSetting).not.toHaveBeenCalledWith('userLocationIcon', 'default');
    expect(setSetting).not.toHaveBeenCalledWith('customIconImageUri', '');
    expect(setSettings).not.toHaveBeenCalled();
  });

  test('写真選択成功時は安全な置換と原子的保存後に切り替え、旧成功アラートを表示しない', async () => {
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'userLocationIcon') return Promise.resolve('custom');
      if (key === 'customIconImageUri') return Promise.resolve('managed:old.jpg');
      return Promise.resolve(fallback);
    });
    (resolveCustomIconReference as jest.Mock).mockResolvedValue({ reference: 'managed:old.jpg', uri: 'file:///old.jpg', migrated: false });
    (resolveUserLocationIcon as jest.Mock).mockImplementation((_id, _plus, uri) => ({ useNativeUserLocation: !uri, customIconId: null, customImageUri: uri }));
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///crop.jpg' }] });
    const alertSpy = jest.spyOn(Alert, 'alert');

    await act(async () => { renderer = ReactTestRenderer.create(<App />); });
    await flushPromises();
    await act(async () => { renderer.root.findByProps({ accessibilityLabel: '設定' }).props.onPress(); });
    await act(async () => { renderer.root.findByProps({ accessibilityLabel: 'カスタムアイコンを選ぶ' }).props.onPress(); });
    await flushPromises();

    expect(replaceCustomIconSelection).toHaveBeenCalledWith(expect.objectContaining({ sourceUri: 'file:///crop.jpg', previousReference: 'managed:old.jpg' }));
    expect(setSettings).toHaveBeenCalledWith([
      { key: 'customIconImageUri', value: 'managed:new.jpg' },
      { key: 'userLocationIcon', value: 'custom' },
    ]);
    expect(mockLatestSettingsScreenProps.selectedUserLocationIconId).toBe('custom');
    expect(alertSpy).not.toHaveBeenCalledWith('カスタムアイコン', expect.anything());
  });

  test('写真の置換に失敗した場合は以前のアイコンを保持して通知する', async () => {
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'userLocationIcon') return Promise.resolve('custom');
      if (key === 'customIconImageUri') return Promise.resolve('managed:old.jpg');
      return Promise.resolve(fallback);
    });
    (resolveCustomIconReference as jest.Mock).mockResolvedValue({ reference: 'managed:old.jpg', uri: 'file:///old.jpg', migrated: false });
    (resolveUserLocationIcon as jest.Mock).mockImplementation((_id, _plus, uri) => ({ useNativeUserLocation: !uri, customIconId: null, customImageUri: uri }));
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///crop.jpg' }] });
    (replaceCustomIconSelection as jest.Mock).mockRejectedValue(new Error('保存失敗'));
    const alertSpy = jest.spyOn(Alert, 'alert');

    await act(async () => { renderer = ReactTestRenderer.create(<App />); });
    await flushPromises();
    await act(async () => { renderer.root.findByProps({ accessibilityLabel: '設定' }).props.onPress(); });
    await act(async () => { renderer.root.findByProps({ accessibilityLabel: 'カスタムアイコンを選ぶ' }).props.onPress(); });
    await flushPromises();

    expect(mockLatestSettingsScreenProps.selectedUserLocationIconId).toBe('custom');
    expect(mockLatestMapScreenProps.userLocationIcon.customImageUri).toBe('file:///old.jpg');
    expect(alertSpy).toHaveBeenCalledWith('設定失敗', expect.stringContaining('以前のアイコン'));
  });

  test('以前のカスタム参照がない写真設定失敗では保持メッセージを表示しない', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///crop.jpg' }] });
    (replaceCustomIconSelection as jest.Mock).mockRejectedValue(new Error('保存失敗'));
    const alertSpy = jest.spyOn(Alert, 'alert');

    await act(async () => { renderer = ReactTestRenderer.create(<App />); });
    await flushPromises();
    await act(async () => { renderer.root.findByProps({ accessibilityLabel: '設定' }).props.onPress(); });
    await act(async () => { renderer.root.findByProps({ accessibilityLabel: 'カスタムアイコンを選ぶ' }).props.onPress(); });
    await flushPromises();

    expect(alertSpy).toHaveBeenCalledWith('設定失敗', expect.not.stringContaining('以前のアイコン'));
  });

  test('カスタム写真選択を連続実行しても置換処理は1件だけ開始する', async () => {
    let resolvePermission!: (value: { granted: boolean }) => void;
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockReturnValue(new Promise((resolve) => { resolvePermission = resolve; }));

    await act(async () => { renderer = ReactTestRenderer.create(<App />); });
    await flushPromises();
    await act(async () => { renderer.root.findByProps({ accessibilityLabel: '設定' }).props.onPress(); });
    act(() => {
      renderer.root.findByProps({ accessibilityLabel: 'カスタムアイコンを選ぶ' }).props.onPress();
      renderer.root.findByProps({ accessibilityLabel: 'カスタムアイコンを選ぶ' }).props.onPress();
    });

    expect(ImagePicker.requestMediaLibraryPermissionsAsync).toHaveBeenCalledTimes(1);
    await act(async () => { resolvePermission({ granted: false }); });
    await flushPromises();
  });

  test('読み込める旧URIを管理参照へ移行して保存する', async () => {
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => key === 'customIconImageUri' ? Promise.resolve('file:///legacy.jpg') : Promise.resolve(fallback));
    (resolveCustomIconReference as jest.Mock).mockResolvedValue({ reference: 'managed:migrated.jpg', uri: 'file:///managed.jpg', migrated: true });

    await act(async () => { renderer = ReactTestRenderer.create(<App />); });
    await flushPromises();

    expect(setSetting).toHaveBeenCalledWith('customIconImageUri', 'managed:migrated.jpg');
  });

  test('旧URI移行後のDB保存に失敗した場合は新規ファイルを削除して旧URI表示を維持する', async () => {
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'userLocationIcon') return Promise.resolve('custom');
      if (key === 'customIconImageUri') return Promise.resolve('file:///legacy.jpg');
      return Promise.resolve(fallback);
    });
    (resolveCustomIconReference as jest.Mock).mockResolvedValue({ reference: 'managed:migrated.jpg', uri: 'file:///managed.jpg', migrated: true });
    (setSetting as jest.Mock).mockImplementation((key: string) => key === 'customIconImageUri' ? Promise.reject(new Error('DB失敗')) : Promise.resolve());
    (resolveUserLocationIcon as jest.Mock).mockImplementation((_id, _plus, uri) => ({ useNativeUserLocation: !uri, customIconId: null, customImageUri: uri }));

    await act(async () => { renderer = ReactTestRenderer.create(<App />); });
    await flushPromises();

    expect(deleteManagedCustomIcon).toHaveBeenCalledWith('managed:migrated.jpg');
    expect(mockLatestMapScreenProps.userLocationIcon.customImageUri).toBe('file:///legacy.jpg');
  });

  test('消えた旧URIは表示だけOS標準へ戻し保存設定を消さない', async () => {
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'userLocationIcon') return Promise.resolve('custom');
      if (key === 'customIconImageUri') return Promise.resolve('file:///missing.jpg');
      return Promise.resolve(fallback);
    });
    (resolveCustomIconReference as jest.Mock).mockResolvedValue(null);

    await act(async () => { renderer = ReactTestRenderer.create(<App />); });
    await flushPromises();

    expect(setSetting).not.toHaveBeenCalledWith('customIconImageUri', '');
    expect(setSetting).not.toHaveBeenCalledWith('userLocationIcon', 'default');
    expect(setSettings).not.toHaveBeenCalled();
  });

  test('設定画面からOSSライセンス画面と詳細画面を通常遷移で開き、それぞれ戻れる', async () => {
    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '設定' }).props.onPress();
    });

    expect(mockLatestSettingsScreenProps).toBeTruthy();

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: 'OSSライセンス' }).props.onPress();
    });

    expect(renderer.root.findByProps({ accessibilityLabel: 'OSSライセンス' })).toBeTruthy();

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: 'react のライセンス詳細を開く' }).props.onPress();
    });

    expect(renderer.root.findByProps({ accessibilityLabel: 'react のライセンス詳細を開く' })).toBeTruthy();

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: 'ライセンス一覧へ戻る' }).props.onPress();
    });

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '設定画面へ戻る' }).props.onPress();
    });

    expect(mockLatestSettingsScreenProps).toBeTruthy();
  });

  test('日ごとの記録一覧から日別詳細へ進み、一覧へ戻れる', async () => {
    (getDailyLogs as jest.Mock).mockResolvedValueOnce([
      {
        localDate: '2026-05-31',
        pointCount: 1,
        startedAt: '2026-05-31T00:00:00.000Z',
        endedAt: '2026-05-31T00:01:00.000Z',
        distanceMeters: 146200,
        startLocationPointId: 1,
        endLocationPointId: 2,
      },
    ]);

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '日ごとの記録' }).props.onPress();
    });
    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '日別詳細を開く' }).props.onPress();
    });

    expect(renderer.root.findByProps({ accessibilityLabel: '日別詳細から一覧へ戻る' })).toBeTruthy();

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '日別詳細から一覧へ戻る' }).props.onPress();
    });

    expect(renderer.root.findByProps({ accessibilityLabel: '日別詳細を開く' })).toBeTruthy();
  });

  test('GPXインポート押下直後に実績反映範囲の注意を表示してからファイル選択を開く', async () => {
    const callOrder: string[] = [];
    jest.spyOn(Alert, 'alert').mockImplementation((title: string, message?: string) => {
      callOrder.push(`alert:${title}:${message ?? ''}`);
    });
    (pickAndReadGpxFile as jest.Mock).mockImplementation(async () => {
      callOrder.push('pick');
      return null;
    });

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '設定' }).props.onPress();
    });

    await act(async () => {
      await mockLatestSettingsScreenProps.onImportGpx();
    });

    expect(callOrder).toEqual([
      'alert:GPXインポートと実績について:GPXインポートでは、総移動距離や記録日数など一部の実績だけが判定対象になります。訪問した地域など、実際の記録中に確認する実績には反映されません。',
      'pick',
    ]);
    expect(pickAndReadGpxFile).toHaveBeenCalledTimes(1);
  });

  test('GPX取り込み処理中だけブロッキングダイアログを表示し、完了後(finally)に閉じる', async () => {
    const originalRaf = global.requestAnimationFrame;
    // 本体は requestAnimationFrame で1フレーム譲るため、テストでは同期的に解決させる。
    global.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    }) as typeof global.requestAnimationFrame;
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    (pickAndReadGpxFile as jest.Mock).mockResolvedValue({ content: '<gpx/>', fileName: 'a.gpx' });
    (parseGpxToLocationPoints as jest.Mock).mockReturnValue([{ latitude: 1, longitude: 2, timestamp: 0 }]);

    let resolveImport: (value: { importedPointCount: number; skippedPointCount: number }) => void = () => undefined;
    (importLocationPointsFromGpx as jest.Mock).mockImplementation(
      () => new Promise((resolve) => {
        resolveImport = resolve;
      }),
    );

    // 退場アニメーション中は中身が残るため、表示状態は Dialog の visible プロップで判定する。
    const isImportDialogVisible = () =>
      renderer.root.findByType(GpxImportProgressDialog).props.visible;

    try {
      await act(async () => {
        renderer = ReactTestRenderer.create(<App />);
      });
      await flushPromises();

      await act(async () => {
        renderer.root.findByProps({ accessibilityLabel: '設定' }).props.onPress();
      });

      // 取り込み開始前はダイアログは出ていない。
      expect(isImportDialogVisible()).toBe(false);

      let importPromise: Promise<void> = Promise.resolve();
      await act(async () => {
        importPromise = mockLatestSettingsScreenProps.onImportGpx();
      });
      await flushPromises();

      // import が未解決の間はブロッキングダイアログが表示される。
      expect(isImportDialogVisible()).toBe(true);

      await act(async () => {
        resolveImport({ importedPointCount: 1, skippedPointCount: 0 });
        await importPromise;
      });
      await flushPromises();

      // finally で処理中フラグが下り、ダイアログは閉じる。
      expect(isImportDialogVisible()).toBe(false);
    } finally {
      global.requestAnimationFrame = originalRaf;
    }
  });


  test('設定画面から月払いPackageを直接購入してPlus状態を反映する', async () => {
    (purchasePremiumPackage as jest.Mock).mockResolvedValueOnce({
      status: 'purchased',
      accessState: { isPlusActive: true, entitlementId: 'strollia_plus' },
    });

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '設定' }).props.onPress();
    });

    await act(async () => {
      mockLatestSettingsScreenProps.onPurchaseMonthlyPremiumPackage();
    });
    await flushPromises();

    expect(purchasePremiumPackage).toHaveBeenCalledWith('monthly');
    expect(mockLatestSettingsScreenProps.premiumAccessState.isPlusActive).toBe(true);
  });

  test('設定画面から年払いPackageを直接購入してPlus状態を反映する', async () => {
    (purchasePremiumPackage as jest.Mock).mockResolvedValueOnce({
      status: 'purchased',
      accessState: { isPlusActive: true, entitlementId: 'strollia_plus' },
    });

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '設定' }).props.onPress();
    });

    await act(async () => {
      mockLatestSettingsScreenProps.onPurchaseYearlyPremiumPackage();
    });
    await flushPromises();

    expect(purchasePremiumPackage).toHaveBeenCalledWith('yearly');
    expect(mockLatestSettingsScreenProps.premiumAccessState.isPlusActive).toBe(true);
  });

  test('Plus未加入時に有料現在地アイコンを選ぶと設定画面で加入する案内を表示する', async () => {
    (getPremiumAccessState as jest.Mock)
      .mockResolvedValueOnce({ isPlusActive: false, entitlementId: 'strollia_plus' });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '設定' }).props.onPress();
    });

    await act(async () => {
      mockLatestSettingsScreenProps.onUpdateUserLocationIcon('walker');
    });
    await flushPromises();

    expect(purchasePremiumPackage).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Strollia Plus限定', 'さんぽはStrollia Plusで開放できます。設定画面の月払いまたは年払いから加入してください。');
  });

  test('設定画面からRevenueCat Customer Centerを表示する', async () => {
    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '設定' }).props.onPress();
    });

    await act(async () => {
      mockLatestSettingsScreenProps.onPresentPremiumCustomerCenter();
    });
    await flushPromises();

    expect(presentPremiumCustomerCenter).toHaveBeenCalledTimes(1);
  });

  test('設定画面から購入が失敗した場合にエラーアラートを表示しPlus状態を変更しない', async () => {
    (purchasePremiumPackage as jest.Mock).mockResolvedValueOnce({
      status: 'error',
      accessState: { isPlusActive: false, entitlementId: 'strollia_plus' },
    });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '設定' }).props.onPress();
    });

    await act(async () => {
      mockLatestSettingsScreenProps.onPurchaseMonthlyPremiumPackage();
    });
    await flushPromises();

    expect(purchasePremiumPackage).toHaveBeenCalledWith('monthly');
    expect(alertSpy).toHaveBeenCalledWith('Strollia Plus', '購入を完了できませんでした。RevenueCatとストア設定を確認してください。');
    expect(mockLatestSettingsScreenProps.premiumAccessState.isPlusActive).toBe(false);
  });

  test('設定画面からCustomer Centerの表示が失敗した場合にエラーアラートを表示する', async () => {
    (presentPremiumCustomerCenter as jest.Mock).mockResolvedValueOnce(false);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '設定' }).props.onPress();
    });

    await act(async () => {
      mockLatestSettingsScreenProps.onPresentPremiumCustomerCenter();
    });
    await flushPromises();

    expect(presentPremiumCustomerCenter).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith('Strollia Plus', 'サブスク管理画面を表示できませんでした。RevenueCatとストア設定を確認してください。');
  });

  test('ペイウォールで購入が成功するとダイアログが閉じる', async () => {
    (getPremiumAccessState as jest.Mock).mockResolvedValue({ isPlusActive: false, entitlementId: 'strollia_plus' });
    (purchasePremiumPackage as jest.Mock).mockResolvedValueOnce({ status: 'purchased', accessState: { isPlusActive: true, entitlementId: 'strollia_plus' } });

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '月次レポート' }).props.onPress();
    });
    await flushPromises();

    // ペイウォールが開いていることを確認
    expect(renderer.root.findByProps({ accessibilityLabel: '月払いで購入' })).toBeTruthy();

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '月払いで購入' }).props.onPress();
    });
    await flushPromises();

    // 購入成功後にペイウォールが閉じる
    expect(renderer.root.findAllByProps({ accessibilityLabel: '月払いで購入' })).toHaveLength(0);
  });

  test('ペイウォールで復元が成功するとダイアログが閉じる', async () => {
    (getPremiumAccessState as jest.Mock).mockResolvedValue({ isPlusActive: false, entitlementId: 'strollia_plus' });
    (restorePremiumPurchases as jest.Mock).mockResolvedValueOnce({ isPlusActive: true, entitlementId: 'strollia_plus' });

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '月次レポート' }).props.onPress();
    });
    await flushPromises();

    expect(renderer.root.findByProps({ accessibilityLabel: '購入を復元' })).toBeTruthy();

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '購入を復元' }).props.onPress();
    });
    await flushPromises();

    // 復元成功後にペイウォールが閉じる
    expect(renderer.root.findAllByProps({ accessibilityLabel: '購入を復元' })).toHaveLength(0);
  });

  test('月次レポートボタンは無料ユーザーにペイウォールを表示する', async () => {
    (getPremiumAccessState as jest.Mock).mockResolvedValue({ isPlusActive: false, entitlementId: 'strollia_plus' });

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '月次レポート' }).props.onPress();
    });
    await flushPromises();

    // ペイウォールが表示され、月次レポート画面へは遷移しない
    expect(mockLatestMonthlyReportScreenProps).toBeNull();
  });

  /** 先月の日別ログ（記録あり）を1件返す。月次レポート遷移テスト用。 */
  function previousMonthDailyLog() {
    const previousMonth = new Date();
    previousMonth.setDate(1);
    previousMonth.setMonth(previousMonth.getMonth() - 1);
    const localDate = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}-15`;
    return {
      localDate,
      pointCount: 5,
      startedAt: `${localDate}T00:00:00.000Z`,
      endedAt: `${localDate}T01:00:00.000Z`,
      distanceMeters: 1500,
      startLocationPointId: null,
      endLocationPointId: null,
    };
  }

  test('起動直後（premium状態未確定）でもPlus会員なら月次レポートへ遷移する', async () => {
    (getDailyLogs as jest.Mock).mockResolvedValueOnce([previousMonthDailyLog()]);
    // 初期取得は遅延するが、ボタン押下時の再取得では isPlusActive=true を返す
    (getPremiumAccessState as jest.Mock)
      .mockResolvedValueOnce({ isPlusActive: false, entitlementId: 'strollia_plus' }) // 起動時
      .mockResolvedValueOnce({ isPlusActive: true, entitlementId: 'strollia_plus' });  // ボタン押下時

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '月次レポート' }).props.onPress();
    });
    await flushPromises();

    expect(mockLatestMonthlyReportScreenProps).not.toBeNull();
  });

  test('月次レポートボタンはPlus会員かつ先月データありで月次レポート画面へ遷移させる', async () => {
    (getDailyLogs as jest.Mock).mockResolvedValueOnce([previousMonthDailyLog()]);
    (getPremiumAccessState as jest.Mock).mockResolvedValue({ isPlusActive: true, entitlementId: 'strollia_plus' });

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '月次レポート' }).props.onPress();
    });
    await flushPromises();

    expect(mockLatestMonthlyReportScreenProps).not.toBeNull();
  });

  test('Plus会員でも先月データがない場合は集計中アラートを出し遷移しない', async () => {
    (getDailyLogs as jest.Mock).mockResolvedValue([]);
    (getPremiumAccessState as jest.Mock).mockResolvedValue({ isPlusActive: true, entitlementId: 'strollia_plus' });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '月次レポート' }).props.onPress();
    });
    await flushPromises();

    expect(alertSpy).toHaveBeenCalledWith('現在集計中です！', '来月になったらもう一度来てください！');
    expect(mockLatestMonthlyReportScreenProps).toBeNull();
  });

  test('初期状態は現在地に追従し、地図中心が現在地付近になっただけでは追従を再開しない', async () => {
    const userRegion = createUserCenteredRegion({ latitude: 35.681236, longitude: 139.767125 });

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '現在地更新' }).props.onPress();
    });

    expect(mockAnimateToRegion).toHaveBeenCalledWith(userRegion, 250);

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '地図をドラッグ' }).props.onPress();
    });
    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '現在地中心へ地図移動' }).props.onPress();
    });
    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '現在地更新' }).props.onPress();
    });

    expect(mockAnimateToRegion).toHaveBeenCalledTimes(1);
  });

  test('不正な現在地座標ではMapKitへRegionを渡さない', async () => {
    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '不正な現在地更新' }).props.onPress();
    });

    expect(mockAnimateToRegion).not.toHaveBeenCalled();
  });
});
