import App from '../App';
import { createUserCenteredRegion } from '../mapRegion';
import { Alert, AppState, Pressable, Text } from 'react-native';
import { getVisitedCellsInBounds } from '../../features/location/visitedCellRepository';
import { getGridBoundsForRegion } from '../../features/location/grid/gridCell';
import { getLocationPermissionState } from '../../features/location/locationPermission';
import {
  isBackgroundLocationRecording,
  startBackgroundLocationRecording,
} from '../../features/location/locationService';
import { getDailyLogs } from '../../features/logs/logRepository';
import {
  getPremiumAccessState,
  getPremiumOfferingSummary,
  presentPremiumCustomerCenter,
  purchasePremiumPackage,
  restorePremiumPurchases,
  subscribePremiumAccessStateUpdates,
} from '../../features/premium/revenueCatAccess';

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
let mockLatestSettingsScreenProps: any = null;
let mockLatestMapScreenProps: any = null;
let mockLatestMonthlyReportScreenProps: any = null;
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
      <Pressable accessibilityLabel="OSSライセンス" onPress={props.onOpenLicenseScreen}>
        <Text>OSSライセンス</Text>
      </Pressable>
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
  hasRequiredLocationPermission: jest.fn((state) => state.foregroundGranted && state.backgroundGranted),
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
    mockLatestSettingsScreenProps = null;
    mockLatestMapScreenProps = null;
    mockLatestMonthlyReportScreenProps = null;
    mockPremiumCustomerInfoUpdate = null;
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

  test('初回に権限不足でも復帰後に権限が揃ったら自動で記録開始する', async () => {
    let appStateHandler: ((state: string) => void) | null = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event: any, handler: any) => {
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
