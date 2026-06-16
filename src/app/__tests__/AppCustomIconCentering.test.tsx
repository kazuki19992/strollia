import App from '../App';
import { createUserCenteredRegion } from '../mapRegion';

const mockAnimateToRegion = jest.fn();
let mockLatestMapScreenProps: any = null;

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'Light' },
  impactAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ accessPrivileges: 'all' }),
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getLastKnownPositionAsync: jest.fn().mockResolvedValue(null),
  watchPositionAsync: jest.fn().mockResolvedValue({ remove: jest.fn() }),
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

// MapScreenモックは現在地更新（前景ウォッチ相当）と地図準備完了(onMapReady)を別々のボタンで発火させ、
// センタリングが地図準備完了後にだけ起きることを検証できるようにする。
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
        <Pressable accessibilityLabel="地図準備完了" onPress={() => props.onMapReady?.()}>
          <Text>地図準備完了</Text>
        </Pressable>
      </>
    );
  },
}));

jest.mock('../components/DailyLogsScreen', () => ({ DailyLogsScreen: () => null }));
jest.mock('../components/PremiumPaywallModal', () => ({ PremiumPaywallModal: () => null }));
jest.mock('../components/DailyLogDetailScreen', () => ({ DailyLogDetailScreen: () => null }));
jest.mock('../components/AchievementListScreen', () => ({ AchievementListScreen: () => null }));
jest.mock('../components/AchievementUnlockModal', () => ({ AchievementUnlockModal: () => null }));
jest.mock('../components/FirstLaunchTutorialDialog', () => ({ FirstLaunchTutorialDialog: () => null }));
jest.mock('../components/PhotoPreviewModals', () => ({ PhotoPreviewModals: () => null }));
jest.mock('../components/reports/MonthlyReportScreen', () => ({ MonthlyReportScreen: () => null }));
jest.mock('../components/SettingsScreen', () => ({ SettingsScreen: () => null }));
jest.mock('../components/LicenseScreen', () => ({ LicenseScreen: () => null, LicenseDetailScreen: () => null }));

jest.mock('../hooks/useAchievementDialogEffects', () => ({ useAchievementDialogEffects: jest.fn() }));
jest.mock('../hooks/useKeepScreenAwake', () => ({ useKeepScreenAwake: jest.fn() }));
jest.mock('../hooks/usePhotoMapOverlay', () => ({
  usePhotoMapOverlay: () => ({ photos: [], isLoadingPhotos: false, photoErrorMessage: null }),
}));
jest.mock('../hooks/useScreenTransitionOpacity', () => ({
  useScreenTransitionOpacity: () => ({ interpolate: () => 0 }),
}));
jest.mock('../hooks/useCurrentAreaName', () => ({
  useCurrentAreaLabel: () => ({ primary: '船橋市', secondary: '行田' }),
}));

jest.mock('../../db/database', () => ({ initializeDatabase: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../theme/fonts', () => ({
  loadAppFonts: jest.fn().mockResolvedValue(undefined),
  NUMERIC_DISPLAY_FONT: 'DSEG7ClassicMini-Regular',
}));
jest.mock('../../config/developmentFlags', () => ({
  hasEnabledDevelopmentFlags: jest.fn(() => false),
  shouldResetAchievementsOnLaunch: jest.fn(() => false),
}));
jest.mock('../../features/settings/settingsRepository', () => ({
  getBooleanSetting: jest.fn().mockResolvedValue(true),
  getStringSetting: jest.fn().mockResolvedValue('walker'),
  setSetting: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../features/location/locationService', () => ({
  ensureForegroundLocationPermission: jest.fn().mockResolvedValue(true),
  isBackgroundLocationRecording: jest.fn().mockResolvedValue(true),
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
jest.mock('../../features/export/gpxExporter', () => ({ shareGpx: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../features/reports/monthlyAreaReport', () => ({ getMonthlyAreaReport: jest.fn().mockResolvedValue(null) }));
jest.mock('../../features/reports/monthlyReport', () => jest.requireActual('../../features/reports/monthlyReport'));
jest.mock('../../features/customization/customizationResolver', () => ({
  resolveUserLocationIcon: jest.fn(() => ({ useNativeUserLocation: false, customIconId: 'walker', customImageUri: null })),
}));
jest.mock('../../features/customization/customizationOptions', () => ({
  DEFAULT_USER_LOCATION_ICON_ID: 'default',
  getUserLocationIconOption: jest.fn((id: string) => ({ id, label: id, premium: id === 'walker' })),
}));
jest.mock('../../features/premium/revenueCatAccess', () => ({
  getDefaultPremiumAccessState: jest.fn(() => ({ isPlusActive: true, entitlementId: 'strollia_plus' })),
  getPremiumAccessState: jest.fn().mockResolvedValue({ isPlusActive: true, entitlementId: 'strollia_plus' }),
  getPremiumOfferingSummary: jest.fn().mockResolvedValue(null),
  presentPremiumCustomerCenter: jest.fn().mockResolvedValue(true),
  purchasePremiumPackage: jest.fn(),
  restorePremiumPurchases: jest.fn(),
  subscribePremiumAccessStateUpdates: jest.fn(() => jest.fn()),
}));
jest.mock('../../features/photos/photoClusters', () => ({
  clusterMapPhotos: jest.fn(() => []),
  paginateMapPhotos: jest.fn(() => []),
}));
jest.mock('../../features/photos/photoLibrary', () => ({ hasFullPhotoAccess: jest.fn(() => true) }));
jest.mock('../../features/location/visitedCellRepository', () => ({
  getVisitedCellsInBounds: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../features/location/grid/gridCell', () => ({
  getGridBoundsForRegion: jest.fn(() => ({ minX: 0, maxX: 0, minY: 0, maxY: 0 })),
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

describe('App カスタムアイコン時の起動センタリング', () => {
  let renderer: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLatestMapScreenProps = null;
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    if (renderer) {
      act(() => {
        renderer.unmount();
      });
      renderer = null;
    }
    jest.restoreAllMocks();
  });

  test('カスタムアイコン時は地図準備完了まで現在地センタリングを遅延し、準備完了後に現在地へ寄せる', async () => {
    const userRegion = createUserCenteredRegion({ latitude: 35.681236, longitude: 139.767125 });

    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await flushPromises();

    // 地図準備完了前に現在地が届いてもセンタリングしない（animateToRegionはネイティブ未準備でドロップされるため）。
    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '現在地更新' }).props.onPress();
    });

    expect(mockAnimateToRegion).not.toHaveBeenCalled();

    // 地図準備完了後に現在地へセンタリングする。
    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '地図準備完了' }).props.onPress();
    });

    expect(mockAnimateToRegion).toHaveBeenCalledWith(userRegion, 250);
  });
});
