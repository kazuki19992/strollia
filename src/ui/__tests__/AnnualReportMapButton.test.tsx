import { act, cleanup, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Alert, AppState } from 'react-native';

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
    // パック詳細の埋め込み地図は到達エリアの円を常に描くため Circle も代替する
    Circle: View,
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

jest.mock('@/features/landmarks/landmarkVisitRepository', () => ({
  getLandmarkSpotVisits: jest.fn().mockResolvedValue([]),
  getLandmarkAreaVisits: jest.fn().mockResolvedValue([]),
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

jest.mock('@/features/customization/customizationResolver', () => ({
  resolveUserLocationIcon: jest.fn(() => ({ useNativeUserLocation: true, customIconId: null })),
}));

jest.mock('@/features/customization/customizationOptions', () => ({
  DEFAULT_USER_LOCATION_ICON_ID: 'default',
  getUserLocationIconOption: jest.fn((id: string) => ({ id, label: 'OS標準', premium: false })),
}));

jest.mock('@/features/customization/customIconStorage', () => ({
  deleteManagedCustomIcon: jest.fn().mockResolvedValue(undefined),
  isLegacyCustomIconReference: jest.fn(() => false),
  resolveCustomIconReference: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/features/customization/customIconSelection', () => ({
  replaceCustomIconSelection: jest.fn(),
}));

jest.mock('@/features/premium/revenueCatAccess', () => ({
  getConfirmedPremiumAccessState: jest.fn(),
  getDefaultPremiumAccessState: jest.fn(() => ({ isPlusActive: true, entitlementId: 'strollia_plus' })),
  getPremiumAccessState: jest.fn().mockResolvedValue({ isPlusActive: true, entitlementId: 'strollia_plus' }),
  getPremiumOfferingSummary: jest.fn().mockResolvedValue(null),
  getRevenueCatAppUserId: jest.fn().mockResolvedValue(null),
  presentPremiumCustomerCenter: jest.fn().mockResolvedValue(true),
  purchasePremiumPackage: jest
    .fn()
    .mockResolvedValue({ status: 'purchased', accessState: { isPlusActive: true, entitlementId: 'strollia_plus' } }),
  restorePremiumPurchases: jest.fn().mockResolvedValue({ isPlusActive: true, entitlementId: 'strollia_plus' }),
  subscribePremiumAccessStateUpdates: jest.fn(() => jest.fn()),
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

jest.mock('@/ui/hooks/useAchievementDialogEffects', () => ({
  useAchievementDialogEffects: jest.fn(),
}));

jest.mock('@/ui/hooks/useKeepScreenAwake', () => ({
  useKeepScreenAwake: jest.fn(),
}));

jest.mock('@/ui/hooks/usePhotoMapOverlay', () => ({
  usePhotoMapOverlay: () => ({ photos: [], isLoadingPhotos: false, photoErrorMessage: null }),
}));

// 地図を実際に表示して検証するため、フェード中(透明扱い)にならないよう不透明の値を返す
jest.mock('@/ui/hooks/useScreenTransitionOpacity', () => {
  const { Animated } = require('react-native');
  return { useScreenTransitionOpacity: () => new Animated.Value(1) };
});

jest.mock('@/ui/hooks/useCurrentAreaName', () => ({
  useCurrentAreaLabel: () => ({ primary: '船橋市', secondary: '行田' }),
}));

jest.mock('@/ui/hooks/useForegroundUserLocation', () => ({
  useForegroundUserLocation: jest.fn(),
}));

jest.mock('@/ui/generated/ossLicenses', () => ({
  OSS_LICENSES: [],
}));

// 地図の滞在場所ダイアログは検証対象外。非表示でも兄弟のModalが読み上げ対象を隠すためモックする
jest.mock('@/ui/components/Dialog', () => ({ Dialog: () => null }));
jest.mock('@/ui/components/TopToast', () => ({ TopToast: () => null }));
jest.mock('@/ui/components/AchievementDialog', () => ({ AchievementDialog: () => null }));
jest.mock('@/ui/components/AchievementUnlockModal', () => ({ AchievementUnlockModal: () => null }));
jest.mock('@/ui/components/PhotoPreviewModals', () => ({ PhotoPreviewModals: () => null }));
jest.mock('@/ui/components/FirstLaunchTutorialDialog', () => ({ FirstLaunchTutorialDialog: () => null }));
jest.mock('@/ui/components/PremiumPaywallModal', () => ({ PremiumPaywallModal: () => null }));
jest.mock('@/ui/components/reports/MonthlyReportScreen', () => ({ MonthlyReportScreen: () => null }));
// 日別記録詳細は地図・共有など依存が重いため、戻るボタン(ラベルと戻る操作)だけを描くモックにする
jest.mock('@/ui/components/DailyLogDetailScreen', () => {
  const { Pressable, Text } = require('react-native');
  return {
    DailyLogDetailScreen: ({ backLabel = '日ごとの記録', onBackToDailyLogs }: { backLabel?: string; onBackToDailyLogs: () => void }) => (
      <Pressable accessibilityLabel={`${backLabel}へ戻る`} accessibilityRole="button" onPress={onBackToDailyLogs}>
        <Text>{backLabel}</Text>
      </Pressable>
    ),
  };
});
jest.mock('@/ui/components/LicenseScreen', () => ({ LicenseScreen: () => null, LicenseDetailScreen: () => null }));
jest.mock('@/ui/components/DailyLogsScreen', () => ({ DailyLogsScreen: () => null }));
// 設定画面は「すべてのデータの削除」の結線だけを確かめるため、その操作のボタンだけを描くモックにする
jest.mock('@/ui/components/SettingsScreen', () => {
  const { Pressable, Text } = require('react-native');
  return {
    SettingsScreen: ({ onDeleteAllData }: { onDeleteAllData: () => void }) => (
      <Pressable accessibilityLabel="すべてのデータの削除" accessibilityRole="button" onPress={onDeleteAllData}>
        <Text>すべてのデータの削除</Text>
      </Pressable>
    ),
  };
});

/** useAnnualReportState が返す内容。各テストで書き換える。 */
const mockAnnualReportState = {
  availableReport: null as { year: number } | null,
  daysLeft: null as number | null,
  hasEvaluated: true,
  onReportOpened: jest.fn(),
  onReportClosed: jest.fn(),
  deferNotificationOpen: jest.fn(),
  resetAfterDataDeletion: jest.fn(),
};

jest.mock('@/ui/hooks/useAnnualReportState', () => ({
  useAnnualReportState: () => mockAnnualReportState,
}));

jest.mock('@/ui/hooks/useAnnualReportNotificationResponse', () => ({
  useAnnualReportNotificationResponse: jest.fn(),
}));

// ストーリー本体は重いため、開けたことだけ分かるマーカーにする
jest.mock('@/ui/components/annualReport/AnnualReportScreen', () => {
  const { Text } = require('react-native');
  return { AnnualReportScreen: () => <Text>年間レポート画面</Text> };
});

/** マイクロタスクを繰り返し流し切って非同期 state の反映を待つ。 */
const flushPromises = async () => {
  await act(async () => {
    for (let index = 0; index < 5; index += 1) {
      await Promise.resolve();
    }
  });
};

describe('地図画面の年間レポートふりかえりボタン', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAnnualReportState.availableReport = null;
    mockAnnualReportState.daysLeft = null;
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active', writable: true });
    const { getBooleanSetting } = require('@/features/settings/settingsRepository');
    (getBooleanSetting as jest.Mock).mockImplementation((key: string, fallback: boolean) =>
      Promise.resolve(key === 'firstLaunchTutorialCompleted' ? true : fallback),
    );
    const { getConfirmedPremiumAccessState, getPremiumAccessState } = require('@/features/premium/revenueCatAccess');
    (getPremiumAccessState as jest.Mock).mockResolvedValue({ isPlusActive: true, entitlementId: 'strollia_plus' });
    (getConfirmedPremiumAccessState as jest.Mock).mockImplementation(() => getPremiumAccessState());
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  test('年間レポートがないときはボタンを表示しない', async () => {
    await renderRouter('src/app');
    await flushPromises();

    expect(screen.getByLabelText('現在地へ戻る')).toBeTruthy();
    expect(screen.queryByText('ふりかえり')).toBeNull();
  });

  test('年間レポートがあるときだけボタンを表示する', async () => {
    mockAnnualReportState.availableReport = { year: 2026 };
    mockAnnualReportState.daysLeft = 20;

    await renderRouter('src/app');
    await flushPromises();

    expect(screen.getByText('ふりかえり')).toBeTruthy();
  });

  test('バッジに残り日数を表示する', async () => {
    mockAnnualReportState.availableReport = { year: 2026 };
    mockAnnualReportState.daysLeft = 20;

    await renderRouter('src/app');
    await flushPromises();

    expect(screen.getByText('あと20日')).toBeTruthy();
    expect(screen.getByLabelText('年間レポートをふりかえる（あと20日）')).toBeTruthy();
  });

  test('押すと /annual-report へ遷移する', async () => {
    mockAnnualReportState.availableReport = { year: 2026 };
    mockAnnualReportState.daysLeft = 20;

    const router = await renderRouter('src/app');
    await flushPromises();

    await act(async () => {
      await fireEvent.press(screen.getByLabelText('年間レポートをふりかえる（あと20日）'));
    });
    await flushPromises();

    expect(router.getPathname()).toBe('/annual-report');
    expect(screen.getByText('年間レポート画面')).toBeTruthy();
    expect(mockAnnualReportState.onReportOpened).toHaveBeenCalledTimes(1);
  });
  test('設定の「すべてのデータの削除」が成功したら年間レポートの状態をリセットする', async () => {
    mockAnnualReportState.availableReport = { year: 2026 };
    mockAnnualReportState.daysLeft = 20;
    const alertSpy = jest.spyOn(Alert, 'alert');

    await renderRouter('src/app', { initialUrl: '/settings' });
    await flushPromises();

    await fireEvent.press(screen.getByLabelText('すべてのデータの削除'));
    // 確認ダイアログの「削除する」を押したことにする
    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => {
      buttons.find((button) => button.text === '削除する')?.onPress?.();
    });
    await flushPromises();

    const { deleteAllUserData } = require('@/features/logs/logRepository');
    expect(deleteAllUserData).toHaveBeenCalledTimes(1);
    expect(mockAnnualReportState.resetAfterDataDeletion).toHaveBeenCalledTimes(1);
  });
});
