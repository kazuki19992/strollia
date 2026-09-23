import { act, cleanup, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AppState } from 'react-native';

import { createUserCenteredRegion } from '@/ui/mapRegion';

/** MapScreen モックが mapRef へ差し込む animateToRegion。地図中心の移動先を検証するために使う。 */
const mockAnimateToRegion = jest.fn();

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

jest.mock('@/features/landmarks/landmarkVisitRepository', () => ({
  getLandmarkSpotVisits: jest.fn().mockResolvedValue([]),
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
jest.mock('@/ui/components/PhotoPreviewModals', () => ({ PhotoPreviewModals: () => null }));
jest.mock('@/ui/components/FirstLaunchTutorialDialog', () => ({ FirstLaunchTutorialDialog: () => null }));
jest.mock('@/ui/components/PremiumPaywallModal', () => ({ PremiumPaywallModal: () => null }));
jest.mock('@/ui/components/reports/MonthlyReportScreen', () => ({ MonthlyReportScreen: () => null }));
jest.mock('@/ui/components/DailyLogDetailScreen', () => ({ DailyLogDetailScreen: () => null }));
jest.mock('@/ui/components/LicenseScreen', () => ({ LicenseScreen: () => null, LicenseDetailScreen: () => null }));
jest.mock('@/ui/components/DailyLogsScreen', () => ({ DailyLogsScreen: () => null }));

// 実績一覧とパック詳細は実物を描画するため、この2画面はモックしない。
jest.mock('@/ui/components/MapScreen', () => ({
  MapScreen: (props: { mapRef: { current: unknown }; onOpenAchievements: () => void }) => {
    const { Pressable, Text } = require('react-native');

    // 実 MapView は描画しないため、地図移動の検証用に animateToRegion だけを ref へ差し込む
    props.mapRef.current = { animateToRegion: mockAnimateToRegion };

    return (
      <Pressable accessibilityLabel="実績" onPress={props.onOpenAchievements}>
        <Text>実績</Text>
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

/** 実績一覧を開く。スポットセクションの進捗表示を検証する起点にする。 */
const openAchievementList = async () => {
  const router = renderRouter('src/app');
  await flushPromises();

  await act(async () => {
    fireEvent.press(screen.getByLabelText('実績'));
  });
  await flushPromises();

  return router;
};

/**
 * 実績一覧からパック詳細へ遷移する。
 *
 * 現在パスの検証には renderRouter の戻り値が持つ getPathname() を使うため、
 * レンダリング結果を呼び出し元へ返す。
 */
const openLandmarkPackDetail = async () => {
  const router = renderRouter('src/app');
  await flushPromises();

  await act(async () => {
    fireEvent.press(screen.getByLabelText('実績'));
  });
  await flushPromises();

  await act(async () => {
    fireEvent.press(screen.getByLabelText('日本三名瀑の詳細を開く'));
  });
  await flushPromises();

  return router;
};

describe('実績一覧からスポットパック詳細への遷移', () => {
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
    (getPremiumAccessState as jest.Mock).mockResolvedValue({ isPlusActive: true, entitlementId: 'strollia_plus' });
    (getConfirmedPremiumAccessState as jest.Mock).mockImplementation(() => getPremiumAccessState());
    const { getLandmarkSpotVisits } = require('@/features/landmarks/landmarkVisitRepository');
    (getLandmarkSpotVisits as jest.Mock).mockResolvedValue([
      {
        spotId: '01a0c450-6c00-7000-8000-000000000101',
        visitedAt: '2026-04-12T02:00:00.000Z',
        visitedLocalDate: '2026-04-12',
        locationPointId: 1,
      },
    ]);
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it('パック行を押すとパック詳細画面が開き到達状況を表示する', async () => {
    const router = await openLandmarkPackDetail();

    expect(router.getPathname()).toBe('/achievements/01a0c450-6c00-7000-8000-000000000001');
    // 到達済み・未到達の両方の行が、状態に応じたラベルで並ぶ
    expect(screen.getByLabelText('華厳の滝の記録を開く')).toBeTruthy();
    expect(screen.getByLabelText('那智の滝を地図で見る')).toBeTruthy();
    expect(screen.getByText('1/3')).toBeTruthy();
    expect(screen.getByText('2026/04/12')).toBeTruthy();
  });

  it('パック詳細の戻るボタンで実績一覧へ戻る', async () => {
    const router = await openLandmarkPackDetail();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('実績へ戻る'));
    });
    await flushPromises();

    expect(router.getPathname()).toBe('/achievements');
  });

  it('未到達スポットの行を押すと地図画面まで戻り、そのスポットを中心に表示する', async () => {
    const router = await openLandmarkPackDetail();
    mockAnimateToRegion.mockClear();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('那智の滝を地図で見る'));
    });
    await flushPromises();

    expect(router.getPathname()).toBe('/');
    // 那智の滝の座標(data/landmarks/landmarkSpots.json)が地図中心になる
    expect(mockAnimateToRegion).toHaveBeenCalledWith(createUserCenteredRegion({ latitude: 33.675278, longitude: 135.8875 }), 250);
  });

  it('実績の再評価に合わせてスポット到達を読み直し、一覧の進捗を更新する', async () => {
    // AppState復帰の同期チェーンを手動で起動するため、登録されたリスナーを全て集めておく
    const appStateHandlers: ((state: string) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_event: string, handler: (state: string) => void) => {
      appStateHandlers.push(handler);

      return { remove: jest.fn() };
    }) as never);

    await openAchievementList();

    expect(screen.getByText('1/3')).toBeTruthy();

    // 記録中に那智の滝へ到達した状況を作る
    const { getLandmarkSpotVisits } = require('@/features/landmarks/landmarkVisitRepository');
    (getLandmarkSpotVisits as jest.Mock).mockResolvedValue([
      {
        spotId: '01a0c450-6c00-7000-8000-000000000101',
        visitedAt: '2026-04-12T02:00:00.000Z',
        visitedLocalDate: '2026-04-12',
        locationPointId: 1,
      },
      {
        spotId: '01a0c450-6c00-7000-8000-000000000102',
        visitedAt: '2026-04-13T02:00:00.000Z',
        visitedLocalDate: '2026-04-13',
        locationPointId: 2,
      },
    ]);

    await act(async () => {
      for (const handler of appStateHandlers) {
        handler('active');
      }
    });
    await flushPromises();
    await flushPromises();

    // 実績画面を開き直さずに分数が追従する
    expect(screen.getByText('2/3')).toBeTruthy();
  });
});
