import App from '../App';
import { createUserCenteredRegion } from '../mapRegion';
import { getVisitedCellsInBounds } from '../../features/location/visitedCellRepository';
import { getGridBoundsForRegion } from '../../features/location/grid/gridCell';

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
      </>
    );
  },
}));

jest.mock('../components/DailyLogsScreen', () => ({
  DailyLogsScreen: ({ onBackToMap }: { onBackToMap: () => void }) => {
    const { Pressable, Text } = require('react-native');

    return (
      <Pressable accessibilityLabel="地図へ" onPress={onBackToMap}>
        <Text>地図へ</Text>
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

jest.mock('../components/PhotoPreviewModals', () => ({
  PhotoPreviewModals: () => null,
}));

jest.mock('../components/reports/MonthlyReportScreen', () => ({
  MonthlyReportScreen: () => null,
}));

jest.mock('../components/SettingsScreen', () => ({
  SettingsScreen: () => null,
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
}));

jest.mock('../../features/location/locationService', () => ({
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
  hasRequiredLocationPermission: jest.fn(() => true),
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

jest.mock('../../features/reports/monthlyAreaReport', () => ({
  getMonthlyAreaReport: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../features/reports/monthlyReport', () => ({
  getPreviousReportMonth: jest.fn(() => '2026-05'),
}));

jest.mock('../../features/customization/customizationResolver', () => ({
  resolveUserLocationIcon: jest.fn(() => ({ useNativeUserLocation: true, customIconId: null })),
}));

jest.mock('../../features/premium/revenueCatAccess', () => ({
  getDefaultPremiumAccessState: jest.fn(() => ({ isPlusActive: false })),
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
}));

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

const flushPromises = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe('App 地図復帰時の表示範囲復元', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('別画面から地図へ戻ると現在地中心へ復元しvisited grid取得範囲も同期する', async () => {
    let renderer: any;
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

  test('初期状態は現在地に追従し、地図中心が現在地付近になっただけでは追従を再開しない', async () => {
    let renderer: any;
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
});
