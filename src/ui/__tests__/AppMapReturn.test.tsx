import { act, cleanup, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { createUserCenteredRegion } from '@/ui/mapRegion';
import { Alert, AppState, Pressable, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getVisitedCellsInBounds } from '@/features/location/visitedCellRepository';
import { getGridBoundsForRegion, isGridBoundsContained } from '@/features/location/grid/gridCell';
import { getLocationPermissionState } from '@/features/location/locationPermission';
import {
  isBackgroundLocationRecording,
  startBackgroundLocationRecording,
  stopBackgroundLocationRecording,
  updateBackgroundLocationTaskOptionsIfNeeded,
} from '@/features/location/locationService';
import { resolveUserLocationIcon } from '@/features/customization/customizationResolver';
import {
  deleteManagedCustomIcon,
  isLegacyCustomIconReference,
  resolveCustomIconReference,
} from '@/features/customization/customIconStorage';
import { replaceCustomIconSelection } from '@/features/customization/customIconSelection';
import { getDailyLogs, getLocationPointsByMonth } from '@/features/logs/logRepository';
import { getMonthlyAreaReport } from '@/features/reports/monthlyAreaReport';
import { formatReportMonth, getPreviousReportMonth } from '@/features/reports/monthlyReport';
import { pickAndReadGpxFile } from '@/features/import/gpxImportService';
import { parseGpxToLocationPoints } from '@/features/import/gpxImporter';
import { importLocationPointsFromGpx } from '@/features/import/importRepository';
import { GpxImportProgressDialog } from '@/ui/components/GpxImportProgressDialog';
import {
  getConfirmedPremiumAccessState,
  getDefaultPremiumAccessState,
  getPremiumAccessState,
  getPremiumOfferingSummary,
  getRevenueCatAppUserId,
  presentPremiumCustomerCenter,
  purchasePremiumPackage,
  restorePremiumPurchases,
  subscribePremiumAccessStateUpdates,
} from '@/features/premium/revenueCatAccess';
import { getBooleanSetting, getStringSetting, setSetting, setSettings } from '@/features/settings/settingsRepository';
import {
  requestAchievementNotificationPermissionOnFirstLaunch,
  setupAchievementNotificationChannel,
} from '@/features/achievements/achievementNotificationService';
import { getAchievementListItems, getPendingInAppAchievementNotifications } from '@/features/achievements/achievementRepository';
import { filterDismissedAchievementNotifications } from '@/features/achievements/pendingNotifications';
import type { LocationPoint } from '@/types/gps';

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'Light' },
  impactAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ accessPrivileges: 'all' }),
  // 保存済み設定の復元経路は権限を参照して再確認するため、フルアクセスを返しておく
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, accessPrivileges: 'all' }),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('@/config/sentry', () => ({
  wrapWithSentry: (component: unknown) => component,
  updateSentryScreenContext: jest.fn(),
  updateSentrySubscriptionContext: jest.fn(),
  updateSentryUserContext: jest.fn(),
  setCrashReportingEnabled: jest.fn(),
  reportPhotoMapDiagnostics: jest.fn(),
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
let mockLatestAppUpdateNoticeDialogProps: any = null;
let mockLatestForegroundLocationOptions: any = null;
let mockNativeApplicationVersion: string | null = '1.3.0';
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

jest.mock('@/ui/components/MapScreen', () => ({
  MapScreen: (props: any) => {
    const { Pressable, Text } = require('react-native');

    mockLatestMapScreenProps = props;
    props.mapRef.current = { animateToRegion: mockAnimateToRegion };

    return (
      <>
        <Pressable
          accessibilityLabel="現在地更新"
          onPress={() =>
            props.onUserLocationChange({
              nativeEvent: {
                coordinate: { latitude: 35.681236, longitude: 139.767125, speed: 1 },
              },
            })
          }
        >
          <Text>現在地更新</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="不正な現在地更新"
          onPress={() =>
            props.onUserLocationChange({
              nativeEvent: {
                coordinate: { latitude: Number.NaN, longitude: 139.767125, speed: 1 },
              },
            })
          }
        >
          <Text>不正な現在地更新</Text>
        </Pressable>
        <Pressable accessibilityLabel="現在地へ戻る" onPress={props.onRecenterOnUserLocation}>
          <Text>現在地へ戻る</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="現在地中心へ地図移動"
          onPress={() =>
            props.onRegionChangeComplete({
              latitude: 35.681236,
              longitude: 139.767125,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            })
          }
        >
          <Text>現在地中心へ地図移動</Text>
        </Pressable>
        <Pressable accessibilityLabel="地図をドラッグ" onPress={props.onPanDrag}>
          <Text>地図をドラッグ</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="ドラッグ中に地図範囲を更新"
          onPress={() =>
            props.onRegionChange({
              latitude: 35.7,
              longitude: 139.8,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            })
          }
        >
          <Text>ドラッグ中に地図範囲を更新</Text>
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

jest.mock('expo-application', () => ({
  get nativeApplicationVersion() {
    return mockNativeApplicationVersion;
  },
  nativeBuildVersion: '30',
}));

jest.mock('@/features/app-update/updateNotices', () => ({
  ...jest.requireActual('@/features/app-update/updateNotices'),
  LATEST_UPDATE_NOTICE: {
    version: '1.3.0',
    kind: 'feature',
    heading: '新機能を\n追加しました',
    sectionTitle: '主な新機能',
    items: ['地図を改善'],
    showMore: false,
  },
}));

jest.mock('@/ui/components/DailyLogsScreen', () => ({
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

jest.mock('@/ui/components/PremiumPaywallModal', () => ({
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

jest.mock('@/ui/components/DailyLogDetailScreen', () => ({
  DailyLogDetailScreen: ({ onBackToDailyLogs }: { onBackToDailyLogs: () => void }) => {
    const { Pressable, Text } = require('react-native');

    return (
      <Pressable accessibilityLabel="日別詳細から一覧へ戻る" onPress={onBackToDailyLogs}>
        <Text>日ごとの記録</Text>
      </Pressable>
    );
  },
}));

jest.mock('@/ui/components/AchievementListScreen', () => ({
  AchievementListScreen: () => null,
}));

jest.mock('@/ui/components/AchievementUnlockModal', () => ({
  AchievementUnlockModal: () => null,
}));

jest.mock('@/ui/components/FirstLaunchTutorialDialog', () => ({
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

jest.mock('@/ui/components/AppUpdateNoticeDialog', () => ({
  AppUpdateNoticeDialog: (props: any) => {
    const { Pressable, Text } = require('react-native');
    mockLatestAppUpdateNoticeDialogProps = props;

    if (!props.visible || !props.notice || !props.source) return null;

    return (
      <>
        <Pressable accessibilityLabel="更新通知を閉じる" onPress={props.onClose}>
          <Text>{`更新通知:${props.source}`}</Text>
        </Pressable>
        {props.source === 'settings' ? (
          <Pressable accessibilityLabel="ストアページへ" onPress={props.onOpenStorePage}>
            <Text>ストアページへ</Text>
          </Pressable>
        ) : null}
      </>
    );
  },
}));

jest.mock('@/ui/components/PhotoPreviewModals', () => ({
  PhotoPreviewModals: () => null,
}));

jest.mock('@/ui/components/reports/MonthlyReportScreen', () => ({
  MonthlyReportScreen: (props: any) => {
    mockLatestMonthlyReportScreenProps = props;
    return null;
  },
}));

jest.mock('@/ui/components/SettingsScreen', () => ({
  SettingsScreen: (props: any) => {
    mockLatestSettingsScreenProps = props;
    const { Pressable, Text } = require('react-native');

    return (
      <>
        <Pressable accessibilityLabel="チュートリアルを開く" onPress={props.onOpenFirstLaunchTutorial}>
          <Text>チュートリアル</Text>
        </Pressable>
        {props.hasCurrentAppUpdateNotice ? (
          <Pressable accessibilityLabel="最新の更新内容を見る" onPress={props.onOpenLatestAppUpdateNotice}>
            <Text>最新の更新内容を見る</Text>
          </Pressable>
        ) : null}
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

jest.mock('@/ui/components/LicenseScreen', () => ({
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
        <Pressable
          accessibilityLabel="react のライセンス詳細を開く"
          onPress={() => onOpenLicenseDetail({ id: 'react@19.1.0', name: 'react' })}
        >
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

jest.mock('@/ui/generated/ossLicenses', () => ({
  OSS_LICENSES: [{ id: 'react@19.1.0', name: 'react', license: 'MIT', licenseText: '', version: '19.1.0', homepage: '' }],
}));
jest.mock('@/ui/components/TopToast', () => ({ TopToast: () => null }));
jest.mock('@/ui/components/AchievementDialog', () => ({ AchievementDialog: () => null }));

jest.mock('@/ui/hooks/useAchievementDialogEffects', () => ({
  useAchievementDialogEffects: jest.fn(),
}));

jest.mock('@/ui/hooks/useKeepScreenAwake', () => ({
  useKeepScreenAwake: jest.fn(),
}));

jest.mock('@/ui/hooks/usePhotoMapOverlay', () => ({
  usePhotoMapOverlay: () => ({ photos: [], isLoadingPhotos: false, photoErrorMessage: null }),
}));

jest.mock('@/ui/hooks/useScreenTransitionOpacity', () => ({
  useScreenTransitionOpacity: () => ({ interpolate: () => 0 }),
}));

jest.mock('@/ui/hooks/useCurrentAreaName', () => ({
  useCurrentAreaLabel: () => ({ primary: '船橋市', secondary: '行田' }),
}));

jest.mock('@/ui/hooks/useForegroundUserLocation', () => ({
  useForegroundUserLocation: (options: unknown) => {
    mockLatestForegroundLocationOptions = options;
  },
}));

jest.mock('@/db/database', () => ({
  initializeDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/theme/fonts', () => ({
  loadAppFonts: jest.fn().mockResolvedValue(undefined),
  NUMERIC_DISPLAY_FONT: 'DSEG7ClassicMini-Regular',
}));

jest.mock('@/config/developmentFlags', () => ({
  developmentFlags: {
    enablePremiumAccessWithoutRevenueCat: false,
    resetAchievementsOnLaunch: false,
    logVisitedGridMetrics: false,
    logPhotoScanMetrics: false,
  },
  getPhotoScanLimitOverride: jest.fn(() => null),
  hasEnabledDevelopmentFlags: jest.fn(() => false),
  shouldResetAchievementsOnLaunch: jest.fn(() => false),
}));

jest.mock('@/features/settings/settingsRepository', () => ({
  getBooleanSetting: jest.fn().mockResolvedValue(false),
  getStringSetting: jest.fn().mockResolvedValue('default'),
  setSetting: jest.fn().mockResolvedValue(undefined),
  setSettings: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/customization/customIconStorage', () => ({
  deleteManagedCustomIcon: jest.fn().mockResolvedValue(undefined),
  isLegacyCustomIconReference: jest.fn((reference: string) => /^[A-Za-z][A-Za-z\d+.-]*:\/\//.test(reference)),
  resolveCustomIconReference: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/features/customization/customIconSelection', () => ({
  replaceCustomIconSelection: jest.fn(),
}));

jest.mock('@/features/location/locationService', () => ({
  isBackgroundLocationRecording: jest.fn().mockResolvedValue(true),
  updateBackgroundLocationTaskOptionsIfNeeded: jest.fn().mockResolvedValue(undefined),
  startBackgroundLocationRecording: jest.fn().mockResolvedValue(undefined),
  stopBackgroundLocationRecording: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/location/locationPermission', () => ({
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

jest.mock('@/features/logs/logRepository', () => ({
  deleteAllUserData: jest.fn().mockResolvedValue(undefined),
  getDailyLogs: jest.fn().mockResolvedValue([]),
  getLocationPointsBounds: jest.fn().mockResolvedValue(null),
  getLocationPointsByDate: jest.fn().mockResolvedValue([]),
  getLocationPointsByMonth: jest.fn().mockResolvedValue([]),
}));

jest.mock('expo-notifications', () => ({
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  useLastNotificationResponse: jest.fn(() => null),
}));

jest.mock('@/features/achievements/achievementNotificationService', () => ({
  initializeAchievementNotificationHandler: jest.fn(),
  requestAchievementNotificationPermissionOnFirstLaunch: jest.fn().mockResolvedValue(undefined),
  setupAchievementNotificationChannel: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/reports/monthlyReportNotificationService', () => ({
  isMonthlyReportNotification: jest.fn(() => false),
  setupMonthlyReportNotificationChannel: jest.fn().mockResolvedValue(undefined),
  syncMonthlyReportNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/achievements/achievementRepository', () => ({
  getAchievementListItems: jest.fn().mockResolvedValue([]),
  getPendingInAppAchievementNotifications: jest.fn().mockResolvedValue([]),
  markAchievementShownInApp: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/achievements/achievementEvaluationGate', () => ({
  canEvaluateAchievementsInForeground: jest.fn(() => true),
}));

jest.mock('@/features/achievements/achievementService', () => ({
  evaluateAchievementsAndNotify: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/achievements/pendingNotifications', () => ({
  filterDismissedAchievementNotifications: jest.fn(() => []),
}));

jest.mock('@/features/export/gpxExporter', () => ({
  shareGpx: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/import/gpxImportService', () => ({
  pickAndReadGpxFile: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/features/import/gpxImporter', () => ({
  parseGpxToLocationPoints: jest.fn().mockReturnValue([]),
}));

jest.mock('@/features/import/importRepository', () => ({
  GpxImportInterruptedError: class GpxImportInterruptedError extends Error {},
  importLocationPointsFromGpx: jest.fn().mockResolvedValue({ importedPointCount: 0, skippedPointCount: 0 }),
}));

jest.mock('@/features/reports/monthlyAreaReport', () => ({
  getMonthlyAreaReport: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/features/reports/monthlyReport', () => jest.requireActual('@/features/reports/monthlyReport'));

jest.mock('@/features/customization/customizationResolver', () => ({
  resolveUserLocationIcon: jest.fn(() => ({ useNativeUserLocation: true, customIconId: null })),
}));

jest.mock('@/features/customization/customizationOptions', () => ({
  DEFAULT_USER_LOCATION_ICON_ID: 'default',
  getUserLocationIconOption: jest.fn((id: string) => ({
    id,
    label: id === 'walker' ? 'さんぽ' : 'OS標準',
    premium: id === 'walker',
  })),
}));

jest.mock('@/features/premium/revenueCatAccess', () => ({
  getConfirmedPremiumAccessState: jest.fn(),
  getDefaultPremiumAccessState: jest.fn(() => ({ isPlusActive: false, entitlementId: 'strollia_plus' })),
  getPremiumAccessState: jest.fn().mockResolvedValue({ isPlusActive: true, entitlementId: 'strollia_plus' }),
  getPremiumOfferingSummary: jest.fn().mockResolvedValue(null),
  getRevenueCatAppUserId: jest.fn().mockResolvedValue(null),
  presentPremiumCustomerCenter: jest.fn().mockResolvedValue(true),
  purchasePremiumPackage: jest
    .fn()
    .mockResolvedValue({ status: 'purchased', accessState: { isPlusActive: true, entitlementId: 'strollia_plus' } }),
  restorePremiumPurchases: jest.fn().mockResolvedValue({ isPlusActive: true, entitlementId: 'strollia_plus' }),
  subscribePremiumAccessStateUpdates: jest.fn((onUpdate) => {
    mockPremiumCustomerInfoUpdate = onUpdate;
    return mockPremiumUnsubscribe;
  }),
}));

jest.mock('@/features/photos/photoClusters', () => ({
  applyResolvedPhotoUrisToClusters: jest.fn((clusters) => clusters),
  clusterMapPhotosByRadius: jest.fn(() => []),
  getPhotoClusterRadiusMeters: jest.fn(() => 10),
  getPhotoClusterRepresentativePhotos: jest.fn(() => []),
  getStablePhotoClusterRadiusMeters: jest.fn(() => 10),
  paginateMapPhotos: jest.fn(() => []),
}));

jest.mock('@/features/photos/photoLibrary', () => ({
  applyResolvedPhotoUris: jest.fn((photos) => photos),
  hasFullPhotoAccess: jest.fn(() => true),
  resolvePhotoDisplayUriMap: jest.fn().mockResolvedValue(new Map()),
}));

jest.mock('@/features/location/visitedCellRepository', () => ({
  getVisitedCellsInBounds: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/features/location/grid/gridCell', () => ({
  getGridBoundsForRegion: jest.fn((region: any) => ({
    minX: Math.round(region.latitude * 1000),
    maxX: Math.round(region.longitude * 1000),
    minY: Math.round(region.latitudeDelta * 1000),
    maxY: Math.round(region.longitudeDelta * 1000),
  })),
  isGridBoundsContained: jest.fn(() => false),
}));

const flushPromises = async () => {
  await act(async () => {
    for (let index = 0; index < 5; index += 1) {
      await Promise.resolve();
    }
  });
};

describe('App 地図復帰時の表示範囲復元', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active', writable: true });
    mockLatestSettingsScreenProps = null;
    mockLatestMapScreenProps = null;
    mockLatestMonthlyReportScreenProps = null;
    mockLatestFirstLaunchTutorialProps = null;
    mockLatestAppUpdateNoticeDialogProps = null;
    mockLatestForegroundLocationOptions = null;
    mockPremiumCustomerInfoUpdate = null;
    mockNativeApplicationVersion = '1.3.0';
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
    (getConfirmedPremiumAccessState as jest.Mock).mockImplementation(() => getPremiumAccessState());
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
    cleanup();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('別画面から地図へ戻ると現在地中心へ復元しvisited grid取得範囲も同期する', async () => {
    const userRegion = createUserCenteredRegion({ latitude: 35.681236, longitude: 139.767125 });

    renderRouter('src/app');
    await flushPromises();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('現在地更新'));
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('現在地へ戻る'));
    });

    const callsBeforeReturn = mockAnimateToRegion.mock.calls.length;
    // 直前の「現在地へ戻る」操作で既にuserRegionを引数にgetGridBoundsForRegion / getVisitedCellsInBoundsが
    // 呼ばれているため、'地図へ'を押した後だけの呼び出しをスライスして検証する(順序依存の防御を保つ)。
    const gridBoundsCallsBeforeReturn = (getGridBoundsForRegion as jest.Mock).mock.calls.length;
    const visitedCellsCallsBeforeReturn = (getVisitedCellsInBounds as jest.Mock).mock.calls.length;

    await act(async () => {
      fireEvent.press(screen.getByLabelText('日ごとの記録'));
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('地図へ'));
    });
    await flushPromises();

    expect(mockAnimateToRegion).toHaveBeenCalledTimes(callsBeforeReturn + 1);
    expect(mockAnimateToRegion).toHaveBeenLastCalledWith(userRegion, 250);

    // DB取得(先読み余白あり)と画面外判定(余白なし)の2effectがそれぞれgetGridBoundsForRegionを呼ぶため、
    // 'containToEqual'で少なくとも1回はuserRegionで呼ばれたことを確認する。呼び出し範囲を
    // '地図へ'を押した後だけに絞ることで、直前の「現在地へ戻る」操作の呼び出しを誤って
    // 合格根拠にしない(prepareMapRegionRestoreがgridSyncRegionを更新しなくなる退行を検出できる)。
    const gridBoundsCallsAfterReturn = (getGridBoundsForRegion as jest.Mock).mock.calls.slice(gridBoundsCallsBeforeReturn);
    expect(gridBoundsCallsAfterReturn).toContainEqual([userRegion, expect.any(Object)]);

    const visitedCellsCallsAfterReturn = (getVisitedCellsInBounds as jest.Mock).mock.calls.slice(visitedCellsCallsBeforeReturn);
    expect(visitedCellsCallsAfterReturn).toContainEqual([
      {
        minX: Math.round(userRegion.latitude * 1000),
        maxX: Math.round(userRegion.longitude * 1000),
        minY: Math.round(userRegion.latitudeDelta * 1000),
        maxY: Math.round(userRegion.longitudeDelta * 1000),
      },
      expect.any(Number),
    ]);
  });

  test('取得済み範囲内(isGridBoundsContained=true)の再移動ではvisited cellを再取得しない', async () => {
    (isGridBoundsContained as jest.Mock).mockReturnValue(true);

    try {
      renderRouter('src/app');
      await flushPromises();

      // 同じ範囲へ一度移動して直近取得状態を確定させる。
      await act(async () => {
        fireEvent.press(screen.getByLabelText('現在地中心へ地図移動'));
      });
      await flushPromises();
      const callsAfterFirst = (getVisitedCellsInBounds as jest.Mock).mock.calls.length;

      // 同じ範囲へ再移動 → 取得済み範囲内なので再取得しない（呼び出し回数が増えない）。
      await act(async () => {
        fireEvent.press(screen.getByLabelText('現在地中心へ地図移動'));
      });
      await flushPromises();

      expect((getVisitedCellsInBounds as jest.Mock).mock.calls.length).toBe(callsAfterFirst);
    } finally {
      (isGridBoundsContained as jest.Mock).mockReturnValue(false);
    }
  });

  test('地図ドラッグ中のonRegionChangeはgridSyncRegionを更新せずvisited cell再取得を増やさない', async () => {
    // gridOverlayRegionが `gridSyncRegion ?? initialRegion` ではなく `visibleRegion ?? initialRegion` に
    // 戻る退行が起きると、onPanDrag後でもonRegionChangeのたびにgridOverlayRegionが更新され、
    // このテストがfailする(isGridBoundsContainedを常にfalseへモックしているため、
    // regionが変わるたびに再取得条件を満たしてしまう)。
    renderRouter('src/app');
    await flushPromises();

    const callsBeforeDrag = (getVisitedCellsInBounds as jest.Mock).mock.calls.length;

    await act(async () => {
      fireEvent.press(screen.getByLabelText('地図をドラッグ'));
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('ドラッグ中に地図範囲を更新'));
    });
    await flushPromises();

    expect((getVisitedCellsInBounds as jest.Mock).mock.calls.length).toBe(callsBeforeDrag);
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

    renderRouter('src/app');
    await flushPromises();

    expect(screen.toJSON()).toBeTruthy();
    expect(startBackgroundLocationRecording).not.toHaveBeenCalled();

    await act(async () => {
      appStateHandler?.('active');
    });
    await flushPromises();

    expect(startBackgroundLocationRecording).toHaveBeenCalledTimes(1);
  });

  test('すでに記録中なら起動後に記録開始を重複実行しない', async () => {
    (isBackgroundLocationRecording as jest.Mock).mockResolvedValue(true);

    renderRouter('src/app');
    await flushPromises();

    expect(screen.toJSON()).toBeTruthy();
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

    renderRouter('src/app');
    await flushPromises();

    expect(stopBackgroundLocationRecording).toHaveBeenCalledTimes(1);
    expect(updateBackgroundLocationTaskOptionsIfNeeded).not.toHaveBeenCalled();
    expect(mockLatestForegroundLocationOptions).toMatchObject({ enabled: true, shouldPersist: true });
  });

  test('常時許可では権限取得後に背景タスク設定を更新し、OS標準アイコンの前景監視を開始しない', async () => {
    renderRouter('src/app');
    await flushPromises();

    expect((getLocationPermissionState as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (updateBackgroundLocationTaskOptionsIfNeeded as jest.Mock).mock.invocationCallOrder[0],
    );
    expect(stopBackgroundLocationRecording).not.toHaveBeenCalled();
    expect(mockLatestForegroundLocationOptions).toMatchObject({ enabled: false, shouldPersist: false });
  });

  test('常時許可かつカスタムアイコンでは表示用前景監視を1つ使い、前景保存しない', async () => {
    (resolveUserLocationIcon as jest.Mock).mockReturnValue({
      useNativeUserLocation: false,
      customIconId: 'walker',
      customImageUri: null,
    });

    renderRouter('src/app');
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

    renderRouter('src/app');
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

    renderRouter('src/app');
    await flushPromises();

    expect(mockLatestForegroundLocationOptions).toMatchObject({ enabled: false, shouldPersist: false });
  });

  test('起動後にRevenueCat由来のPlus状態を読み込む', async () => {
    renderRouter('src/app');
    await flushPromises();

    expect(getPremiumAccessState).toHaveBeenCalledTimes(1);
  });

  test('起動後にRevenueCat Offeringを読み込む', async () => {
    renderRouter('src/app');
    await flushPromises();

    expect(getPremiumOfferingSummary).toHaveBeenCalledTimes(1);
  });

  test('起動時にRevenueCat App User IDを取得し設定画面へ渡す', async () => {
    (getRevenueCatAppUserId as jest.Mock).mockResolvedValueOnce('$RCAnonymousID:abc123');

    renderRouter('src/app');
    await flushPromises();

    expect(getRevenueCatAppUserId).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('設定'));
    });
    expect(mockLatestSettingsScreenProps.revenueCatAppUserId).toBe('$RCAnonymousID:abc123');
  });

  test('初回チュートリアル未完了の場合は初回チュートリアルを表示する', async () => {
    renderRouter('src/app');
    await flushPromises();

    expect(screen.getByLabelText('初回チュートリアルを完了')).toBeTruthy();
  });

  test('初回チュートリアル完了済みの未読現在版は自動起点で表示し、閉じると既読版を保存する', async () => {
    (getBooleanSetting as jest.Mock).mockImplementation((key: string, fallback: boolean) =>
      Promise.resolve(key === 'firstLaunchTutorialCompleted' ? true : fallback),
    );
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) =>
      Promise.resolve(key === 'lastAcknowledgedUpdateNoticeVersion' ? '' : fallback),
    );

    renderRouter('src/app');
    await flushPromises();

    expect(screen.getByText('更新通知:automatic')).toBeTruthy();
    expect(mockLatestAppUpdateNoticeDialogProps).toEqual(
      expect.objectContaining({
        visible: true,
        source: 'automatic',
        notice: expect.objectContaining({ version: '1.3.0' }),
      }),
    );
    expect(screen.queryByLabelText('ストアページへ')).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('更新通知を閉じる'));
    });

    expect(setSetting).toHaveBeenCalledWith('lastAcknowledgedUpdateNoticeVersion', '1.3.0');
  });

  test('設定画面からは設定起点で再表示し、ストア導線を出しても閉じるだけでは既読版を書き込まない', async () => {
    (getBooleanSetting as jest.Mock).mockImplementation((key: string, fallback: boolean) =>
      Promise.resolve(key === 'firstLaunchTutorialCompleted' ? true : fallback),
    );
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) =>
      Promise.resolve(key === 'lastAcknowledgedUpdateNoticeVersion' ? '1.3.0' : fallback),
    );

    renderRouter('src/app');
    await flushPromises();

    expect(screen.queryByText('更新通知:automatic')).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('設定'));
    });

    expect(mockLatestSettingsScreenProps.hasCurrentAppUpdateNotice).toBe(true);
    await act(async () => {
      fireEvent.press(screen.getByLabelText('最新の更新内容を見る'));
    });

    expect(screen.getByText('更新通知:settings')).toBeTruthy();
    expect(screen.getByLabelText('ストアページへ')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('更新通知を閉じる'));
    });

    expect(setSetting).not.toHaveBeenCalledWith('lastAcknowledgedUpdateNoticeVersion', expect.anything());
  });

  test('現在版と通知版が一致しないと設定導線と更新通知を表示しない', async () => {
    mockNativeApplicationVersion = '1.3.1';
    (getBooleanSetting as jest.Mock).mockImplementation((key: string, fallback: boolean) =>
      Promise.resolve(key === 'firstLaunchTutorialCompleted' ? true : fallback),
    );

    renderRouter('src/app');
    await flushPromises();

    expect(screen.queryByLabelText('更新通知を閉じる')).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('設定'));
    });
    expect(mockLatestSettingsScreenProps.hasCurrentAppUpdateNotice).toBe(false);
    expect(screen.queryByLabelText('最新の更新内容を見る')).toBeNull();
  });

  test('実行中のネイティブ版を取得できないと設定導線と更新通知を表示しない', async () => {
    mockNativeApplicationVersion = null;
    (getBooleanSetting as jest.Mock).mockImplementation((key: string, fallback: boolean) =>
      Promise.resolve(key === 'firstLaunchTutorialCompleted' ? true : fallback),
    );

    renderRouter('src/app');
    await flushPromises();

    expect(screen.queryByLabelText('更新通知を閉じる')).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('設定'));
    });
    expect(mockLatestSettingsScreenProps.hasCurrentAppUpdateNotice).toBe(false);
    expect(screen.queryByLabelText('最新の更新内容を見る')).toBeNull();
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

    renderRouter('src/app');
    await flushPromises();

    expect(mockLatestMapScreenProps.showPhotosOnMap).toBe(false);
    expect(setSetting).toHaveBeenCalledWith('showPhotosOnMap', false);
    expect(setSetting).toHaveBeenCalledWith('showPhotosOnMapEnablePending', false);
  });

  test('滞在場所表示設定を更新してSQLiteへ保存する', async () => {
    (getBooleanSetting as jest.Mock).mockImplementation((key: string, fallback: boolean) => Promise.resolve(fallback));

    renderRouter('src/app');
    await flushPromises();

    expect(mockLatestMapScreenProps.showStayPlacesOnMap).toBe(true);

    await act(async () => {
      await mockLatestMapScreenProps.onUpdateShowStayPlacesOnMap(false);
    });

    expect(setSetting).toHaveBeenCalledWith('showStayPlacesOnMap', false);
    expect(mockLatestMapScreenProps.showStayPlacesOnMap).toBe(false);
  });

  test('滞在場所表示設定を連続更新してもSQLiteへ要求順に保存する', async () => {
    renderRouter('src/app');
    await flushPromises();

    let resolveFirstWrite: (() => void) | undefined;
    const firstWrite = new Promise<void>((resolve) => {
      resolveFirstWrite = resolve;
    });
    (setSetting as jest.Mock).mockClear();
    (setSetting as jest.Mock).mockImplementation((key: string, value: boolean) => {
      if (key === 'showStayPlacesOnMap' && value === false) {
        return firstWrite;
      }
      return Promise.resolve();
    });

    let firstUpdate!: Promise<void>;
    let secondUpdate!: Promise<void>;
    act(() => {
      firstUpdate = mockLatestMapScreenProps.onUpdateShowStayPlacesOnMap(false);
      secondUpdate = mockLatestMapScreenProps.onUpdateShowStayPlacesOnMap(true);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(setSetting).toHaveBeenCalledTimes(1);
    expect(setSetting).toHaveBeenNthCalledWith(1, 'showStayPlacesOnMap', false);

    await act(async () => {
      resolveFirstWrite?.();
      await Promise.all([firstUpdate, secondUpdate]);
    });

    expect(setSetting).toHaveBeenNthCalledWith(2, 'showStayPlacesOnMap', true);
    expect(mockLatestMapScreenProps.showStayPlacesOnMap).toBe(true);
  });

  test('古い滞在場所表示設定の保存失敗では最新の表示要求を巻き戻さない', async () => {
    renderRouter('src/app');
    await flushPromises();

    let rejectFirstWrite: ((error: Error) => void) | undefined;
    const firstWrite = new Promise<void>((_resolve, reject) => {
      rejectFirstWrite = reject;
    });
    (setSetting as jest.Mock).mockClear();
    (setSetting as jest.Mock).mockImplementationOnce(() => firstWrite).mockResolvedValueOnce(undefined);

    let firstUpdate!: Promise<void>;
    let secondUpdate!: Promise<void>;
    act(() => {
      firstUpdate = mockLatestMapScreenProps.onUpdateShowStayPlacesOnMap(false);
      secondUpdate = mockLatestMapScreenProps.onUpdateShowStayPlacesOnMap(false);
    });

    await act(async () => {
      rejectFirstWrite?.(new Error('save failed'));
      await expect(firstUpdate).rejects.toThrow('save failed');
      await secondUpdate;
    });

    expect(setSetting).toHaveBeenCalledTimes(2);
    expect(mockLatestMapScreenProps.showStayPlacesOnMap).toBe(false);
  });

  test('最新の滞在場所表示設定を保存できない場合は保存済みの表示状態へ戻してエラーを返す', async () => {
    renderRouter('src/app');
    await flushPromises();

    (setSetting as jest.Mock).mockRejectedValueOnce(new Error('save failed'));

    await act(async () => {
      await expect(mockLatestMapScreenProps.onUpdateShowStayPlacesOnMap(false)).rejects.toThrow('save failed');
    });

    expect(mockLatestMapScreenProps.showStayPlacesOnMap).toBe(true);
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

    renderRouter('src/app');
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
    const enabledWriteIndex = (setSetting as jest.Mock).mock.calls.findIndex(([key, value]) => key === 'showPhotosOnMap' && value === true);
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

    renderRouter('src/app');
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

  test('初回チュートリアル完了時に完了フラグと現在版通知の既読を原子的に保存する', async () => {
    renderRouter('src/app');
    await flushPromises();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('初回チュートリアルを完了'));
    });

    expect(setSettings).toHaveBeenCalledWith([
      { key: 'firstLaunchTutorialCompleted', value: true },
      { key: 'lastAcknowledgedUpdateNoticeVersion', value: '1.3.0' },
    ]);
  });

  test('初回チュートリアル未完了の場合は通知権限要求を完了後まで遅らせる', async () => {
    renderRouter('src/app');
    await flushPromises();

    expect(requestAchievementNotificationPermissionOnFirstLaunch).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('初回チュートリアルを完了'));
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

    renderRouter('src/app');
    await flushPromises();

    expect(screen.queryAllByLabelText('初回チュートリアルを完了')).toHaveLength(0);
  });

  test('初回チュートリアル完了済みの場合は起動時に通知権限要求を実行する', async () => {
    (getBooleanSetting as jest.Mock).mockImplementation((key: string, fallback: boolean) => {
      if (key === 'firstLaunchTutorialCompleted') {
        return Promise.resolve(true);
      }

      return Promise.resolve(fallback);
    });

    renderRouter('src/app');
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

    renderRouter('src/app');
    await flushPromises();

    expect(screen.queryAllByLabelText('初回チュートリアルを完了')).toHaveLength(0);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('設定'));
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('チュートリアルを開く'));
    });

    expect(screen.getByLabelText('初回チュートリアルを完了')).toBeTruthy();
    expect(mockLatestFirstLaunchTutorialProps.completionButtonLabel).toBe('閉じる');
  });

  test('設定画面から再表示したチュートリアルを閉じても初回完了処理を再実行しない', async () => {
    (getBooleanSetting as jest.Mock).mockImplementation((key: string, fallback: boolean) => {
      if (key === 'firstLaunchTutorialCompleted') {
        return Promise.resolve(true);
      }

      return Promise.resolve(fallback);
    });

    renderRouter('src/app');
    await flushPromises();

    jest.clearAllMocks();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('設定'));
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('チュートリアルを開く'));
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('初回チュートリアルを完了'));
    });
    await flushPromises();

    expect(setSetting).not.toHaveBeenCalledWith('firstLaunchTutorialCompleted', true);
    expect(requestAchievementNotificationPermissionOnFirstLaunch).not.toHaveBeenCalled();
  });

  test('起動時にRevenueCat CustomerInfo更新を購読しアンマウント時に解除する', async () => {
    const renderResult = renderRouter('src/app');
    await flushPromises();

    expect(subscribePremiumAccessStateUpdates).toHaveBeenCalledTimes(1);

    act(() => {
      renderResult.unmount();
    });

    expect(mockPremiumUnsubscribe).toHaveBeenCalledTimes(1);
  });

  test('RevenueCat CustomerInfo更新でPlus状態を画面へ反映する', async () => {
    renderRouter('src/app');
    await flushPromises();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('設定'));
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

    renderRouter('src/app');
    await flushPromises();

    expect(mockLatestMapScreenProps.userLocationIcon.customImageUri).toBe('file:///documents/strollia-custom-icons/saved.jpg');
  });

  test('初回Plus取得エラーは未確定として保存済みカスタムアイコンを維持する', async () => {
    (getConfirmedPremiumAccessState as jest.Mock).mockRejectedValue(new Error('network failed'));
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'userLocationIcon') return Promise.resolve('custom');
      if (key === 'customIconImageUri') return Promise.resolve('managed:saved.jpg');
      return Promise.resolve(fallback);
    });
    (resolveCustomIconReference as jest.Mock).mockResolvedValue({
      reference: 'managed:saved.jpg',
      uri: 'file:///saved.jpg',
      migrated: false,
    });
    (resolveUserLocationIcon as jest.Mock).mockImplementation((id, plus, uri) => ({
      useNativeUserLocation: !(id === 'custom' && plus && uri),
      customIconId: null,
      customImageUri: id === 'custom' && plus ? uri : null,
    }));

    renderRouter('src/app');
    await flushPromises();
    expect(mockLatestMapScreenProps.userLocationIcon.customImageUri).toBe('file:///saved.jpg');

    act(() => {
      mockPremiumCustomerInfoUpdate?.({ isPlusActive: false, entitlementId: 'strollia_plus' });
    });
    expect(mockLatestMapScreenProps.userLocationIcon.useNativeUserLocation).toBe(true);
  });

  test('初回Plus取得が無効で成功した場合は保存済みwalkerをOS標準表示にする', async () => {
    (getConfirmedPremiumAccessState as jest.Mock).mockResolvedValue({ isPlusActive: false, entitlementId: 'strollia_plus' });
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) =>
      key === 'userLocationIcon' ? Promise.resolve('walker') : Promise.resolve(fallback),
    );
    (resolveUserLocationIcon as jest.Mock).mockImplementation((id, plus) => ({
      useNativeUserLocation: id === 'default' || !plus,
      customIconId: plus ? id : null,
      customImageUri: null,
    }));

    renderRouter('src/app');
    await flushPromises();

    expect(mockLatestMapScreenProps.userLocationIcon.useNativeUserLocation).toBe(true);
  });

  test('Plus状態の取得待機中は地図を描画せず、制限時間後は保存済みwalkerだけを維持して起動する', async () => {
    jest.useFakeTimers();
    let resolvePremium!: (value: { isPlusActive: boolean; entitlementId: string }) => void;
    (getPremiumAccessState as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolvePremium = resolve;
      }),
    );
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'userLocationIcon') return Promise.resolve('walker');
      return Promise.resolve(fallback);
    });
    (resolveUserLocationIcon as jest.Mock).mockImplementation((id, plus) => ({
      useNativeUserLocation: !(id === 'walker' && plus),
      customIconId: id === 'walker' && plus ? 'walker' : null,
      customImageUri: null,
    }));

    renderRouter('src/app');
    await flushPromises();
    expect(mockLatestMapScreenProps).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    await flushPromises();
    expect(mockLatestMapScreenProps).not.toBeNull();
    expect(mockLatestMapScreenProps.userLocationIcon.customIconId).toBe('walker');
    expect(setSettings).not.toHaveBeenCalled();
    expect(setSetting).not.toHaveBeenCalledWith('userLocationIcon', 'default');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('設定'));
    });
    expect(mockLatestSettingsScreenProps.premiumAccessState.isPlusActive).toBe(false);

    await act(async () => {
      resolvePremium({ isPlusActive: true, entitlementId: 'strollia_plus' });
    });
    await flushPromises();
    jest.useRealTimers();
  });

  test('Plus状態が未確定でも保存済みOS標準アイコンはOS標準のまま表示する', async () => {
    jest.useFakeTimers();
    (getPremiumAccessState as jest.Mock).mockReturnValue(new Promise(() => undefined));
    (resolveUserLocationIcon as jest.Mock).mockImplementation((id, plus) => ({
      useNativeUserLocation: id === 'default' || !plus,
      customIconId: null,
      customImageUri: null,
    }));

    renderRouter('src/app');
    await flushPromises();
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    await flushPromises();

    expect(mockLatestMapScreenProps.userLocationIcon.useNativeUserLocation).toBe(true);
  });

  test('Plus初期取得待機中にアンマウントするとタイマーと残りの起動処理を中止する', async () => {
    jest.useFakeTimers();
    let resolvePremium!: (value: { isPlusActive: boolean; entitlementId: string }) => void;
    (getPremiumAccessState as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolvePremium = resolve;
      }),
    );

    // renderRouter が内部で jest.useFakeTimers() を呼び直すため、
    // clearTimeoutSpy はその後に設定する必要がある。
    const renderResult = renderRouter('src/app');
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    await flushPromises();
    expect(jest.getTimerCount()).toBeGreaterThan(0);

    act(() => {
      renderResult.unmount();
    });
    // アンマウント後の非同期AbortError伝播を待つ
    await flushPromises();
    expect(clearTimeoutSpy).toHaveBeenCalled();

    await act(async () => {
      resolvePremium({ isPlusActive: true, entitlementId: 'strollia_plus' });
      jest.advanceTimersByTime(3000);
    });
    await flushPromises();
    expect(mockLatestMapScreenProps).toBeNull();
  });

  test('初期データ読込待機中にアンマウントした場合は読込結果を状態反映せず記録同期へ進まない', async () => {
    let resolveLogs!: (value: never[]) => void;
    (getDailyLogs as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveLogs = resolve;
      }),
    );

    const renderResult = renderRouter('src/app');
    await flushPromises();
    expect(getDailyLogs).toHaveBeenCalled();

    act(() => {
      renderResult.unmount();
    });
    jest.clearAllMocks();
    await act(async () => {
      resolveLogs([]);
    });
    await flushPromises();

    expect(updateBackgroundLocationTaskOptionsIfNeeded).not.toHaveBeenCalled();
    expect(startBackgroundLocationRecording).not.toHaveBeenCalled();
    expect(getMonthlyAreaReport).not.toHaveBeenCalled();
    expect(mockLatestMapScreenProps).toBeNull();
  });

  test('初期自動記録の端末処理待機中にアンマウントした場合は再読込と状態反映を行わない', async () => {
    let resolveStart!: () => void;
    (isBackgroundLocationRecording as jest.Mock).mockResolvedValue(false);
    (startBackgroundLocationRecording as jest.Mock).mockReturnValue(
      new Promise<void>((resolve) => {
        resolveStart = resolve;
      }),
    );

    const renderResult = renderRouter('src/app');
    await flushPromises();
    expect(startBackgroundLocationRecording).toHaveBeenCalledTimes(1);

    act(() => {
      renderResult.unmount();
    });
    jest.clearAllMocks();
    await act(async () => {
      resolveStart();
    });
    await flushPromises();

    expect(getDailyLogs).not.toHaveBeenCalled();
    expect(mockLatestMapScreenProps).toBeNull();
  });

  test('初期実績読込待機中にアンマウントした場合は実績状態と通知キューを更新しない', async () => {
    let resolveItems!: (value: never[]) => void;
    let resolvePending!: (value: never[]) => void;
    (getAchievementListItems as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveItems = resolve;
      }),
    );
    (getPendingInAppAchievementNotifications as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolvePending = resolve;
      }),
    );

    const renderResult = renderRouter('src/app');
    await flushPromises();
    expect(getAchievementListItems).toHaveBeenCalled();
    expect(getPendingInAppAchievementNotifications).toHaveBeenCalled();

    act(() => {
      renderResult.unmount();
    });
    jest.clearAllMocks();
    await act(async () => {
      resolveItems([]);
      resolvePending([]);
    });
    await flushPromises();

    expect(filterDismissedAchievementNotifications).not.toHaveBeenCalled();
    expect(mockLatestMapScreenProps).toBeNull();
  });

  test('タイムアウト直後から保存済みカスタムアイコンを維持し、遅延した確定falseでOS標準へ切り替える', async () => {
    jest.useFakeTimers();
    let resolvePremium!: (value: { isPlusActive: boolean; entitlementId: string }) => void;
    (getPremiumAccessState as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolvePremium = resolve;
      }),
    );
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'userLocationIcon') return Promise.resolve('custom');
      if (key === 'customIconImageUri') return Promise.resolve('managed:saved.jpg');
      return Promise.resolve(fallback);
    });
    (resolveCustomIconReference as jest.Mock).mockResolvedValue({
      reference: 'managed:saved.jpg',
      uri: 'file:///saved.jpg',
      migrated: false,
    });
    (resolveUserLocationIcon as jest.Mock).mockImplementation((id, plus, uri) => ({
      useNativeUserLocation: !(id === 'custom' && plus && uri),
      customIconId: null,
      customImageUri: id === 'custom' && plus ? uri : null,
    }));

    renderRouter('src/app');
    await flushPromises();
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    await flushPromises();
    expect(mockLatestMapScreenProps.userLocationIcon.customImageUri).toBe('file:///saved.jpg');

    await act(async () => {
      resolvePremium({ isPlusActive: false, entitlementId: 'strollia_plus' });
    });
    await flushPromises();
    expect(mockLatestMapScreenProps.userLocationIcon.useNativeUserLocation).toBe(true);
    expect(setSettings).not.toHaveBeenCalled();
  });

  test('タイムアウト後の遅延した確定trueでも保存済みwalkerを維持する', async () => {
    jest.useFakeTimers();
    let resolvePremium!: (value: { isPlusActive: boolean; entitlementId: string }) => void;
    (getPremiumAccessState as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolvePremium = resolve;
      }),
    );
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) =>
      key === 'userLocationIcon' ? Promise.resolve('walker') : Promise.resolve(fallback),
    );
    (resolveUserLocationIcon as jest.Mock).mockImplementation((id, plus) => ({
      useNativeUserLocation: !(id === 'walker' && plus),
      customIconId: id === 'walker' && plus ? 'walker' : null,
      customImageUri: null,
    }));

    renderRouter('src/app');
    await flushPromises();
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    await flushPromises();
    expect(mockLatestMapScreenProps.userLocationIcon.customIconId).toBe('walker');

    await act(async () => {
      resolvePremium({ isPlusActive: true, entitlementId: 'strollia_plus' });
    });
    await flushPromises();
    expect(mockLatestMapScreenProps.userLocationIcon.customIconId).toBe('walker');
  });

  test('タイムアウト後の購読更新を遅延した古い初回取得結果で上書きしない', async () => {
    jest.useFakeTimers();
    let resolvePremium!: (value: { isPlusActive: boolean; entitlementId: string }) => void;
    (getPremiumAccessState as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolvePremium = resolve;
      }),
    );
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) =>
      key === 'userLocationIcon' ? Promise.resolve('walker') : Promise.resolve(fallback),
    );
    (resolveUserLocationIcon as jest.Mock).mockImplementation((id, plus) => ({
      useNativeUserLocation: !(id === 'walker' && plus),
      customIconId: id === 'walker' && plus ? 'walker' : null,
      customImageUri: null,
    }));

    renderRouter('src/app');
    await flushPromises();
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    await flushPromises();
    act(() => {
      mockPremiumCustomerInfoUpdate?.({ isPlusActive: true, entitlementId: 'strollia_plus' });
    });
    await act(async () => {
      resolvePremium({ isPlusActive: false, entitlementId: 'strollia_plus' });
    });
    await flushPromises();

    expect(mockLatestMapScreenProps.userLocationIcon.customIconId).toBe('walker');
  });

  test('初回Plus取得中の購読更新を古い取得結果で上書きしない', async () => {
    let resolvePremium!: (value: { isPlusActive: boolean; entitlementId: string }) => void;
    (getPremiumAccessState as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolvePremium = resolve;
      }),
    );
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) =>
      key === 'userLocationIcon' ? Promise.resolve('walker') : Promise.resolve(fallback),
    );
    (resolveUserLocationIcon as jest.Mock).mockImplementation((id, plus) => ({
      useNativeUserLocation: !(id === 'walker' && plus),
      customIconId: id === 'walker' && plus ? 'walker' : null,
      customImageUri: null,
    }));

    renderRouter('src/app');
    await flushPromises();
    act(() => {
      mockPremiumCustomerInfoUpdate?.({ isPlusActive: true, entitlementId: 'strollia_plus' });
    });
    await act(async () => {
      resolvePremium({ isPlusActive: false, entitlementId: 'strollia_plus' });
    });
    await flushPromises();

    expect(mockLatestMapScreenProps.userLocationIcon.customIconId).toBe('walker');
  });

  test('カスタム画像の読込エラーはセッション内だけOS標準へ戻し設定を消さない', async () => {
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'userLocationIcon') return Promise.resolve('custom');
      if (key === 'customIconImageUri') return Promise.resolve('managed:saved.jpg');
      return Promise.resolve(fallback);
    });
    (resolveCustomIconReference as jest.Mock).mockResolvedValue({
      reference: 'managed:saved.jpg',
      uri: 'file:///saved.jpg',
      migrated: false,
    });
    (resolveUserLocationIcon as jest.Mock).mockImplementation((id, plus, uri) => ({
      useNativeUserLocation: !uri,
      customIconId: null,
      customImageUri: uri,
    }));

    renderRouter('src/app');
    await flushPromises();
    jest.clearAllMocks();
    await act(async () => {
      mockLatestMapScreenProps.onCustomIconError();
    });

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
    (resolveUserLocationIcon as jest.Mock).mockImplementation((_id, _plus, uri) => ({
      useNativeUserLocation: !uri,
      customIconId: null,
      customImageUri: uri,
    }));
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///crop.jpg' }] });
    const alertSpy = jest.spyOn(Alert, 'alert');

    renderRouter('src/app');
    await flushPromises();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('設定'));
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('カスタムアイコンを選ぶ'));
    });
    await flushPromises();

    expect(replaceCustomIconSelection).toHaveBeenCalledWith(
      expect.objectContaining({ sourceUri: 'file:///crop.jpg', previousReference: 'managed:old.jpg' }),
    );
    expect(setSettings).toHaveBeenCalledWith([
      { key: 'customIconImageUri', value: 'managed:new.jpg' },
      { key: 'userLocationIcon', value: 'custom' },
    ]);
    expect(mockLatestSettingsScreenProps.selectedUserLocationIconId).toBe('custom');
    expect(alertSpy).not.toHaveBeenCalledWith('カスタムアイコン', expect.anything());
  });

  test('写真の置換に失敗した場合は以前の設定を保持して通知する', async () => {
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'userLocationIcon') return Promise.resolve('custom');
      if (key === 'customIconImageUri') return Promise.resolve('managed:old.jpg');
      return Promise.resolve(fallback);
    });
    (resolveCustomIconReference as jest.Mock).mockResolvedValue({ reference: 'managed:old.jpg', uri: 'file:///old.jpg', migrated: false });
    (resolveUserLocationIcon as jest.Mock).mockImplementation((_id, _plus, uri) => ({
      useNativeUserLocation: !uri,
      customIconId: null,
      customImageUri: uri,
    }));
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///crop.jpg' }] });
    (replaceCustomIconSelection as jest.Mock).mockRejectedValue(new Error('保存失敗'));
    const alertSpy = jest.spyOn(Alert, 'alert');

    renderRouter('src/app');
    await flushPromises();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('設定'));
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('カスタムアイコンを選ぶ'));
    });
    await flushPromises();

    expect(mockLatestSettingsScreenProps.selectedUserLocationIconId).toBe('custom');
    expect(mockLatestMapScreenProps.userLocationIcon.customImageUri).toBe('file:///old.jpg');
    expect(alertSpy).toHaveBeenCalledWith('設定失敗', expect.stringContaining('以前の設定'));
  });

  test('以前のカスタム参照がない写真設定失敗では保持メッセージを表示しない', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///crop.jpg' }] });
    (replaceCustomIconSelection as jest.Mock).mockRejectedValue(new Error('保存失敗'));
    const alertSpy = jest.spyOn(Alert, 'alert');

    renderRouter('src/app');
    await flushPromises();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('設定'));
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('カスタムアイコンを選ぶ'));
    });
    await flushPromises();

    expect(alertSpy).toHaveBeenCalledWith('設定失敗', expect.not.stringContaining('以前の設定'));
  });

  test('カスタム写真選択を連続実行しても置換処理は1件だけ開始する', async () => {
    let resolvePermission!: (value: { granted: boolean }) => void;
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolvePermission = resolve;
      }),
    );

    renderRouter('src/app');
    await flushPromises();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('設定'));
    });
    act(() => {
      fireEvent.press(screen.getByLabelText('カスタムアイコンを選ぶ'));
      fireEvent.press(screen.getByLabelText('カスタムアイコンを選ぶ'));
    });

    expect(ImagePicker.requestMediaLibraryPermissionsAsync).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolvePermission({ granted: false });
    });
    await flushPromises();
  });

  test('読み込める旧URIを管理参照へ移行して保存する', async () => {
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) =>
      key === 'customIconImageUri' ? Promise.resolve('file:///legacy.jpg') : Promise.resolve(fallback),
    );
    (resolveCustomIconReference as jest.Mock).mockResolvedValue({
      reference: 'managed:migrated.jpg',
      uri: 'file:///managed.jpg',
      migrated: true,
    });

    renderRouter('src/app');
    await flushPromises();

    expect(setSetting).toHaveBeenCalledWith('customIconImageUri', 'managed:migrated.jpg');
  });

  test('旧URI移行後のDB保存に失敗した場合は新規ファイルを削除して旧URI表示を維持する', async () => {
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'userLocationIcon') return Promise.resolve('custom');
      if (key === 'customIconImageUri') return Promise.resolve('file:///legacy.jpg');
      return Promise.resolve(fallback);
    });
    (resolveCustomIconReference as jest.Mock).mockResolvedValue({
      reference: 'managed:migrated.jpg',
      uri: 'file:///managed.jpg',
      migrated: true,
    });
    (setSetting as jest.Mock).mockImplementation((key: string) =>
      key === 'customIconImageUri' ? Promise.reject(new Error('DB失敗')) : Promise.resolve(),
    );
    (resolveUserLocationIcon as jest.Mock).mockImplementation((_id, _plus, uri) => ({
      useNativeUserLocation: !uri,
      customIconId: null,
      customImageUri: uri,
    }));

    renderRouter('src/app');
    await flushPromises();

    expect(deleteManagedCustomIcon).toHaveBeenCalledWith('managed:migrated.jpg');
    expect(mockLatestMapScreenProps.userLocationIcon.customImageUri).toBe('file:///legacy.jpg');
  });

  test('旧URIの移行コピー失敗時はDBを変更せず有効な旧URIを表示する', async () => {
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'userLocationIcon') return Promise.resolve('custom');
      if (key === 'customIconImageUri') return Promise.resolve('file:///legacy.jpg');
      return Promise.resolve(fallback);
    });
    (resolveCustomIconReference as jest.Mock).mockResolvedValue({
      reference: 'file:///legacy.jpg',
      uri: 'file:///legacy.jpg',
      migrated: false,
      migrationFailed: true,
    });
    (resolveUserLocationIcon as jest.Mock).mockImplementation((_id, _plus, uri) => ({
      useNativeUserLocation: !uri,
      customIconId: null,
      customImageUri: uri,
    }));

    renderRouter('src/app');
    await flushPromises();

    expect(mockLatestMapScreenProps.userLocationIcon.customImageUri).toBe('file:///legacy.jpg');
    expect(setSetting).not.toHaveBeenCalledWith('customIconImageUri', expect.anything());
  });

  test('旧URI移行の設定保存待機中にアンマウントした場合は掃除後の状態更新と起動処理を行わない', async () => {
    let rejectMigration!: (error: Error) => void;
    const migrationSave = new Promise<void>((_resolve, reject) => {
      rejectMigration = reject;
    });
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'userLocationIcon') return Promise.resolve('custom');
      if (key === 'customIconImageUri') return Promise.resolve('file:///legacy.jpg');
      return Promise.resolve(fallback);
    });
    (resolveCustomIconReference as jest.Mock).mockResolvedValue({
      reference: 'managed:migrated.jpg',
      uri: 'file:///managed.jpg',
      migrated: true,
    });
    (setSetting as jest.Mock).mockImplementation((key: string) => (key === 'customIconImageUri' ? migrationSave : Promise.resolve()));

    const renderResult = renderRouter('src/app');
    await flushPromises();
    expect(setSetting).toHaveBeenCalledWith('customIconImageUri', 'managed:migrated.jpg');

    act(() => {
      renderResult.unmount();
    });
    jest.clearAllMocks();
    rejectMigration(new Error('DB失敗'));
    await flushPromises();

    expect(deleteManagedCustomIcon).toHaveBeenCalledWith('managed:migrated.jpg');
    expect(setupAchievementNotificationChannel).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalledWith('Failed to persist migrated custom icon reference:', expect.anything());
    expect(mockLatestMapScreenProps).toBeNull();
  });

  test('消えた旧URIは保存設定を原子的にOS標準へ戻して案内する', async () => {
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'userLocationIcon') return Promise.resolve('custom');
      if (key === 'customIconImageUri') return Promise.resolve('file:///missing.jpg');
      return Promise.resolve(fallback);
    });
    (resolveCustomIconReference as jest.Mock).mockResolvedValue(null);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    renderRouter('src/app');
    await flushPromises();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('設定'));
    });

    expect(setSettings).toHaveBeenCalledWith([
      { key: 'customIconImageUri', value: '' },
      { key: 'userLocationIcon', value: 'default' },
    ]);
    expect(mockLatestSettingsScreenProps.selectedUserLocationIconId).toBe('default');
    expect(alertSpy).toHaveBeenCalledWith(
      'カスタムアイコンを読み込めませんでした',
      '保存されていた画像を読み込めなかったため、現在地アイコンをOS標準に戻しました。カスタムアイコンを使用する場合は、設定画面から画像を再設定してください。',
    );
  });

  test('消えた管理参照は保存設定を原子的にOS標準へ戻すが旧URI向け案内は表示しない', async () => {
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'userLocationIcon') return Promise.resolve('custom');
      if (key === 'customIconImageUri') return Promise.resolve('managed:missing.jpg');
      return Promise.resolve(fallback);
    });
    (resolveCustomIconReference as jest.Mock).mockResolvedValue(null);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    renderRouter('src/app');
    await flushPromises();

    expect(setSettings).toHaveBeenCalledWith([
      { key: 'customIconImageUri', value: '' },
      { key: 'userLocationIcon', value: 'default' },
    ]);
    expect(isLegacyCustomIconReference).toHaveBeenCalledWith('managed:missing.jpg');
    expect(alertSpy).not.toHaveBeenCalledWith('カスタムアイコンを読み込めませんでした', expect.anything());
  });

  test('画像参照が空のカスタム設定は保存設定を原子的にOS標準へ戻す', async () => {
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'userLocationIcon') return Promise.resolve('custom');
      if (key === 'customIconImageUri') return Promise.resolve('');
      return Promise.resolve(fallback);
    });
    (resolveCustomIconReference as jest.Mock).mockResolvedValue(null);

    renderRouter('src/app');
    await flushPromises();

    expect(setSettings).toHaveBeenCalledWith([
      { key: 'customIconImageUri', value: '' },
      { key: 'userLocationIcon', value: 'default' },
    ]);
  });

  test('画像参照の解決が一時エラーの場合は設定を変更せずセッション中だけOS標準を表示する', async () => {
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'userLocationIcon') return Promise.resolve('custom');
      if (key === 'customIconImageUri') return Promise.resolve('managed:saved.jpg');
      return Promise.resolve(fallback);
    });
    (resolveCustomIconReference as jest.Mock).mockRejectedValue(new Error('一時エラー'));

    renderRouter('src/app');
    await flushPromises();

    expect(setSettings).not.toHaveBeenCalled();
    expect(mockLatestMapScreenProps.userLocationIcon.useNativeUserLocation).toBe(true);
  });

  test('消えた画像参照の設定リセットに失敗してもセッション中はOS標準へ戻して警告する', async () => {
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'userLocationIcon') return Promise.resolve('custom');
      if (key === 'customIconImageUri') return Promise.resolve('managed:missing.jpg');
      return Promise.resolve(fallback);
    });
    (resolveCustomIconReference as jest.Mock).mockResolvedValue(null);
    (setSettings as jest.Mock).mockRejectedValue(new Error('DB失敗'));

    renderRouter('src/app');
    await flushPromises();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('設定'));
    });

    expect(mockLatestSettingsScreenProps.selectedUserLocationIconId).toBe('default');
    expect(mockLatestMapScreenProps.userLocationIcon.useNativeUserLocation).toBe(true);
    expect(console.warn).toHaveBeenCalledWith('Failed to reset missing custom icon reference:', expect.any(Error));
  });

  test('旧URI参照のリセット永続化失敗時にAlertを表示しない', async () => {
    (getStringSetting as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'userLocationIcon') return Promise.resolve('custom');
      if (key === 'customIconImageUri') return Promise.resolve('file:///missing.jpg');
      return Promise.resolve(fallback);
    });
    (resolveCustomIconReference as jest.Mock).mockResolvedValue(null);
    (setSettings as jest.Mock).mockRejectedValue(new Error('DB失敗'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    renderRouter('src/app');
    await flushPromises();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('設定'));
    });

    expect(mockLatestSettingsScreenProps.selectedUserLocationIconId).toBe('default');
    expect(mockLatestMapScreenProps.userLocationIcon.useNativeUserLocation).toBe(true);
    expect(console.warn).toHaveBeenCalledWith('Failed to reset missing custom icon reference:', expect.any(Error));
    expect(alertSpy).not.toHaveBeenCalledWith('カスタムアイコンを読み込めませんでした', expect.any(String));
  });

  test('設定画面からOSSライセンス画面と詳細画面を通常遷移で開き、それぞれ戻れる', async () => {
    renderRouter('src/app');
    await flushPromises();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('設定'));
    });

    expect(mockLatestSettingsScreenProps).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('OSSライセンス'));
    });

    // UNSAFE_getByProps を使うのは画面遷移後に前画面が aria-hidden になるため。
    // 前画面のボタンが DOM に残っていることを確認するには aria-hidden を透過するクエリが必要。
    expect(screen.UNSAFE_getByProps({ accessibilityLabel: 'OSSライセンス' })).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('react のライセンス詳細を開く'));
    });

    // UNSAFE_getByProps を使うのは同上の理由による。
    expect(screen.UNSAFE_getByProps({ accessibilityLabel: 'react のライセンス詳細を開く' })).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('ライセンス一覧へ戻る'));
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText('設定画面へ戻る'));
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

    renderRouter('src/app');
    await flushPromises();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('日ごとの記録'));
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('日別詳細を開く'));
    });

    expect(screen.getByLabelText('日別詳細から一覧へ戻る')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('日別詳細から一覧へ戻る'));
    });

    expect(screen.getByLabelText('日別詳細を開く')).toBeTruthy();
  });

  test('GPXインポート押下直後に実績反映範囲の注意を表示し、OKを押してからファイル選択を開く', async () => {
    const originalRaf = global.requestAnimationFrame;
    global.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    }) as typeof global.requestAnimationFrame;
    const callOrder: string[] = [];
    /** 注意ダイアログのOKボタン。ユーザーが閉じる操作をテスト側から再現するために保持する。 */
    let confirmAlertButton: (() => void) | undefined;
    jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
      callOrder.push(`alert:${title}:${message ?? ''}`);
      confirmAlertButton = () => buttons?.[0]?.onPress?.();
    });
    (pickAndReadGpxFile as jest.Mock).mockImplementation(async () => {
      callOrder.push('pick');
      return null;
    });

    try {
      renderRouter('src/app');
      await flushPromises();

      await act(async () => {
        fireEvent.press(screen.getByLabelText('設定'));
      });

      let importPromise: Promise<void> = Promise.resolve();
      await act(async () => {
        importPromise = mockLatestSettingsScreenProps.onImportGpx();
        await Promise.resolve();
      });

      // ダイアログのOKを押すまではファイル選択を開かない
      expect(callOrder).toEqual([
        'alert:GPXインポートと実績について:GPXインポートでは、総移動距離や記録日数など一部の実績だけが判定対象になります。訪問した地域など、実際の記録中に確認する実績には反映されません。',
      ]);
      expect(pickAndReadGpxFile).not.toHaveBeenCalled();

      await act(async () => {
        confirmAlertButton?.();
        await importPromise;
      });

      expect(callOrder).toEqual([
        'alert:GPXインポートと実績について:GPXインポートでは、総移動距離や記録日数など一部の実績だけが判定対象になります。訪問した地域など、実際の記録中に確認する実績には反映されません。',
        'pick',
      ]);
      expect(pickAndReadGpxFile).toHaveBeenCalledTimes(1);
    } finally {
      global.requestAnimationFrame = originalRaf;
    }
  });

  test('GPX取り込み処理中だけブロッキングダイアログを表示し、完了後(finally)に閉じる', async () => {
    const originalRaf = global.requestAnimationFrame;
    // 本体は requestAnimationFrame で1フレーム譲るため、テストでは同期的に解決させる。
    global.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    }) as typeof global.requestAnimationFrame;
    // 注意ダイアログはOKを待つ実装のため、モックでは即座にOKを押したことにする。
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.[0]?.onPress?.();
    });
    (pickAndReadGpxFile as jest.Mock).mockResolvedValue({ content: '<gpx/>', fileName: 'a.gpx' });
    (parseGpxToLocationPoints as jest.Mock).mockReturnValue([{ latitude: 1, longitude: 2, timestamp: 0 }]);

    let resolveImport: (value: { importedPointCount: number; skippedPointCount: number }) => void = () => undefined;
    (importLocationPointsFromGpx as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveImport = resolve;
        }),
    );

    // 退場アニメーション中は中身が残るため、表示状態は Dialog の visible プロップで判定する。
    const isImportDialogVisible = () => screen.UNSAFE_getByType(GpxImportProgressDialog).props.visible;

    try {
      renderRouter('src/app');
      await flushPromises();

      await act(async () => {
        fireEvent.press(screen.getByLabelText('設定'));
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

  test('ファイル選択後は解析開始前に解析中の進捗段階を描画する', async () => {
    const originalRaf = global.requestAnimationFrame;
    const rafCallbacks: FrameRequestCallback[] = [];
    global.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    }) as typeof global.requestAnimationFrame;
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.[0]?.onPress?.();
    });
    (pickAndReadGpxFile as jest.Mock).mockResolvedValue({ content: '<gpx/>', fileName: 'a.gpx' });
    (parseGpxToLocationPoints as jest.Mock).mockReturnValue([]);

    try {
      renderRouter('src/app');
      await flushPromises();
      await act(async () => {
        fireEvent.press(screen.getByLabelText('設定'));
      });
      await flushPromises();
      let importPromise: Promise<void> = Promise.resolve();
      await act(async () => {
        importPromise = mockLatestSettingsScreenProps.onImportGpx();
        await Promise.resolve();
      });

      expect(rafCallbacks).toHaveLength(1);

      await act(async () => {
        rafCallbacks.shift()?.(0);
        await Promise.resolve();
      });
      expect(parseGpxToLocationPoints).not.toHaveBeenCalled();

      await act(async () => {
        rafCallbacks.shift()?.(0);
        await Promise.resolve();
      });

      // 大容量GPXの同期パースがJSスレッドを塞ぐ前に、解析中表示がコミットされている必要がある。
      expect(screen.UNSAFE_getByType(GpxImportProgressDialog).props.stage).toBe('parsing');
      expect(parseGpxToLocationPoints).not.toHaveBeenCalled();

      await act(async () => {
        rafCallbacks.shift()?.(0);
      });
      expect(parseGpxToLocationPoints).toHaveBeenCalledTimes(1);
      await importPromise;
    } finally {
      global.requestAnimationFrame = originalRaf;
    }
  });

  test('ファイルピッカー表示前にアプリをロックし、キャンセル時に解除する', async () => {
    const originalRaf = global.requestAnimationFrame;
    const rafCallbacks: FrameRequestCallback[] = [];
    global.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    }) as typeof global.requestAnimationFrame;
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.[0]?.onPress?.();
    });
    (pickAndReadGpxFile as jest.Mock).mockResolvedValue(null);

    try {
      renderRouter('src/app');
      await flushPromises();
      await act(async () => {
        fireEvent.press(screen.getByLabelText('設定'));
      });
      await flushPromises();

      let importPromise: Promise<void> = Promise.resolve();
      await act(async () => {
        importPromise = mockLatestSettingsScreenProps.onImportGpx();
        await Promise.resolve();
      });

      expect(screen.UNSAFE_getByType(GpxImportProgressDialog).props.visible).toBe(true);
      expect(pickAndReadGpxFile).not.toHaveBeenCalled();

      await act(async () => {
        rafCallbacks.shift()?.(0);
        await Promise.resolve();
      });
      expect(pickAndReadGpxFile).not.toHaveBeenCalled();

      await act(async () => {
        rafCallbacks.shift()?.(0);
        await importPromise;
      });

      expect(pickAndReadGpxFile).toHaveBeenCalledTimes(1);
      expect(screen.UNSAFE_getByType(GpxImportProgressDialog).props.visible).toBe(false);
    } finally {
      global.requestAnimationFrame = originalRaf;
    }
  });

  test('ファイル選択の失敗時にアプリの操作ロックを解除する', async () => {
    const originalRaf = global.requestAnimationFrame;
    const rafCallbacks: FrameRequestCallback[] = [];
    global.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    }) as typeof global.requestAnimationFrame;
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.[0]?.onPress?.();
    });
    (pickAndReadGpxFile as jest.Mock).mockRejectedValue(new Error('GPXファイルを読み込めませんでした。'));

    try {
      renderRouter('src/app');
      await flushPromises();
      await act(async () => {
        fireEvent.press(screen.getByLabelText('設定'));
      });
      await flushPromises();

      let importPromise: Promise<void> = Promise.resolve();
      await act(async () => {
        importPromise = mockLatestSettingsScreenProps.onImportGpx();
        await Promise.resolve();
      });
      expect(screen.UNSAFE_getByType(GpxImportProgressDialog).props.visible).toBe(true);

      await act(async () => {
        rafCallbacks.shift()?.(0);
        await Promise.resolve();
      });
      await act(async () => {
        rafCallbacks.shift()?.(0);
        await importPromise;
      });

      expect(screen.UNSAFE_getByType(GpxImportProgressDialog).props.visible).toBe(false);
    } finally {
      global.requestAnimationFrame = originalRaf;
    }
  });

  test('全データ削除の完了をAlertで通知する', async () => {
    const alertCalls: { title: string; message?: string }[] = [];
    jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
      alertCalls.push({ title, message: message ?? undefined });
      // 確認ダイアログでは「削除する」を押したことにする
      if (title === 'すべてのデータを削除') {
        buttons?.find((button) => button.text === '削除する')?.onPress?.();
      }
    });

    renderRouter('src/app');
    await flushPromises();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('設定'));
    });

    await act(async () => {
      mockLatestSettingsScreenProps.onDeleteAllData();
    });
    await flushPromises();

    expect(alertCalls).toContainEqual({
      title: '削除完了',
      message: '保存済みのGPSログ・訪問エリア・実績データを削除しました。',
    });
  });

  test('設定画面から月払いPackageを直接購入してPlus状態を反映する', async () => {
    (purchasePremiumPackage as jest.Mock).mockResolvedValueOnce({
      status: 'purchased',
      accessState: { isPlusActive: true, entitlementId: 'strollia_plus' },
    });

    renderRouter('src/app');
    await flushPromises();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('設定'));
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

    renderRouter('src/app');
    await flushPromises();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('設定'));
    });

    await act(async () => {
      mockLatestSettingsScreenProps.onPurchaseYearlyPremiumPackage();
    });
    await flushPromises();

    expect(purchasePremiumPackage).toHaveBeenCalledWith('yearly');
    expect(mockLatestSettingsScreenProps.premiumAccessState.isPlusActive).toBe(true);
  });

  test('Plus未加入時に有料現在地アイコンを選ぶと設定画面で加入する案内を表示する', async () => {
    (getPremiumAccessState as jest.Mock).mockResolvedValueOnce({ isPlusActive: false, entitlementId: 'strollia_plus' });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    renderRouter('src/app');
    await flushPromises();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('設定'));
    });

    await act(async () => {
      mockLatestSettingsScreenProps.onUpdateUserLocationIcon('walker');
    });
    await flushPromises();

    expect(purchasePremiumPackage).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Strollia Plus限定',
      'さんぽはStrollia Plusで開放できます。設定画面の月払いまたは年払いから加入してください。',
    );
  });

  test('設定画面からRevenueCat Customer Centerを表示する', async () => {
    renderRouter('src/app');
    await flushPromises();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('設定'));
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

    renderRouter('src/app');
    await flushPromises();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('設定'));
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

    renderRouter('src/app');
    await flushPromises();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('設定'));
    });

    await act(async () => {
      mockLatestSettingsScreenProps.onPresentPremiumCustomerCenter();
    });
    await flushPromises();

    expect(presentPremiumCustomerCenter).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith(
      'Strollia Plus',
      'サブスク管理画面を表示できませんでした。RevenueCatとストア設定を確認してください。',
    );
  });

  test('ペイウォールで購入が成功するとダイアログが閉じる', async () => {
    (getPremiumAccessState as jest.Mock).mockResolvedValue({ isPlusActive: false, entitlementId: 'strollia_plus' });
    (purchasePremiumPackage as jest.Mock).mockResolvedValueOnce({
      status: 'purchased',
      accessState: { isPlusActive: true, entitlementId: 'strollia_plus' },
    });

    renderRouter('src/app');
    await flushPromises();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('月次レポート'));
    });
    await flushPromises();

    // ペイウォールが開いていることを確認
    expect(screen.getByLabelText('月払いで購入')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('月払いで購入'));
    });
    await flushPromises();

    // 購入成功後にペイウォールが閉じる
    expect(screen.queryAllByLabelText('月払いで購入')).toHaveLength(0);
  });

  test('ペイウォールで復元が成功するとダイアログが閉じる', async () => {
    (getPremiumAccessState as jest.Mock).mockResolvedValue({ isPlusActive: false, entitlementId: 'strollia_plus' });
    (restorePremiumPurchases as jest.Mock).mockResolvedValueOnce({ isPlusActive: true, entitlementId: 'strollia_plus' });

    renderRouter('src/app');
    await flushPromises();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('月次レポート'));
    });
    await flushPromises();

    expect(screen.getByLabelText('購入を復元')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('購入を復元'));
    });
    await flushPromises();

    // 復元成功後にペイウォールが閉じる
    expect(screen.queryAllByLabelText('購入を復元')).toHaveLength(0);
  });

  test('月次レポートボタンは無料ユーザーにペイウォールを表示する', async () => {
    (getPremiumAccessState as jest.Mock).mockResolvedValue({ isPlusActive: false, entitlementId: 'strollia_plus' });

    renderRouter('src/app');
    await flushPromises();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('月次レポート'));
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
      .mockResolvedValueOnce({ isPlusActive: true, entitlementId: 'strollia_plus' }); // ボタン押下時

    renderRouter('src/app');
    await flushPromises();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('月次レポート'));
    });
    await flushPromises();

    expect(mockLatestMonthlyReportScreenProps).not.toBeNull();
  });

  test('月次レポートボタンはPlus会員かつ先月データありで月次レポート画面へ遷移させる', async () => {
    (getDailyLogs as jest.Mock).mockResolvedValueOnce([previousMonthDailyLog()]);
    (getPremiumAccessState as jest.Mock).mockResolvedValueOnce({ isPlusActive: true, entitlementId: 'strollia_plus' });

    renderRouter('src/app');
    await flushPromises();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('月次レポート'));
    });
    await flushPromises();

    expect(mockLatestMonthlyReportScreenProps).not.toBeNull();
  });

  test('月次レポートへディープリンクで直接到達した場合も対象月のポイントを読み込む', async () => {
    const previousMonthPoints: LocationPoint[] = [
      {
        id: 1,
        recordedAt: '2026-06-15T00:00:00.000Z',
        localDate: '2026-06-15',
        latitude: 35.681236,
        longitude: 139.767125,
        altitude: null,
        speed: null,
        heading: null,
        accuracy: null,
        altitudeAccuracy: null,
      },
    ];
    // mockResolvedValueOnce: mockResolvedValue のまま次テストへ持ち越すと、
    // 後続テストの getLocationPointsByMonth デフォルト応答([])が上書きされたままになる。
    (getLocationPointsByMonth as jest.Mock).mockResolvedValueOnce(previousMonthPoints);
    // premiumAccessState の初期値(usePremiumAccessのuseState初期化)がPlus未加入のままだと、
    // ルート自身のPlusゲートが初回コミットの効果で即座に "/" へリダイレクトしてしまい、
    // 後から確定するPlus加入状態が間に合わない。ディープリンク到達時点でPlus加入済みの
    // 状態を再現するため、初期値そのものをPlus加入済みに差し替える。
    (getDefaultPremiumAccessState as jest.Mock).mockReturnValueOnce({ isPlusActive: true, entitlementId: 'strollia_plus' });

    renderRouter('src/app', { initialUrl: '/monthly-report' });
    await flushPromises();

    const expectedMonth = formatReportMonth(getPreviousReportMonth());
    expect(getLocationPointsByMonth).toHaveBeenCalledWith(expectedMonth);
    expect(mockLatestMonthlyReportScreenProps.points).toEqual(previousMonthPoints);
  });

  test('通常のボタン遷移では月次レポートのポイント取得は1回だけで、ディープリンク用effectによる再取得は起きない', async () => {
    (getDailyLogs as jest.Mock).mockResolvedValueOnce([previousMonthDailyLog()]);
    (getPremiumAccessState as jest.Mock).mockResolvedValueOnce({ isPlusActive: true, entitlementId: 'strollia_plus' });

    renderRouter('src/app');
    await flushPromises();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('月次レポート'));
    });
    await flushPromises();

    expect(mockLatestMonthlyReportScreenProps).not.toBeNull();
    expect((getLocationPointsByMonth as jest.Mock).mock.calls.length).toBe(1);
  });

  test('Plus会員でも先月データがない場合は集計中アラートを出し遷移しない', async () => {
    (getDailyLogs as jest.Mock).mockResolvedValue([]);
    (getPremiumAccessState as jest.Mock).mockResolvedValue({ isPlusActive: true, entitlementId: 'strollia_plus' });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    renderRouter('src/app');
    await flushPromises();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('月次レポート'));
    });
    await flushPromises();

    expect(alertSpy).toHaveBeenCalledWith('現在集計中です！', '来月になったらもう一度来てください！');
    expect(mockLatestMonthlyReportScreenProps).toBeNull();
  });

  test('初期状態は現在地に追従し、地図中心が現在地付近になっただけでは追従を再開しない', async () => {
    const userRegion = createUserCenteredRegion({ latitude: 35.681236, longitude: 139.767125 });

    renderRouter('src/app');
    await flushPromises();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('現在地更新'));
    });

    expect(mockAnimateToRegion).toHaveBeenCalledWith(userRegion, 250);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('地図をドラッグ'));
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('現在地中心へ地図移動'));
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('現在地更新'));
    });

    expect(mockAnimateToRegion).toHaveBeenCalledTimes(1);
  });

  test('不正な現在地座標ではMapKitへRegionを渡さない', async () => {
    renderRouter('src/app');
    await flushPromises();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('不正な現在地更新'));
    });

    expect(mockAnimateToRegion).not.toHaveBeenCalled();
  });
});
