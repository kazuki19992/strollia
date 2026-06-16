import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { NavigationContainer, NavigationIndependentTree } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  Linking,
  Animated,
  Pressable,
  SafeAreaView,
  Text,
  useColorScheme,
  View,
  Share,
} from 'react-native';
import MapView, { Region, UserLocationChangeEvent } from 'react-native-maps';

import { initializeDatabase } from '../db/database';
import { AchievementDefinition } from '../features/achievements/achievementDefinitions';
import { hasEnabledDevelopmentFlags, shouldResetAchievementsOnLaunch } from '../config/developmentFlags';
import {
  PRIVACY_POLICY_URL,
  SPECIFIED_COMMERCIAL_TRANSACTION_ACT_URL,
  TERMS_OF_SERVICE_URL,
} from '../config/legalLinks';
import {
  updateSentryScreenContext,
  updateSentrySubscriptionContext,
  updateSentryUserContext,
} from '../config/sentry';
import { initializeAchievementNotificationHandler, requestAchievementNotificationPermissionOnFirstLaunch, setupAchievementNotificationChannel } from '../features/achievements/achievementNotificationService';
import {
  AchievementListItem,
  PendingAchievementNotification,
  getAchievementListItems,
  getPendingInAppAchievementNotifications,
  markAchievementShownInApp,
} from '../features/achievements/achievementRepository';
import { canEvaluateAchievementsInForeground } from '../features/achievements/achievementEvaluationGate';
import { evaluateAchievementsAndNotify } from '../features/achievements/achievementService';
import { filterDismissedAchievementNotifications } from '../features/achievements/pendingNotifications';
import { shareGpx } from '../features/export/gpxExporter';
import { parseGpxToLocationPoints } from '../features/import/gpxImporter';
import { pickAndReadGpxFile } from '../features/import/gpxImportService';
import { importLocationPointsFromGpx } from '../features/import/importRepository';
import {
  isBackgroundLocationRecording,
  startBackgroundLocationRecording,
} from '../features/location/locationService';
import {
  canRequestLocationPermissionInApp,
  getLocationPermissionState,
  hasRequiredLocationPermission,
  LocationPermissionState,
} from '../features/location/locationPermission';
import { deleteAllUserData, getAllLocationPoints, getDailyLogs } from '../features/logs/logRepository';
import { getMonthlyAreaReport, MonthlyAreaReport } from '../features/reports/monthlyAreaReport';
import { createMonthlyReport, getPreviousReportMonth, hasMonthlyReportData } from '../features/reports/monthlyReport';
import { resolveUserLocationIcon } from '../features/customization/customizationResolver';
import {
  DEFAULT_USER_LOCATION_ICON_ID,
  getUserLocationIconOption,
  UserLocationIconId,
} from '../features/customization/customizationOptions';
import {
  AppColorPresetId,
  DEFAULT_APP_COLOR_PRESET_ID,
  getAppColorPreset,
  isAppColorPresetId,
} from '../features/customization/colorPresets';
import {
  getDefaultPremiumAccessState,
  getPremiumAccessState,
  getPremiumOfferingSummary,
  getRevenueCatAppUserId,
  PremiumOfferingSummary,
  PremiumPackagePlan,
  presentPremiumCustomerCenter,
  purchasePremiumPackage,
  restorePremiumPurchases,
  subscribePremiumAccessStateUpdates,
} from '../features/premium/revenueCatAccess';
import { getBooleanSetting, getStringSetting, setSetting } from '../features/settings/settingsRepository';
import { clusterMapPhotos, MapPhotoCluster, paginateMapPhotos } from '../features/photos/photoClusters';
import { MapPhoto, hasFullPhotoAccess } from '../features/photos/photoLibrary';
import { aggregateVisitedCells, getStableDisplayCellSizeMeters } from '../features/location/grid/gridAggregation';
import { getGridBoundsForRegion, GridCellPolygonSource } from '../features/location/grid/gridCell';
import { getVisitedCellsInBounds } from '../features/location/visitedCellRepository';
import { VisitedGridOverlayCell, getFogOpacity, toVisitedGridOverlayCells } from '../features/map/gridOverlay';
import { GRID_OVERLAY_CONFIG } from '../features/map/config/gridOverlayConfig';
import { shouldRequestReviewAfterAchievement } from '../features/review/reviewPromptLogic';
import { requestStoreReview } from '../features/review/storeReview';
import { DailyLogSummary, LocationPoint } from '../types/gps';
import { toLocalDate } from '../utils/date';
import type { LatLng, MapType } from 'react-native-maps';
import { loadAppFonts } from '../theme/fonts';
import { getAppTheme, applyColorPreset } from '../theme/theme';
import { createStyles } from './appStyles';
import { AutoStartStatus, ScreenMode } from './appTypes';
import { AchievementDialog } from './components/AchievementDialog';
import { AchievementListScreen } from './components/AchievementListScreen';
import { AboutAppScreen } from './components/AboutAppScreen';
import { DailyLogDetailScreen } from './components/DailyLogDetailScreen';
import { DailyLogsScreen } from './components/DailyLogsScreen';
import { AchievementUnlockModal } from './components/AchievementUnlockModal';
import { FirstLaunchTutorialDialog } from './components/FirstLaunchTutorialDialog';
import { LicenseDetailScreen, LicenseScreen } from './components/LicenseScreen';
import type { OssLicenseEntry } from './generated/ossLicenses';
import { MapScreen } from './components/MapScreen';
import { PhotoPreviewModals } from './components/PhotoPreviewModals';
import { PremiumPaywallModal } from './components/PremiumPaywallModal';
import { MonthlyReportScreen } from './components/reports/MonthlyReportScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { useAchievementDialogEffects } from './hooks/useAchievementDialogEffects';
import { useAnimatedBooleanOpacity } from './hooks/useAnimatedBooleanOpacity';
import { useAutoFitInitialRoute } from './hooks/useAutoFitInitialRoute';
import { useForegroundUserLocation } from './hooks/useForegroundUserLocation';
import { useKeepScreenAwake } from './hooks/useKeepScreenAwake';
import { useMapRouteState } from './hooks/useMapRouteState';
import { usePhotoMapOverlay } from './hooks/usePhotoMapOverlay';
import { toDisplaySpeedKmh } from './hooks/useRawLocationSpeed';
import { useScreenTransitionOpacity } from './hooks/useScreenTransitionOpacity';
import { useCurrentAreaLabel } from './hooks/useCurrentAreaName';
import { DELETE_ALL_DATA_SUCCESS_MESSAGE, refreshDeletedUserDataState } from './deleteAllDataFlow';
import { shouldStartRecordingAutomatically } from './autoRecording';
import { getNextMapType } from './mapType';
import { createUserCenteredRegion, isValidMapCoordinate, shouldRestoreMapRegionOnMapOpen } from './mapRegion';

/** expo-keep-awakeでこの画面のロック抑止を識別するタグ。 */
const KEEP_AWAKE_TAG = 'strollia-foreground-map';
/** 画面ON維持設定をSQLiteへ保存するキー。 */
const KEEP_SCREEN_AWAKE_SETTING_KEY = 'keepScreenAwake';
/** マップ上の写真表示設定をSQLiteへ保存するキー。 */
const SHOW_PHOTOS_ON_MAP_SETTING_KEY = 'showPhotosOnMap';
/** 現在地アイコン設定をSQLiteへ保存するキー。 */
const USER_LOCATION_ICON_SETTING_KEY = 'userLocationIcon';
/** アプリカラープリセット設定をSQLiteへ保存するキー。 */
const APP_COLOR_PRESET_SETTING_KEY = 'appColorPresetId';
/** カスタムアイコン画像URIをSQLiteへ保存するキー。 */
const CUSTOM_ICON_IMAGE_URI_SETTING_KEY = 'customIconImageUri';
/** 初回起動チュートリアル完了状態をSQLiteへ保存するキー。 */
const FIRST_LAUNCH_TUTORIAL_COMPLETED_SETTING_KEY = 'firstLaunchTutorialCompleted';
const REVIEW_PROMPTED_SETTING_KEY = 'reviewPrompted';
/** 画面切り替えのちらつきを抑えるフェード時間。 */
const SCREEN_TRANSITION_DURATION_MS = 180;

type SettingsStackParamList = {
  SettingsHome: undefined;
  AboutApp: undefined;
  LicenseList: undefined;
  LicenseDetail: { license: OssLicenseEntry };
};

type DailyLogStackParamList = {
  DailyLogList: undefined;
  DailyLogDetail: { log: DailyLogSummary };
};

type FirstLaunchTutorialMode = 'firstLaunch' | 'replay';

const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();
const DailyLogStack = createNativeStackNavigator<DailyLogStackParamList>();
/** 新規visited cellを塗るときのフェード時間。 */
const VISITED_GRID_FADE_DURATION_MS = 500;
/** visited cellフェード中の再描画間隔。 */
const VISITED_GRID_FADE_FRAME_MS = 50;

/** 権限状態を取得する前にUIが参照する安全な初期値。 */
const EMPTY_PERMISSION_STATE: LocationPermissionState = {
  foregroundGranted: false,
  backgroundGranted: false,
  canAskForeground: true,
  canAskBackground: true,
};

/** Strolliaの画面状態、地図表示、端末API連携を束ねるルートコンポーネント。 */
export default function App() {
  const colorScheme = useColorScheme();
  const [premiumAccessState, setPremiumAccessState] = useState(getDefaultPremiumAccessState);
  const [revenueCatAppUserId, setRevenueCatAppUserId] = useState<string | null>(null);
  const [selectedAppColorPresetId, setSelectedAppColorPresetId] = useState<AppColorPresetId>(DEFAULT_APP_COLOR_PRESET_ID);
  const theme = useMemo(() => {
    const rawTheme = getAppTheme(colorScheme);
    const preset = premiumAccessState.isPlusActive
      ? getAppColorPreset(selectedAppColorPresetId)
      : getAppColorPreset(DEFAULT_APP_COLOR_PRESET_ID);
    return applyColorPreset(rawTheme, preset);
  }, [colorScheme, premiumAccessState.isPlusActive, selectedAppColorPresetId]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const mapRef = useRef<MapView | null>(null);
  const autoStartInFlightRef = useRef(false);
  const isUpdatingPhotoSettingRef = useRef(false);
  const isImportingGpxRef = useRef(false);
  const isAchievementDialogVisibleRef = useRef(false);
  const wasAchievementEvaluationPausedRef = useRef(false);
  const shouldRestoreMapRegionOnOpenRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [screenMode, setScreenMode] = useState<ScreenMode>('map');
  const [selectedAchievement, setSelectedAchievement] = useState<AchievementListItem | null>(null);
  const [dailyLogs, setDailyLogs] = useState<DailyLogSummary[]>([]);
  const [monthlyAreaReport, setMonthlyAreaReport] = useState<MonthlyAreaReport | null>(null);
  const [points, setPoints] = useState<LocationPoint[]>([]);
  const [message, setMessage] = useState('起動後に自動でGPS記録を開始します。');
  const [autoStartStatus, setAutoStartStatus] = useState<AutoStartStatus>('checking');
  const [permissionState, setPermissionState] = useState<LocationPermissionState>(EMPTY_PERMISSION_STATE);
  const [keepScreenAwake, setKeepScreenAwake] = useState(false);
  const [showPhotosOnMap, setShowPhotosOnMap] = useState(false);
  const [isUpdatingPhotoSetting, setIsUpdatingPhotoSetting] = useState(false);
  const [isImportingGpx, setIsImportingGpx] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<MapPhoto | null>(null);
  const [achievementItems, setAchievementItems] = useState<AchievementListItem[]>([]);
  const [pendingAchievementNotifications, setPendingAchievementNotifications] = useState<PendingAchievementNotification[]>([]);
  const [selectedPhotoCluster, setSelectedPhotoCluster] = useState<MapPhotoCluster | null>(null);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [userCoordinate, setUserCoordinate] = useState<LatLng | null>(null);
  const [isFollowingUserLocation, setIsFollowingUserLocation] = useState(true);
  // ネイティブ地図の初期化完了フラグ。onMapReady前のanimateToRegionはネイティブ側で
  // 無視されるため、カスタムアイコンの初回センタリングは準備完了を待ってから実行する。
  const [isMapReady, setIsMapReady] = useState(false);
  const [visibleRegion, setVisibleRegion] = useState<Region | null>(null);
  /** DBから取得して表示セルサイズへ集約したvisited cell。表示用フェードとは分けて保持する。 */
  const [visitedGridSourceCells, setVisitedGridSourceCells] = useState<GridCellPolygonSource[]>([]);
  const [visitedGridRefreshVersion, setVisitedGridRefreshVersion] = useState(0);
  /** 新規visited cellの0.5秒フェードを進めるため、50ms間隔で表示セルを再計算する。 */
  const [visitedGridFadeFrame, setVisitedGridFadeFrame] = useState(0);
  const visitedGridDisplayCellSizeRef = useRef<number | null>(null);
  const visitedGridFadeStartedAtRef = useRef(new Map<string, number>());
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0);
  const [mapType, setMapType] = useState<MapType>('standard');
  const [selectedUserLocationIconId, setSelectedUserLocationIconId] = useState<UserLocationIconId>(DEFAULT_USER_LOCATION_ICON_ID);
  const [customIconImageUri, setCustomIconImageUri] = useState<string | null>(null);
  const [hasPromptedReview, setHasPromptedReview] = useState(false);
  const [isFirstLaunchTutorialVisible, setIsFirstLaunchTutorialVisible] = useState(false);
  const [firstLaunchTutorialMode, setFirstLaunchTutorialMode] = useState<FirstLaunchTutorialMode>('firstLaunch');
  const hasRequestedAchievementNotificationPermissionRef = useRef(false);
  /** 閉じた直後のDB再取得で同じ解除演出が戻ることを防ぐためのセッション内ガード。 */
  const dismissedAchievementQueueIdsRef = useRef(new Set<number>());

  const { renderRouteCoordinates, initialRegion, distance } = useMapRouteState(
    points,
    dailyLogs,
  );
  const recenterButtonOpacity = useAnimatedBooleanOpacity(!isFollowingUserLocation, 500);
  const currentAreaLabel = useCurrentAreaLabel({ userCoordinate, appState });
  const gridOverlayRegion = visibleRegion ?? initialRegion;
  const gridOverlayOpacity = useMemo(() => getFogOpacity(gridOverlayRegion, GRID_OVERLAY_CONFIG), [gridOverlayRegion]);
  /** 集約済みvisited cellに現在のopacityとフェード進捗を適用したMapView Polygon用データ。 */
  const visitedGridCells = useMemo<VisitedGridOverlayCell[]>(() => {
    const now = Date.now();

    return toVisitedGridOverlayCells(
      visitedGridSourceCells,
      gridOverlayOpacity,
      theme.colors.primary,
      GRID_OVERLAY_CONFIG,
      (cell) => getVisitedGridFadeProgress(cell.cellId, now),
    );
  }, [gridOverlayOpacity, theme.colors.primary, visitedGridFadeFrame, visitedGridSourceCells]);
  const screenTransitionOpacity = useScreenTransitionOpacity(screenMode, SCREEN_TRANSITION_DURATION_MS);
  const todayDistanceMeters = useMemo(() => {
    const today = toLocalDate(new Date());
    return dailyLogs.find((log) => log.localDate === today)?.distanceMeters ?? 0;
  }, [dailyLogs]);
  const { photos, isLoadingPhotos, photoErrorMessage } = usePhotoMapOverlay(showPhotosOnMap);
  const photoClusters = useMemo(() => clusterMapPhotos(photos, visibleRegion), [photos, visibleRegion]);
  const selectedPhotoClusterPages = useMemo(
    () => paginateMapPhotos(selectedPhotoCluster?.photos ?? []),
    [selectedPhotoCluster],
  );
  const [premiumOfferingSummary, setPremiumOfferingSummary] = useState<PremiumOfferingSummary | null>(null);
  const [isLoadingPremiumOffering, setIsLoadingPremiumOffering] = useState(false);
  const [isPurchasingPremiumPackage, setIsPurchasingPremiumPackage] = useState(false);
  const isPurchasingPremiumPackageRef = useRef(false);
  const [isPresentingPremiumCustomerCenter, setIsPresentingPremiumCustomerCenter] = useState(false);
  const isPresentingPremiumCustomerCenterRef = useRef(false);
  const [isRestoringPremiumPurchases, setIsRestoringPremiumPurchases] = useState(false);
  const [isPremiumPaywallVisible, setIsPremiumPaywallVisible] = useState(false);
  const isPremiumPaywallVisibleRef = useRef(false);
  const userLocationIcon = useMemo(
    () => resolveUserLocationIcon(selectedUserLocationIconId, premiumAccessState.isPlusActive, customIconImageUri),
    [premiumAccessState.isPlusActive, selectedUserLocationIconId, customIconImageUri],
  );
  const hasRequiredPermission = hasRequiredLocationPermission(permissionState);
  const shouldOpenSettingsForPermission = !canRequestLocationPermissionInApp(permissionState);
  const shouldShowDevelopmentFlagBanner = hasEnabledDevelopmentFlags();
  const activeAchievementNotification = pendingAchievementNotifications[0] ?? null;
  const sentryScreenName = useMemo(() => {
    if (isPremiumPaywallVisible) {
      return 'PremiumPaywall';
    }

    if (isFirstLaunchTutorialVisible) {
      return firstLaunchTutorialMode === 'replay' ? 'FirstLaunchTutorialReplay' : 'FirstLaunchTutorial';
    }

    if (selectedPhoto || selectedPhotoCluster) {
      return 'PhotoPreview';
    }

    switch (screenMode) {
      case 'achievements':
        return 'AchievementList';
      case 'dailyLogs':
        return 'DailyLogList';
      case 'map':
        return 'Map';
      case 'monthlyReport':
        return 'MonthlyReport';
      case 'settings':
        return 'SettingsHome';
    }
  }, [firstLaunchTutorialMode, isFirstLaunchTutorialVisible, isPremiumPaywallVisible, screenMode, selectedPhoto, selectedPhotoCluster]);

  useEffect(() => {
    updateSentryUserContext(revenueCatAppUserId);
  }, [revenueCatAppUserId]);

  useEffect(() => {
    updateSentrySubscriptionContext(premiumAccessState);
  }, [premiumAccessState]);

  useEffect(() => {
    updateSentryScreenContext(sentryScreenName);
  }, [sentryScreenName]);

  /** DB、記録状態、権限状態をまとめて再読み込みし、画面表示を同期する。 */
  const refreshData = useCallback(async () => {
    const [logs, allPoints, recording, permissions] = await Promise.all([
      getDailyLogs(),
      getAllLocationPoints(),
      isBackgroundLocationRecording(),
      getLocationPermissionState(),
    ]);

    setDailyLogs(logs);
    setPoints(allPoints);
    setIsRecording(recording);
    setPermissionState(permissions);
    setVisitedGridRefreshVersion((version) => version + 1);

    getMonthlyAreaReport(getPreviousReportMonth())
      .then(setMonthlyAreaReport)
      .catch((error: unknown) => {
        console.warn('Failed to refresh monthly area report:', error);
      });

    return { logs, allPoints, recording, permissions };
  }, []);


  /** 実績一覧と未表示の解除演出キューを再読み込みする。 */
  const refreshAchievementState = useCallback(async (showPendingNotifications = false): Promise<void> => {
    const [items, pendingNotifications] = await Promise.all([
      getAchievementListItems(),
      showPendingNotifications ? getPendingInAppAchievementNotifications() : Promise.resolve([]),
    ]);

    setAchievementItems(items);

    if (showPendingNotifications) {
      setPendingAchievementNotifications(filterDismissedAchievementNotifications(pendingNotifications, dismissedAchievementQueueIdsRef.current));
    }
  }, []);

  /**
   * 実績解除ダイアログが出ていない時だけ実績を評価する。
   *
   * @returns 実績評価を実行した場合はtrue。
   */
  const evaluateAchievementsIfDialogIdle = useCallback(async (): Promise<boolean> => {
    if (!canEvaluateAchievementsInForeground(isAchievementDialogVisibleRef.current)) {
      wasAchievementEvaluationPausedRef.current = true;
      return false;
    }

    await evaluateAchievementsAndNotify();
    return true;
  }, []);

  /**
   * GPSログを再読み込みし、実績解除ダイアログが出ていなければ実績評価まで進める。
   *
   * @returns なし。
   */
  const refreshDataAndEvaluateAchievementsIfDialogIdle = useCallback(async (): Promise<void> => {
    await refreshData();
    const didEvaluate = await evaluateAchievementsIfDialogIdle();

    if (didEvaluate) {
      await refreshAchievementState(true);
    }
  }, [evaluateAchievementsIfDialogIdle, refreshAchievementState, refreshData]);

  /** GPSバックグラウンド記録を開始し、結果をユーザー向けメッセージへ反映する。 */
  const startRecording = useCallback(
    async (reason: 'auto' | 'manual' = 'manual'): Promise<void> => {
      try {
        await startBackgroundLocationRecording();
        const result = await refreshData();
        setMessage(reason === 'auto' ? 'GPS記録を自動開始しました。' : 'バックグラウンドGPS記録を開始しました。');
        setAutoStartStatus(hasRequiredLocationPermission(result.permissions) ? 'recording' : 'needsPermission');
      } catch (error: unknown) {
        await refreshData().catch(() => undefined);
        setMessage(error instanceof Error ? error.message : 'GPS記録の開始に失敗しました。');
        setAutoStartStatus('failed');
      }
    },
    [refreshData],
  );

  /** 権限許可後に未記録ならGPS記録の自動開始を試みる。 */
  const maybeStartRecordingAutomatically = useCallback(
    async (state: { permissions: LocationPermissionState; recording: boolean }): Promise<void> => {
      if (!shouldStartRecordingAutomatically({
        permissions: state.permissions,
        isRecording: state.recording,
        isAutoStartInFlight: autoStartInFlightRef.current,
      })) {
        setAutoStartStatus(hasRequiredLocationPermission(state.permissions) ? 'recording' : 'needsPermission');
        return;
      }

      autoStartInFlightRef.current = true;

      try {
        await startRecording('auto');
      } finally {
        autoStartInFlightRef.current = false;
      }
    },
    [startRecording],
  );

  /** 権限状態に応じてアプリ内要求またはOS設定画面への誘導を行う。 */
  const requestLocationPermission = useCallback(async (): Promise<void> => {
    if (shouldOpenSettingsForPermission) {
      await Linking.openSettings();
      return;
    }

    await startRecording('manual');
  }, [shouldOpenSettingsForPermission, startRecording]);

  /** 全期間のGPSログをGPXとして共有する。 */
  const exportAllLogs = useCallback(async (): Promise<void> => {
    try {
      await shareGpx(points, 'all');
    } catch (error: unknown) {
      Alert.alert('エクスポート失敗', error instanceof Error ? error.message : 'GPX出力に失敗しました。');
    }
  }, [points]);


  /** 確認ダイアログを挟んで保存済みデータを全削除する。 */
  const deleteAllData = useCallback(async (): Promise<void> => {
    Alert.alert('すべてのデータを削除', '保存済みのGPSログ、訪問エリア、実績の解除状況をすべて削除します。この操作は取り消せません。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除する',
        style: 'destructive',
        onPress: () => {
          deleteAllUserData()
            .then(async () => {
              await refreshDeletedUserDataState(refreshData, refreshAchievementState);
              setMessage(DELETE_ALL_DATA_SUCCESS_MESSAGE);
            })
            .catch((error: unknown) => {
              Alert.alert('削除失敗', error instanceof Error ? error.message : 'データを削除できませんでした。');
            });
        },
      },
    ]);
  }, [refreshAchievementState, refreshData]);

  /** 画面ON維持設定をUI状態とSQLiteの両方へ反映する。 */
  const updateKeepScreenAwake = useCallback(async (enabled: boolean): Promise<void> => {
    setKeepScreenAwake(enabled);
    await setSetting(KEEP_SCREEN_AWAKE_SETTING_KEY, enabled);
  }, []);

  /**
   * 写真表示設定を切り替える。初回ON時は写真ライブラリのフルアクセス権限を要求する。
   *
   * @param enabled - マップ上の写真表示を有効にするかどうか。
   * @returns なし。
   */
  const updateShowPhotosOnMap = useCallback(async (enabled: boolean): Promise<void> => {
    if (isUpdatingPhotoSettingRef.current) {
      return;
    }

    isUpdatingPhotoSettingRef.current = true;
    setIsUpdatingPhotoSetting(true);

    try {
      if (!enabled) {
        setShowPhotosOnMap(false);
        await setSetting(SHOW_PHOTOS_ON_MAP_SETTING_KEY, false);
        return;
      }

      const permission = await MediaLibrary.requestPermissionsAsync(false, ['photo']);

      if (!hasFullPhotoAccess(permission)) {
        setShowPhotosOnMap(false);
        await setSetting(SHOW_PHOTOS_ON_MAP_SETTING_KEY, false);
        Alert.alert(
          '写真のフルアクセスが必要です',
          'マップ上に写真を表示するには、写真ライブラリへのフルアクセスを許可してください。限定アクセスではジオタグ付き写真を十分に読み取れません。',
        );
        return;
      }

      setShowPhotosOnMap(true);
      await setSetting(SHOW_PHOTOS_ON_MAP_SETTING_KEY, true);
    } finally {
      isUpdatingPhotoSettingRef.current = false;
      setIsUpdatingPhotoSetting(false);
    }
  }, []);

  /**
   * 初回起動時にDBと永続設定を読み込み、アプリを描画可能な状態へ進める。
   */
  useEffect(() => {
    initializeDatabase()
      .then(async () => {
        await loadAppFonts().catch((error: unknown) => {
          console.warn('Failed to load app fonts:', error);
        });
        const [
          savedKeepScreenAwake,
          savedShowPhotosOnMap,
          savedUserLocationIcon,
          savedAppColorPresetId,
          savedCustomIconImageUri,
          savedReviewPrompted,
          savedFirstLaunchTutorialCompleted,
        ] = await Promise.all([
          getBooleanSetting(KEEP_SCREEN_AWAKE_SETTING_KEY, false),
          getBooleanSetting(SHOW_PHOTOS_ON_MAP_SETTING_KEY, false),
          getStringSetting(USER_LOCATION_ICON_SETTING_KEY, DEFAULT_USER_LOCATION_ICON_ID),
          getStringSetting(APP_COLOR_PRESET_SETTING_KEY, DEFAULT_APP_COLOR_PRESET_ID),
          getStringSetting(CUSTOM_ICON_IMAGE_URI_SETTING_KEY, ''),
          getBooleanSetting(REVIEW_PROMPTED_SETTING_KEY, false),
          getBooleanSetting(FIRST_LAUNCH_TUTORIAL_COMPLETED_SETTING_KEY, false),
        ]);
        setKeepScreenAwake(savedKeepScreenAwake);
        setShowPhotosOnMap(savedShowPhotosOnMap);
        setSelectedUserLocationIconId(getUserLocationIconOption(savedUserLocationIcon as UserLocationIconId).id);
        setSelectedAppColorPresetId(isAppColorPresetId(savedAppColorPresetId) ? savedAppColorPresetId : DEFAULT_APP_COLOR_PRESET_ID);
        setCustomIconImageUri(savedCustomIconImageUri || null);
        setHasPromptedReview(savedReviewPrompted);
        getPremiumAccessState()
          .then(setPremiumAccessState)
          .catch((error: unknown) => {
            console.warn('Failed to refresh premium access state:', error);
          });
        getRevenueCatAppUserId()
          .then(setRevenueCatAppUserId)
          .catch((error: unknown) => {
            console.warn('Failed to refresh RevenueCat app user id:', error);
          });
        setIsLoadingPremiumOffering(true);
        getPremiumOfferingSummary()
          .then(setPremiumOfferingSummary)
          .catch((error: unknown) => {
            console.warn('Failed to refresh premium offering summary:', error);
          })
          .finally(() => {
            setIsLoadingPremiumOffering(false);
          });
        initializeAchievementNotificationHandler();
        await setupAchievementNotificationChannel().catch(() => undefined);
        if (savedFirstLaunchTutorialCompleted) {
          await requestAchievementNotificationPermissionIfNeeded();
        }
        const initialState = await refreshData();
        await maybeStartRecordingAutomatically(initialState);
        await evaluateAchievementsAndNotify({ resetBeforeEvaluate: shouldResetAchievementsOnLaunch() });
        await refreshAchievementState(true);
        if (!savedFirstLaunchTutorialCompleted) {
          setFirstLaunchTutorialMode('firstLaunch');
          setIsFirstLaunchTutorialVisible(true);
        }
      })
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : 'DB初期化に失敗しました。');
      })
      .finally(() => setIsReady(true));
  }, [maybeStartRecordingAutomatically, refreshAchievementState, refreshData]);

  /** RevenueCat側のCustomerInfo更新に合わせてStrollia Plus状態を反映する。 */
  useEffect(() => subscribePremiumAccessStateUpdates(setPremiumAccessState), []);

  /**
   * フォアグラウンド復帰時にDBと権限状態を再同期する。
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      setAppState(state);
      if (state === 'active') {
        refreshData()
          .then(maybeStartRecordingAutomatically)
          .then(evaluateAchievementsIfDialogIdle)
          .then(async (didEvaluate) => {
            if (didEvaluate) {
              await refreshAchievementState(true);
            }
          })
          .catch((error: unknown) => {
            setMessage(error instanceof Error ? error.message : 'GPSログの再読み込みに失敗しました。');
          });
      }
    });

    return () => subscription.remove();
  }, [evaluateAchievementsIfDialogIdle, maybeStartRecordingAutomatically, refreshAchievementState, refreshData]);


  /**
   * 更新ボタンを不要にするため、フォアグラウンド中は定期的にログを再読み込みする。
   */
  useEffect(() => {
    if (!isReady || appState !== 'active') {
      return;
    }

    const intervalId = setInterval(() => {
      refreshDataAndEvaluateAchievementsIfDialogIdle()
        .catch((error: unknown) => {
          setMessage(error instanceof Error ? error.message : 'GPSログの自動更新に失敗しました。');
        });
    }, 10_000);

    return () => clearInterval(intervalId);
  }, [appState, isReady, refreshDataAndEvaluateAchievementsIfDialogIdle]);

  /**
   * 表示範囲に含まれるvisited cellを読み込み、現在のズームに合う表示セルへ集約する。
   */
  useEffect(() => {
    if (!isReady) {
      return;
    }

    const bounds = getGridBoundsForRegion(gridOverlayRegion, { paddingRatio: GRID_OVERLAY_CONFIG.boundsPaddingRatio });
    const displayCellSizeMeters = getStableDisplayCellSizeMeters(
      gridOverlayRegion,
      visitedGridDisplayCellSizeRef.current,
      GRID_OVERLAY_CONFIG,
    );
    visitedGridDisplayCellSizeRef.current = displayCellSizeMeters;
    let isCancelled = false;

    getVisitedCellsInBounds(bounds)
      .then((cells) => {
        if (isCancelled) {
          return;
        }

        const aggregatedCells = aggregateVisitedCells(cells, displayCellSizeMeters);
        syncVisitedGridFadeState(aggregatedCells);
        setVisitedGridSourceCells(aggregatedCells);
      })
      .catch((error: unknown) => {
        console.warn('Failed to refresh visited grid cells:', error);
      });

    return () => {
      isCancelled = true;
    };
  }, [gridOverlayRegion, isReady, visitedGridRefreshVersion]);

  /**
   * 新規visited cellのフェード中だけ短い間隔で再描画する。
   */
  useEffect(() => {
    const now = Date.now();
    const hasActiveFade = visitedGridSourceCells.some((cell) => getVisitedGridFadeProgress(cell.cellId, now) < 1);

    if (!hasActiveFade) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setVisitedGridFadeFrame((frame) => frame + 1);
    }, VISITED_GRID_FADE_FRAME_MS);

    return () => clearTimeout(timeoutId);
  }, [visitedGridFadeFrame, visitedGridSourceCells]);

  useKeepScreenAwake({ enabled: keepScreenAwake, appState, tag: KEEP_AWAKE_TAG });
  useAchievementDialogEffects({
    activeAchievementNotification,
    isReady,
    appState,
    isAchievementDialogVisibleRef,
    wasAchievementEvaluationPausedRef,
    refreshDataAndEvaluateAchievementsIfDialogIdle,
    setMessage,
  });
  useAutoFitInitialRoute(mapRef, screenMode, renderRouteCoordinates, userCoordinate);
  // カスタムアイコン時はOS標準ドットを隠すため、前景ウォッチで現在地を供給する。
  useForegroundUserLocation(!userLocationIcon.useNativeUserLocation, applyUserLocation);

  // カスタムアイコン時はネイティブのfollowsUserLocationが使えないため、このeffectが唯一の
  // オーナーとして追従センタリングを担う（applyUserLocation側はOS標準時のみセンタリングする）。
  // 追従中は現在地更新のたびにアプリ側でセンタリングし、OS標準のfollowsUserLocationと同じ挙動にする。
  //
  // 起動直後は前景ウォッチの初回更新（getLastKnownPositionAsync）がネイティブ地図の初期化完了より
  // 先に届くことがあり、その時点のanimateToRegionはネイティブ側で無視される。さらに静止中は
  // watchPositionAsyncが再発火しないため再センタリングの機会がなく、広域initialRegionで固定されてしまう。
  // これを防ぐためisMapReady（onMapReady）を待ってからセンタリングする。現在地が先に届いていれば
  // 準備完了時に、準備完了が先なら現在地到着時に、いずれの順序でも確実にセンタリングが走る。
  useEffect(() => {
    if (screenMode !== 'map' || userLocationIcon.useNativeUserLocation) {
      return;
    }

    if (!isMapReady || !isFollowingUserLocation || !userCoordinate) {
      return;
    }

    centerOnCoordinate(userCoordinate, false);
  }, [screenMode, userLocationIcon.useNativeUserLocation, isMapReady, isFollowingUserLocation, userCoordinate]);

  // MapViewは地図画面でのみマウントされる。地図から離れたら準備完了フラグを倒し、再表示時の
  // 新しいネイティブ地図がonMapReadyを発火するまでカスタムセンタリングを待たせる。
  useEffect(() => {
    if (screenMode !== 'map') {
      setIsMapReady(false);
    }
  }, [screenMode]);

  /**
   * 別画面から地図へ戻った直後に、MapViewの再マウントで広域initialRegionへ戻ることを防ぐ。
   */
  useEffect(() => {
    if (screenMode !== 'map' || !shouldRestoreMapRegionOnOpenRef.current) {
      return;
    }

    shouldRestoreMapRegionOnOpenRef.current = false;

    if (!userCoordinate) {
      return;
    }

    centerOnCoordinate(userCoordinate, false);
  }, [screenMode, userCoordinate]);

  /**
   * visited cellの初回描画時刻を同期し、表示から外れたセルのフェード状態を掃除する。
   *
   * @param cells - 次に描画するvisited cell。
   * @returns なし。
   */
  function syncVisitedGridFadeState(cells: GridCellPolygonSource[]): void {
    const now = Date.now();
    const nextCellIds = new Set(cells.map((cell) => cell.cellId));

    for (const cell of cells) {
      if (!visitedGridFadeStartedAtRef.current.has(cell.cellId)) {
        visitedGridFadeStartedAtRef.current.set(cell.cellId, now);
      }
    }

    for (const cellId of visitedGridFadeStartedAtRef.current.keys()) {
      if (!nextCellIds.has(cellId)) {
        visitedGridFadeStartedAtRef.current.delete(cellId);
      }
    }

    setVisitedGridFadeFrame((frame) => frame + 1);
  }

  /**
   * 新規visited cellのフェード進捗を返す。
   *
   * @param cellId - 表示セルID。
   * @param now - 現在時刻。単位はms。
   * @returns 0から1のフェード進捗。
   */
  function getVisitedGridFadeProgress(cellId: string, now: number): number {
    const startedAt = visitedGridFadeStartedAtRef.current.get(cellId);

    if (!startedAt) {
      return 1;
    }

    return Math.min(1, Math.max(0, (now - startedAt) / VISITED_GRID_FADE_DURATION_MS));
  }

  /**
   * 現在地更新を受け取り、追従中であれば地図中心も更新する。
   *
   * @param event - react-native-mapsから渡される現在地更新イベント。
   * @returns なし。
   */
  function handleUserLocationChange(event: UserLocationChangeEvent): void {
    const coordinate = event.nativeEvent.coordinate;

    if (!coordinate) {
      return;
    }

    applyUserLocation(coordinate.latitude, coordinate.longitude, coordinate.speed);
  }

  /**
   * 緯度経度と速度から現在地・速度表示・追従を更新する。
   * OS標準の位置イベントと前景ウォッチの両方から呼ばれる。
   *
   * @param latitude - 緯度。
   * @param longitude - 経度。
   * @param speed - m/s単位の速度。取得できない場合はnull/undefined。
   * @returns なし。
   */
  function applyUserLocation(latitude: number, longitude: number, speed: number | null | undefined): void {
    const nextCoordinate = { latitude, longitude };
    if (!isValidMapCoordinate(nextCoordinate)) {
      return;
    }

    setUserCoordinate(nextCoordinate);
    const nextSpeedKmh = toDisplaySpeedKmh(speed ?? null);

    if (nextSpeedKmh != null) {
      setCurrentSpeedKmh(nextSpeedKmh);
    }

    // OS標準アイコン時のみここでセンタリングする。カスタムアイコン時は専用effectが
    // 唯一のオーナーとして追従するため、ここで重複してanimateToRegionを呼ばない。
    if (isFollowingUserLocation && userLocationIcon.useNativeUserLocation) {
      centerOnCoordinate(nextCoordinate, false);
    }
  }

  /**
   * ユーザーが地図を動かしたら現在地追従を一時停止する。
   *
   * @returns なし。
   */
  function handleMapPanDrag(): void {
    setIsFollowingUserLocation(false);
  }

  /**
   * 表示範囲を保存する。追従再開は現在地ボタン押下に限定し、広域表示中の意図しない引き戻しを防ぐ。
   *
   * @param region - MapViewの現在表示範囲。
   * @returns なし。
   */
  function handleRegionChangeComplete(region: Region): void {
    setVisibleRegion(region);
  }

  /**
   * ネイティブ地図の初期化完了を受けて、カスタムアイコンの初回センタリングを解禁する。
   *
   * @returns なし。
   */
  function handleMapReady(): void {
    setIsMapReady(true);
  }

  /**
   * 指定座標が画面中心になるよう地図を移動する。
   *
   * @param coordinate - 中心へ移動したい緯度経度。
   * @param animated - アニメーション付きで移動するか。
   * @returns なし。
   */
  function centerOnCoordinate(coordinate: LatLng, animated = true): void {
    if (!isValidMapCoordinate(coordinate)) {
      return;
    }

    const region = createUserCenteredRegion(coordinate);
    setVisibleRegion(region);
    setVisitedGridRefreshVersion((version) => version + 1);
    mapRef.current?.animateToRegion(region, animated ? 500 : 250);
  }

  /**
   * 現在地ボタン押下時に追従を再開して現在地へ戻す。
   *
   * @returns なし。
   */
  function recenterOnUserLocation(): void {
    if (!userCoordinate) {
      return;
    }

    setIsFollowingUserLocation(true);
    centerOnCoordinate(userCoordinate);
  }

  /**
   * 写真マーカーの単体/複数タップを処理する。
   *
   * @param cluster - タップされた写真クラスタ。
   * @returns なし。
   */
  function handlePhotoClusterPress(cluster: MapPhotoCluster): void {
    triggerSelectionHaptic();

    if (cluster.photos.length === 1) {
      setSelectedPhotoCluster(null);
      setSelectedPhoto(cluster.photos[0]);
      return;
    }

    setSelectedPhotoCluster(cluster);
  }

  /** 軽い選択操作に使うタプティックを鳴らす。 */
  function triggerSelectionHaptic(): void {
    Haptics.selectionAsync().catch(() => undefined);
  }

  /** 画面遷移など少し強い操作に使うタプティックを鳴らす。 */
  function triggerLightImpactHaptic(): void {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }

  /** 下部ナビゲーションから別画面へ移動する。 */
  function navigateToScreen(nextScreenMode: ScreenMode): void {
    triggerLightImpactHaptic();
    setScreenMode(nextScreenMode);
  }

  /** 日ごとの記録画面へ移動する。 */
  function openDailyLogs(): void {
    navigateToScreen('dailyLogs');
  }

  /** 地図画面へ戻る。 */
  function openMap(): void {
    triggerLightImpactHaptic();
    if (shouldRestoreMapRegionOnMapOpen({ userCoordinate, isFollowingUserLocation }) && userCoordinate) {
      shouldRestoreMapRegionOnOpenRef.current = true;
      setVisibleRegion(createUserCenteredRegion(userCoordinate));
      setVisitedGridRefreshVersion((version) => version + 1);
    }
    setScreenMode('map');
  }

  /** 実績画面へ移動する。 */
  function openAchievements(): void {
    refreshAchievementState().catch(() => undefined);
    navigateToScreen('achievements');
  }

  /** 月次レポート画面へ移動する。無料ユーザーはペイウォールを表示する。 */
  function openMonthlyReport(): void {
    // 起動直後は premiumAccessState がデフォルト値（未確定）のままの可能性があるため、
    // ボタン押下時に最新状態を取得してから判定する。
    getPremiumAccessState()
      .then((latestState) => {
        setPremiumAccessState(latestState);
        enterMonthlyReportOrPrompt(latestState.isPlusActive);
      })
      .catch((error: unknown) => {
        console.warn('Failed to check premium access state:', error);
        enterMonthlyReportOrPrompt(premiumAccessState.isPlusActive);
      });
  }

  /**
   * Plus状態と先月データの有無に応じて、月次レポート遷移・ペイウォール・集計中案内を出し分ける。
   *
   * @param isPlusActive - Strollia Plusが有効かどうか。
   * @returns なし。
   */
  function enterMonthlyReportOrPrompt(isPlusActive: boolean): void {
    if (!isPlusActive) {
      openPremiumPaywall();
      return;
    }

    const previousMonthReport = createMonthlyReport(dailyLogs, points, getPreviousReportMonth());
    if (!hasMonthlyReportData(previousMonthReport)) {
      Alert.alert('現在集計中です！', '来月になったらもう一度来てください！');
      return;
    }

    refreshAchievementState().catch(() => undefined);
    navigateToScreen('monthlyReport');
  }

  /** 設定画面へ移動する。 */
  function openSettings(): void {
    navigateToScreen('settings');
  }

  /** 設定画面から初回チュートリアルを再表示する。 */
  function openFirstLaunchTutorial(): void {
    triggerSelectionHaptic();
    setFirstLaunchTutorialMode('replay');
    setIsFirstLaunchTutorialVisible(true);
  }

  /** 設定画面から法務ページを端末のブラウザで開く。 */
  function openLegalLink(url: string): void {
    Linking.openURL(url).catch((error: unknown) => {
      console.warn('Failed to open legal link:', error);
    });
  }

  /**
   * 標準地図とラベル付き航空写真を切り替える。
   *
   * @returns なし。
   */
  function toggleMapType(): void {
    triggerSelectionHaptic();
    setMapType(getNextMapType);
  }


  /** 実績解除モーダルを閉じ、次の未表示実績があれば続けて表示する。 */
  function closeAchievementUnlockModal(): void {
    const current = activeAchievementNotification;

    if (!current) {
      return;
    }

    const hasPendingAfterClose = pendingAchievementNotifications.length > 1;

    dismissedAchievementQueueIdsRef.current.add(current.queueId);
    markAchievementShownInApp(current.queueId).catch(() => undefined);
    setPendingAchievementNotifications((notifications) => notifications.slice(1));

    if (
      shouldRequestReviewAfterAchievement({
        dismissedAchievementId: current.definition.id,
        hasPendingNotifications: hasPendingAfterClose,
        hasAlreadyPrompted: hasPromptedReview,
      })
    ) {
      setHasPromptedReview(true);
      setSetting(REVIEW_PROMPTED_SETTING_KEY, true).catch((error: unknown) => {
        console.warn('Failed to persist review prompted flag:', error);
      });
      // ダイアログ退場アニメーション（約500ms）と被らないよう少し遅らせて要求する。
      setTimeout(() => {
        requestStoreReview().catch((error: unknown) => {
          console.warn('Failed to request store review:', error);
        });
      }, 700);
    }
  }

  /** OS標準共有シートへ実績共有文言を渡す。 */
  function shareAchievementToX(achievement: AchievementDefinition): void {
    triggerSelectionHaptic();
    Share.share({ message: achievement.shareText }).catch((error: unknown) => {
      Alert.alert('共有失敗', error instanceof Error ? error.message : '共有シートを開けませんでした。');
    });
  }

  /** GPXファイルを選択し、既存データ優先で端末内DBへ取り込む。 */
  async function importGpx(): Promise<void> {
    if (isImportingGpxRef.current) {
      return;
    }

    triggerSelectionHaptic();
    isImportingGpxRef.current = true;
    setIsImportingGpx(true);

    try {
      Alert.alert(
        'GPXインポートと実績について',
        'GPXインポートでは、総移動距離や記録日数など一部の実績だけが判定対象になります。訪問した地域など、実際の記録中に確認する実績には反映されません。',
      );
      const pickedFile = await pickAndReadGpxFile();

      if (!pickedFile) {
        return;
      }

      const pointsToImport = parseGpxToLocationPoints(pickedFile.content);

      if (pointsToImport.length === 0) {
        Alert.alert('GPXインポート', '取り込めるGPSポイントがありませんでした。');
        return;
      }

      const result = await importLocationPointsFromGpx(pointsToImport, pickedFile.fileName);
      await refreshData();
      Alert.alert('GPXインポート完了', `${result.importedPointCount}件を取り込みました。${result.skippedPointCount}件は既存データを優先してスキップしました。`);
    } catch (error: unknown) {
      console.warn('GPX import failed:', error);
      Alert.alert('GPXインポート失敗', error instanceof Error ? error.message : 'GPXインポートに失敗しました。');
    } finally {
      isImportingGpxRef.current = false;
      setIsImportingGpx(false);
    }
  }

  /**
   * アプリカラープリセットを保存して即時反映する。
   *
   * @param presetId - 保存するプリセットID。
   * @returns なし。
   */
  function updateAppColorPreset(presetId: AppColorPresetId): void {
    triggerSelectionHaptic();
    setSelectedAppColorPresetId(presetId);
    setSetting(APP_COLOR_PRESET_SETTING_KEY, presetId).catch((error: unknown) => {
      Alert.alert('設定保存失敗', error instanceof Error ? error.message : 'アプリカラーを保存できませんでした。');
    });
  }

  /**
   * フォトライブラリからカスタムアイコン画像を選択して保存する。
   * システムの正方形クロップUIを使用する。
   */
  async function pickCustomIcon(): Promise<void> {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('権限が必要です', 'カスタムアイコンを設定するには写真へのアクセス権限が必要です。');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (result.canceled) {
        return;
      }

      const uri = result.assets[0].uri;
      setCustomIconImageUri(uri);
      setSelectedUserLocationIconId('custom');
      setSetting(CUSTOM_ICON_IMAGE_URI_SETTING_KEY, uri).catch((error: unknown) => {
        Alert.alert('設定保存失敗', error instanceof Error ? error.message : 'カスタムアイコンを保存できませんでした。');
      });
      setSetting(USER_LOCATION_ICON_SETTING_KEY, 'custom').catch((error: unknown) => {
        Alert.alert('設定保存失敗', error instanceof Error ? error.message : '現在地アイコンを保存できませんでした。');
      });
      Alert.alert('カスタムアイコン', '写真をアルバムから削除するとOS標準に戻ります。');
    } catch (error: unknown) {
      Alert.alert('エラー', error instanceof Error ? error.message : 'カスタムアイコンを設定できませんでした。');
    }
  }

  /**
   * カスタムアイコン画像をクリアしてOS標準へ戻す。
   * 画像URIが無効になった場合（フォトライブラリから削除など）に呼ばれる。
   *
   * @returns なし。
   */
  function clearCustomIcon(): void {
    setCustomIconImageUri(null);
    setSelectedUserLocationIconId(DEFAULT_USER_LOCATION_ICON_ID);
    setSetting(CUSTOM_ICON_IMAGE_URI_SETTING_KEY, '').catch((error: unknown) => {
      console.warn('Failed to clear custom icon URI:', error);
    });
    setSetting(USER_LOCATION_ICON_SETTING_KEY, DEFAULT_USER_LOCATION_ICON_ID).catch((error: unknown) => {
      console.warn('Failed to reset icon setting:', error);
    });
  }

  /**
   * 現在地アイコンを保存して地図へ即時反映する。
   *
   * @param iconId - 保存する現在地アイコンID。
   * @returns なし。
   */
  function updateUserLocationIcon(iconId: UserLocationIconId): void {
    const option = getUserLocationIconOption(iconId);

    if (option.premium && !premiumAccessState.isPlusActive) {
      showPremiumLockedMessage(option.label);
      return;
    }

    if (iconId === 'custom') {
      pickCustomIcon().catch((error: unknown) => {
        console.warn('pickCustomIcon failed:', error);
      });
      return;
    }

    triggerSelectionHaptic();
    setSelectedUserLocationIconId(option.id);
    setSetting(USER_LOCATION_ICON_SETTING_KEY, option.id).catch((error: unknown) => {
      Alert.alert('設定保存失敗', error instanceof Error ? error.message : '現在地アイコンを保存できませんでした。');
    });
  }

  /** 設定画面からRevenueCat Packageを直接購入し、Plus状態を更新する。 */
  async function purchasePremiumPackageFromSettings(plan: PremiumPackagePlan): Promise<void> {
    if (isPurchasingPremiumPackageRef.current) {
      return;
    }

    isPurchasingPremiumPackageRef.current = true;
    triggerSelectionHaptic();
    setIsPurchasingPremiumPackage(true);

    try {
      const result = await purchasePremiumPackage(plan);
      setPremiumAccessState(result.accessState);

      if (result.status === 'purchased' && result.accessState.isPlusActive) {
        Alert.alert('Strollia Plus', 'Plus特典が有効になりました。');
        closePremiumPaywall();
      } else if (result.status === 'error') {
        Alert.alert('Strollia Plus', '購入を完了できませんでした。RevenueCatとストア設定を確認してください。');
      }
    } finally {
      isPurchasingPremiumPackageRef.current = false;
      setIsPurchasingPremiumPackage(false);
    }
  }

  /** App StoreまたはGoogle Playの購入をRevenueCat経由で復元する。 */
  async function restorePurchasesFromSettings(): Promise<void> {
    if (isRestoringPremiumPurchases) {
      return;
    }

    triggerSelectionHaptic();
    setIsRestoringPremiumPurchases(true);

    try {
      const restoredState = await restorePremiumPurchases();
      setPremiumAccessState(restoredState);
      Alert.alert('購入の復元', restoredState.isPlusActive ? 'Strollia Plusを復元しました。' : '復元できるStrollia Plus購入は見つかりませんでした。');
      if (restoredState.isPlusActive) {
        closePremiumPaywall();
      }
    } finally {
      setIsRestoringPremiumPurchases(false);
    }
  }

  /** RevenueCat Customer Centerを表示する。 */
  async function openPremiumCustomerCenter(): Promise<void> {
    if (isPresentingPremiumCustomerCenterRef.current) {
      return;
    }

    isPresentingPremiumCustomerCenterRef.current = true;
    triggerSelectionHaptic();
    setIsPresentingPremiumCustomerCenter(true);

    try {
      const didPresent = await presentPremiumCustomerCenter();

      if (!didPresent) {
        Alert.alert('Strollia Plus', 'サブスク管理画面を表示できませんでした。RevenueCatとストア設定を確認してください。');
      }
    } finally {
      isPresentingPremiumCustomerCenterRef.current = false;
      setIsPresentingPremiumCustomerCenter(false);
    }
  }

  function openPremiumPaywall(): void {
    if (isPremiumPaywallVisibleRef.current) {
      return;
    }
    isPremiumPaywallVisibleRef.current = true;
    setIsPremiumPaywallVisible(true);
  }

  function closePremiumPaywall(): void {
    isPremiumPaywallVisibleRef.current = false;
    setIsPremiumPaywallVisible(false);
  }

  /**
   * Plus未加入時に有料項目を選んだ場合の案内を表示する。
   *
   * @param label - 選択しようとした項目名。
   * @returns なし。
   */
  function showPremiumLockedMessage(label: string): void {
    triggerSelectionHaptic();
    Alert.alert('Strollia Plus限定', `${label}はStrollia Plusで開放できます。設定画面の月払いまたは年払いから加入してください。`);
  }

  /** 初回チュートリアルを閉じ、初回表示時だけ次回以降は表示しないよう保存する。 */
  function completeFirstLaunchTutorial(): void {
    setIsFirstLaunchTutorialVisible(false);
    if (firstLaunchTutorialMode === 'replay') {
      return;
    }

    setSetting(FIRST_LAUNCH_TUTORIAL_COMPLETED_SETTING_KEY, true).catch((error: unknown) => {
      console.warn('Failed to persist first launch tutorial flag:', error);
    });
    requestAchievementNotificationPermissionIfNeeded().catch((error: unknown) => {
      console.warn('Failed to request achievement notification permission:', error);
    });
  }

  /** 実績通知権限要求を同一セッションで重複実行しないよう呼び出す。 */
  async function requestAchievementNotificationPermissionIfNeeded(): Promise<void> {
    if (hasRequestedAchievementNotificationPermissionRef.current) {
      return;
    }

    hasRequestedAchievementNotificationPermissionRef.current = true;
    await requestAchievementNotificationPermissionOnFirstLaunch();
  }


  if (!isReady) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={styles.loadingText}>Strolliaを準備しています...</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style={theme.name === 'dark' ? 'light' : 'dark'} />
      {shouldShowDevelopmentFlagBanner && (
        <SafeAreaView pointerEvents="none" style={styles.developmentFlagBannerContainer}>
          <Text style={styles.developmentFlagBannerText}>開発フラグ有効</Text>
        </SafeAreaView>
      )}
      <Animated.View
        style={[
          styles.screenTransition,
          {
            opacity: screenTransitionOpacity,
            transform: [{ translateY: screenTransitionOpacity.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
          },
        ]}
      >
          {screenMode === 'map' && (
            <MapScreen
              mapRef={mapRef}
              styles={styles}
              theme={theme}
              initialRegion={initialRegion}
              mapType={mapType}
              userLocationIcon={userLocationIcon}
              onCustomIconError={clearCustomIcon}
              isFollowingUserLocation={isFollowingUserLocation}
              userCoordinate={userCoordinate}
              visitedGridCells={visitedGridCells}
              gridOverlayOpacity={gridOverlayOpacity}
              showPhotosOnMap={showPhotosOnMap}
              isUpdatingPhotoSetting={isUpdatingPhotoSetting}
              photoClusters={photoClusters}
              points={points}
              hasRequiredPermission={hasRequiredPermission}
              shouldOpenSettingsForPermission={shouldOpenSettingsForPermission}
              photoErrorMessage={photoErrorMessage}
              isLoadingPhotos={isLoadingPhotos}
              distance={distance}
              todayDistance={todayDistanceMeters}
              currentSpeedKmh={currentSpeedKmh}
              currentAreaLabel={currentAreaLabel}
              recenterButtonOpacity={recenterButtonOpacity}
              onMapReady={handleMapReady}
              onUserLocationChange={handleUserLocationChange}
              onPanDrag={handleMapPanDrag}
              onRegionChangeComplete={handleRegionChangeComplete}
              onPhotoClusterPress={handlePhotoClusterPress}
              onOpenDailyLogs={openDailyLogs}
              onOpenAchievements={openAchievements}
              onOpenMonthlyReport={openMonthlyReport}
              onToggleMapType={toggleMapType}
              onUpdateShowPhotosOnMap={updateShowPhotosOnMap}
              onOpenSettings={openSettings}
              onRequestLocationPermission={requestLocationPermission}
              onRecenterOnUserLocation={recenterOnUserLocation}
            />
          )}
          {screenMode === 'dailyLogs' && (
            <NavigationIndependentTree>
              <NavigationContainer
                onStateChange={(state) => {
                  const route = state?.routes[state.index ?? 0];
                  updateSentryScreenContext(route ? `DailyLogs:${route.name}` : 'DailyLogList');
                }}
              >
                <DailyLogStack.Navigator
                  initialRouteName="DailyLogList"
                  screenOptions={{
                    animation: 'slide_from_right',
                    gestureEnabled: true,
                    headerShown: false,
                  }}
                >
                  <DailyLogStack.Screen name="DailyLogList">
                    {({ navigation }) => (
                      <DailyLogsScreen
                        dailyLogs={dailyLogs}
                        styles={styles}
                        theme={theme}
                        onBackToMap={openMap}
                        onOpenDailyLogDetail={(log) => navigation.navigate('DailyLogDetail', { log })}
                      />
                    )}
                  </DailyLogStack.Screen>
                  <DailyLogStack.Screen name="DailyLogDetail">
                    {({ navigation, route }) => (
                      <DailyLogDetailScreen
                        log={route.params.log}
                        styles={styles}
                        theme={theme}
                        premiumAccessState={premiumAccessState}
                        onBackToDailyLogs={() => navigation.goBack()}
                        onOpenPremiumPaywall={openPremiumPaywall}
                      />
                    )}
                  </DailyLogStack.Screen>
                </DailyLogStack.Navigator>
              </NavigationContainer>
            </NavigationIndependentTree>
          )}
          {screenMode === 'achievements' && (
            <AchievementListScreen
              items={achievementItems}
              styles={styles}
              theme={theme}
              onBackToMap={openMap}
              onSelectAchievement={setSelectedAchievement}
            />
          )}
          {screenMode === 'monthlyReport' && <MonthlyReportScreen dailyLogs={dailyLogs} points={points} achievements={achievementItems} monthlyAreaReport={monthlyAreaReport} theme={theme} onBackToMap={openMap} />}
          {screenMode === 'settings' && (
            <NavigationIndependentTree>
              <NavigationContainer
                onStateChange={(state) => {
                  const route = state?.routes[state.index ?? 0];
                  updateSentryScreenContext(route ? `Settings:${route.name}` : 'SettingsHome');
                }}
              >
                <SettingsStack.Navigator
                  initialRouteName="SettingsHome"
                  screenOptions={{
                    animation: 'slide_from_right',
                    gestureEnabled: true,
                    headerShown: false,
                  }}
                >
                  <SettingsStack.Screen name="SettingsHome">
                    {({ navigation }) => (
                      <SettingsScreen
                        styles={styles}
                        theme={theme}
                        isRecording={isRecording}
                        autoStartStatus={autoStartStatus}
                        hasRequiredPermission={hasRequiredPermission}
                        shouldOpenSettingsForPermission={shouldOpenSettingsForPermission}
                        keepScreenAwake={keepScreenAwake}
                        mapType={mapType}
                        showPhotosOnMap={showPhotosOnMap}
                        isUpdatingPhotoSetting={isUpdatingPhotoSetting}
                        isImportingGpx={isImportingGpx}
                        premiumAccessState={premiumAccessState}
                        revenueCatAppUserId={revenueCatAppUserId}
                        premiumOfferingSummary={premiumOfferingSummary}
                        isLoadingPremiumOffering={isLoadingPremiumOffering}
                        isPurchasingPremiumPackage={isPurchasingPremiumPackage}
                        isPresentingPremiumCustomerCenter={isPresentingPremiumCustomerCenter}
                        isRestoringPremiumPurchases={isRestoringPremiumPurchases}
                        selectedUserLocationIconId={selectedUserLocationIconId}
                        onBackToMap={openMap}
                        onStartRecording={() => startRecording('manual')}
                        onRequestLocationPermission={requestLocationPermission}
                        onUpdateKeepScreenAwake={updateKeepScreenAwake}
                        onToggleMapType={toggleMapType}
                        onUpdateShowPhotosOnMap={updateShowPhotosOnMap}
                        selectedAppColorPresetId={selectedAppColorPresetId}
                        onUpdateAppColorPreset={updateAppColorPreset}
                        onUpdateUserLocationIcon={updateUserLocationIcon}
                        onOpenAboutAppScreen={() => navigation.navigate('AboutApp')}
                        onOpenFirstLaunchTutorial={openFirstLaunchTutorial}
                        onOpenLicenseScreen={() => navigation.navigate('LicenseList')}
                        onOpenTermsOfService={() => openLegalLink(TERMS_OF_SERVICE_URL)}
                        onOpenPrivacyPolicy={() => openLegalLink(PRIVACY_POLICY_URL)}
                        onOpenSpecifiedCommercialTransactionAct={() => openLegalLink(SPECIFIED_COMMERCIAL_TRANSACTION_ACT_URL)}
                        onPurchaseMonthlyPremiumPackage={() => {
                          purchasePremiumPackageFromSettings('monthly').catch((error: unknown) => {
                            console.warn('Failed to purchase monthly premium package:', error);
                          });
                        }}
                        onPurchaseYearlyPremiumPackage={() => {
                          purchasePremiumPackageFromSettings('yearly').catch((error: unknown) => {
                            console.warn('Failed to purchase yearly premium package:', error);
                          });
                        }}
                        onPresentPremiumCustomerCenter={() => {
                          openPremiumCustomerCenter().catch((error: unknown) => {
                            console.warn('Failed to open premium customer center:', error);
                          });
                        }}
                        onRestorePremiumPurchases={() => {
                          restorePurchasesFromSettings().catch((error: unknown) => {
                            console.warn('Failed to restore premium purchases:', error);
                          });
                        }}
                        onExportAllLogs={exportAllLogs}
                        onImportGpx={importGpx}
                        onDeleteAllData={deleteAllData}
                      />
                    )}
                  </SettingsStack.Screen>
                  <SettingsStack.Screen name="AboutApp">
                    {({ navigation }) => (
                      <AboutAppScreen
                        styles={styles}
                        theme={theme}
                        onBackToSettings={() => navigation.goBack()}
                      />
                    )}
                  </SettingsStack.Screen>
                  <SettingsStack.Screen name="LicenseList">
                    {({ navigation }) => (
                      <LicenseScreen
                        styles={styles}
                        theme={theme}
                        onBackToSettings={() => navigation.goBack()}
                        onOpenLicenseDetail={(license) => navigation.navigate('LicenseDetail', { license })}
                      />
                    )}
                  </SettingsStack.Screen>
                  <SettingsStack.Screen name="LicenseDetail">
                    {({ navigation, route }) => (
                      <LicenseDetailScreen
                        license={route.params.license}
                        styles={styles}
                        theme={theme}
                        onBackToLicenseList={() => navigation.goBack()}
                      />
                    )}
                  </SettingsStack.Screen>
                </SettingsStack.Navigator>
              </NavigationContainer>
            </NavigationIndependentTree>
          )}
      </Animated.View>

      <AchievementUnlockModal
        achievement={activeAchievementNotification?.definition ?? null}
        animationKey={activeAchievementNotification ? `${activeAchievementNotification.queueId}:${activeAchievementNotification.definition.id}` : null}
        styles={styles}
        onShareToX={shareAchievementToX}
        onClose={closeAchievementUnlockModal}
      />

      <AchievementDialog item={selectedAchievement} styles={styles} theme={theme} onClose={() => setSelectedAchievement(null)} />

      <PremiumPaywallModal
        visible={isPremiumPaywallVisible}
        styles={styles}
        theme={theme}
        premiumOfferingSummary={premiumOfferingSummary}
        isLoadingPremiumOffering={isLoadingPremiumOffering}
        isPurchasingPremiumPackage={isPurchasingPremiumPackage}
        isRestoringPremiumPurchases={isRestoringPremiumPurchases}
        onClose={closePremiumPaywall}
        onPurchaseMonthlyPremiumPackage={() => {
          purchasePremiumPackageFromSettings('monthly').catch((error: unknown) => {
            console.warn('purchasePremiumPackageFromSettings (monthly) failed:', error);
          });
        }}
        onPurchaseYearlyPremiumPackage={() => {
          purchasePremiumPackageFromSettings('yearly').catch((error: unknown) => {
            console.warn('purchasePremiumPackageFromSettings (yearly) failed:', error);
          });
        }}
        onRestorePremiumPurchases={() => {
          restorePurchasesFromSettings().catch((error: unknown) => {
            console.warn('restorePurchasesFromSettings failed:', error);
          });
        }}
      />

      <FirstLaunchTutorialDialog
        visible={isFirstLaunchTutorialVisible}
        styles={styles}
        completionButtonLabel={firstLaunchTutorialMode === 'replay' ? '閉じる' : '地図で確認する'}
        onComplete={completeFirstLaunchTutorial}
      />

      <PhotoPreviewModals
        selectedPhotoCluster={selectedPhotoCluster}
        selectedPhotoClusterPages={selectedPhotoClusterPages}
        selectedPhoto={selectedPhoto}
        styles={styles}
        onSelectPhotoCluster={setSelectedPhotoCluster}
        onSelectPhoto={setSelectedPhoto}
      />
    </View>
  );
}
