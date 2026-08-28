import { act, cleanup, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AppState } from 'react-native';

import { setSetting } from '@/features/settings/settingsRepository';

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

jest.mock('@/config/sentry', () => ({
  wrapWithSentry: (component: unknown) => component,
  updateSentryScreenContext: jest.fn(),
  updateSentrySubscriptionContext: jest.fn(),
  updateSentryUserContext: jest.fn(),
  setCrashReportingEnabled: jest.fn(),
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

jest.mock('@/features/settings/settingsRepository', () => ({
  getBooleanSetting: jest.fn().mockResolvedValue(true),
  getStringSetting: jest.fn().mockResolvedValue(''),
  setSetting: jest.fn().mockResolvedValue(undefined),
  setSettings: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/stayPlaces/stayPlaceRepository', () => ({
  getStayPlaces: jest.fn().mockResolvedValue([]),
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
  hasRequiredLocationPermission: jest.fn(
    (state: { foregroundGranted: boolean; backgroundGranted: boolean }) => state.foregroundGranted && state.backgroundGranted,
  ),
  isWhileInUseOnlyMode: jest.fn(
    (state: { foregroundGranted: boolean; backgroundGranted: boolean }) => state.foregroundGranted && !state.backgroundGranted,
  ),
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

jest.mock('@/features/customization/customIconStorage', () => ({
  deleteManagedCustomIcon: jest.fn().mockResolvedValue(undefined),
  isLegacyCustomIconReference: jest.fn((reference: string) => /^[A-Za-z][A-Za-z\d+.-]*:\/\//.test(reference)),
  resolveCustomIconReference: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/features/customization/customIconSelection', () => ({
  replaceCustomIconSelection: jest.fn(),
}));

jest.mock('@/features/premium/revenueCatAccess', () => ({
  getConfirmedPremiumAccessState: jest.fn(),
  getDefaultPremiumAccessState: jest.fn(() => ({ isPlusActive: false, entitlementId: 'strollia_plus' })),
  getPremiumAccessState: jest.fn().mockResolvedValue({ isPlusActive: false, entitlementId: 'strollia_plus' }),
  getPremiumOfferingSummary: jest.fn().mockResolvedValue(null),
  getRevenueCatAppUserId: jest.fn().mockResolvedValue(null),
  presentPremiumCustomerCenter: jest.fn().mockResolvedValue(true),
  purchasePremiumPackage: jest
    .fn()
    .mockResolvedValue({ status: 'purchased', accessState: { isPlusActive: false, entitlementId: 'strollia_plus' } }),
  restorePremiumPurchases: jest.fn().mockResolvedValue({ isPlusActive: false, entitlementId: 'strollia_plus' }),
  subscribePremiumAccessStateUpdates: jest.fn(() => jest.fn()),
}));

jest.mock('@/features/photos/photoClusters', () => ({
  clusterMapPhotosByRadius: jest.fn(() => []),
  getPhotoClusterRadiusMeters: jest.fn(() => 10),
  getStablePhotoClusterRadiusMeters: jest.fn(() => 10),
  paginateMapPhotos: jest.fn(() => []),
}));

jest.mock('@/features/photos/photoLibrary', () => ({
  hasFullPhotoAccess: jest.fn(() => true),
}));

jest.mock('@/features/location/visitedCellRepository', () => ({
  getVisitedCellsInBounds: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/features/location/grid/gridCell', () => ({
  getGridBoundsForRegion: jest.fn((region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }) => ({
    minX: Math.round(region.latitude * 1000),
    maxX: Math.round(region.longitude * 1000),
    minY: Math.round(region.latitudeDelta * 1000),
    maxY: Math.round(region.longitudeDelta * 1000),
  })),
  isGridBoundsContained: jest.fn(() => false),
}));

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
  useForegroundUserLocation: jest.fn(),
}));

jest.mock('@/ui/generated/ossLicenses', () => ({
  OSS_LICENSES: [],
}));

jest.mock('@/ui/components/TopToast', () => ({ TopToast: () => null }));
jest.mock('@/ui/components/AchievementDialog', () => ({ AchievementDialog: () => null }));
jest.mock('@/ui/components/AchievementUnlockModal', () => ({ AchievementUnlockModal: () => null }));
jest.mock('@/ui/components/AchievementListScreen', () => ({ AchievementListScreen: () => null }));
jest.mock('@/ui/components/PhotoPreviewModals', () => ({ PhotoPreviewModals: () => null }));
jest.mock('@/ui/components/FirstLaunchTutorialDialog', () => ({ FirstLaunchTutorialDialog: () => null }));
jest.mock('@/ui/components/PremiumPaywallModal', () => ({ PremiumPaywallModal: () => null }));
jest.mock('@/ui/components/reports/MonthlyReportScreen', () => ({ MonthlyReportScreen: () => null }));
jest.mock('@/ui/components/DailyLogDetailScreen', () => ({ DailyLogDetailScreen: () => null }));
jest.mock('@/ui/components/LicenseScreen', () => ({ LicenseScreen: () => null, LicenseDetailScreen: () => null }));
jest.mock('@/ui/components/DailyLogsScreen', () => ({ DailyLogsScreen: () => null }));

jest.mock('@/ui/components/MapScreen', () => ({
  MapScreen: (props: { onOpenSettings: () => void }) => {
    const { Pressable, Text } = require('react-native');

    return (
      <Pressable accessibilityLabel="設定" onPress={props.onOpenSettings}>
        <Text>設定</Text>
      </Pressable>
    );
  },
}));

/** マイクロタスクを繰り返し流し切って非同期 state の反映を待つ。 */
const flushPromises = async () => {
  await act(async () => {
    for (let index = 0; index < 5; index += 1) {
      await Promise.resolve();
    }
  });
};

describe('不具合レポート設定の状態', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active', writable: true });
    const { getBooleanSetting } = require('@/features/settings/settingsRepository');
    (getBooleanSetting as jest.Mock).mockImplementation((key: string, fallback: boolean) => {
      if (key === 'firstLaunchTutorialCompleted') {
        return Promise.resolve(true);
      }

      return Promise.resolve(fallback);
    });
    const { getConfirmedPremiumAccessState, getPremiumAccessState } = require('@/features/premium/revenueCatAccess');
    (getPremiumAccessState as jest.Mock).mockResolvedValue({ isPlusActive: false, entitlementId: 'strollia_plus' });
    (getConfirmedPremiumAccessState as jest.Mock).mockImplementation(() => getPremiumAccessState());
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it('設定画面のトグルを切り替えるとcrashReportingEnabledキーで保存する', async () => {
    renderRouter('src/app');
    await flushPromises();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('設定'));
    });
    await flushPromises();

    await act(async () => {
      fireEvent(screen.getByLabelText('不具合レポートを送る'), 'valueChange', false);
    });
    await flushPromises();

    expect(setSetting).toHaveBeenCalledWith('crashReportingEnabled', false);
  });

  it('保存に失敗すると設定画面でAlertを表示する(Provider が例外を握りつぶさない)', async () => {
    const { Alert } = require('react-native');
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    (setSetting as jest.Mock).mockImplementation((key: string) => {
      if (key === 'crashReportingEnabled') {
        return Promise.reject(new Error('保存に失敗しました'));
      }
      return Promise.resolve(undefined);
    });

    renderRouter('src/app');
    await flushPromises();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('設定'));
    });
    await flushPromises();

    await act(async () => {
      fireEvent(screen.getByLabelText('不具合レポートを送る'), 'valueChange', false);
    });
    await flushPromises();

    expect(alertSpy).toHaveBeenCalledWith('設定保存失敗', '保存に失敗しました');
  });
});
