import * as Application from 'expo-application';
import * as Haptics from 'expo-haptics';
import { NavigationContainer, NavigationIndependentTree } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Animated, SafeAreaView, Text, useColorScheme, View, Share } from 'react-native';

import { initializeDatabase } from '@/db/database';
import { AchievementDefinition } from '@/features/achievements/achievementDefinitions';
import { hasEnabledDevelopmentFlags, shouldResetAchievementsOnLaunch } from '@/config/developmentFlags';
import { PRIVACY_POLICY_URL, SPECIFIED_COMMERCIAL_TRANSACTION_ACT_URL, TERMS_OF_SERVICE_URL } from '@/config/legalLinks';
import { updateSentryScreenContext, updateSentrySubscriptionContext, updateSentryUserContext } from '@/config/sentry';
import {
  initializeAchievementNotificationHandler,
  requestAchievementNotificationPermissionOnFirstLaunch,
  setupAchievementNotificationChannel,
} from '@/features/achievements/achievementNotificationService';
import { setupMonthlyReportNotificationChannel, syncMonthlyReportNotification } from '@/features/reports/monthlyReportNotificationService';
import {
  AchievementListItem,
  PendingAchievementNotification,
  getAchievementListItems,
  getPendingInAppAchievementNotifications,
  markAchievementShownInApp,
} from '@/features/achievements/achievementRepository';
import { canEvaluateAchievementsInForeground } from '@/features/achievements/achievementEvaluationGate';
import { evaluateAchievementsAndNotify } from '@/features/achievements/achievementService';
import { filterDismissedAchievementNotifications } from '@/features/achievements/pendingNotifications';
import { shareGpx } from '@/features/export/gpxExporter';
import { parseGpxToLocationPoints } from '@/features/import/gpxImporter';
import { pickAndReadGpxFile } from '@/features/import/gpxImportService';
import { importLocationPointsFromGpx } from '@/features/import/importRepository';
import {
  isWhileInUseOnlyMode,
  hasRequiredLocationPermission,
  canRequestLocationPermissionInApp,
} from '@/features/location/locationPermission';
import { deleteAllUserData } from '@/features/logs/logRepository';
import { createMonthlyReport, getPreviousReportMonth, hasMonthlyReportData } from '@/features/reports/monthlyReport';
import { resolveUserLocationIcon } from '@/features/customization/customizationResolver';
import { DEFAULT_USER_LOCATION_ICON_ID } from '@/features/customization/customizationOptions';
import { DEFAULT_APP_COLOR_PRESET_ID, getAppColorPreset } from '@/features/customization/colorPresets';
import { getDefaultPremiumAccessState, getConfirmedPremiumAccessState, getPremiumAccessState } from '@/features/premium/revenueCatAccess';
import { resolveInitialPremiumAccess } from '@/features/premium/initialPremiumAccess';
import { getBooleanSetting, getStringSetting, setSetting } from '@/features/settings/settingsRepository';
import { clusterMapPhotos, MapPhotoCluster, paginateMapPhotos } from '@/features/photos/photoClusters';
import type { MapPhoto } from '@/features/photos/photoLibrary';
import { shouldRequestReviewAfterAchievement } from '@/features/review/reviewPromptLogic';
import { requestStoreReview } from '@/features/review/storeReview';
import { DailyLogSummary } from '@/types/gps';
import { toLocalDate } from '@/utils/date';
import { loadAppFonts } from '@/theme/fonts';
import { getAppTheme, applyColorPreset } from '@/theme/theme';
import { createStyles } from './appStyles';
import { ScreenMode } from './appTypes';
import { AchievementDialog } from './components/AchievementDialog';
import { AchievementListScreen } from './components/AchievementListScreen';
import { AboutAppScreen } from './components/AboutAppScreen';
import { FaqScreen } from './components/FaqScreen';
import { DailyLogDetailScreen } from './components/DailyLogDetailScreen';
import { DailyLogsScreen } from './components/DailyLogsScreen';
import { AchievementUnlockModal } from './components/AchievementUnlockModal';
import { FirstLaunchTutorialDialog } from './components/FirstLaunchTutorialDialog';
import { LicenseDetailScreen, LicenseScreen } from './components/LicenseScreen';
import type { OssLicenseEntry } from './generated/ossLicenses';
import { GpxImportProgressDialog } from './components/GpxImportProgressDialog';
import { MapScreen } from './components/MapScreen';
import { PhotoPreviewModals } from './components/PhotoPreviewModals';
import { PremiumPaywallModal } from './components/PremiumPaywallModal';
import { MonthlyReportScreen } from './components/reports/MonthlyReportScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { TopToast } from './components/TopToast';
import { useAchievementDialogEffects } from './hooks/useAchievementDialogEffects';
import { useAnimatedBooleanOpacity } from './hooks/useAnimatedBooleanOpacity';
import { useAutoFitInitialRoute } from './hooks/useAutoFitInitialRoute';
import { useForegroundUserLocation } from './hooks/useForegroundUserLocation';
import { useKeepScreenAwake } from './hooks/useKeepScreenAwake';
import { useMapRouteState } from './hooks/useMapRouteState';
import { useScreenTransitionOpacity } from './hooks/useScreenTransitionOpacity';
import { useCurrentAreaLabel } from './hooks/useCurrentAreaName';
import { usePremiumAccess } from './hooks/usePremiumAccess';
import { useVisitedGridOverlay } from './hooks/useVisitedGridOverlay';
import { useMonthlyReportNotificationResponse } from './hooks/useMonthlyReportNotificationResponse';
import {
  useUserLocationIconSetting,
  USER_LOCATION_ICON_SETTING_KEY,
  APP_COLOR_PRESET_SETTING_KEY,
  CUSTOM_ICON_IMAGE_URI_SETTING_KEY,
} from './hooks/useUserLocationIconSetting';
import { useMapFollowState } from './hooks/useMapFollowState';
import {
  usePhotoMapCrashBreaker,
  SHOW_PHOTOS_ON_MAP_SETTING_KEY,
  SHOW_PHOTOS_ON_MAP_ENABLE_PENDING_SETTING_KEY,
} from './hooks/usePhotoMapCrashBreaker';
import { DELETE_ALL_DATA_SUCCESS_MESSAGE, refreshDeletedUserDataState } from './deleteAllDataFlow';
import { resolveSentryScreenName } from './sentryScreen';
import { useLocationRecordingSync } from './hooks/useLocationRecordingSync';

/** expo-keep-awakeでこの画面のロック抑止を識別するタグ。 */
const KEEP_AWAKE_TAG = 'strollia-foreground-map';
/** 画面ON維持設定をSQLiteへ保存するキー。 */
const KEEP_SCREEN_AWAKE_SETTING_KEY = 'keepScreenAwake';
/** 初回起動チュートリアル完了状態をSQLiteへ保存するキー。 */
const FIRST_LAUNCH_TUTORIAL_COMPLETED_SETTING_KEY = 'firstLaunchTutorialCompleted';
const REVIEW_PROMPTED_SETTING_KEY = 'reviewPrompted';
/** 画面切り替えのちらつきを抑えるフェード時間。 */
const SCREEN_TRANSITION_DURATION_MS = 180;

type SettingsStackParamList = {
  SettingsHome: undefined;
  AboutApp: undefined;
  Faq: undefined;
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

/** Strolliaの画面状態、地図表示、端末API連携を束ねるルートコンポーネント。 */
export default function App() {
  const colorScheme = useColorScheme();
  const {
    premiumAccessState,
    setPremiumAccessState,
    isPremiumAccessPendingForIcon,
    revenueCatAppUserId,
    premiumOfferingSummary,
    isLoadingPremiumOffering,
    isPurchasingPremiumPackage,
    isPresentingPremiumCustomerCenter,
    isRestoringPremiumPurchases,
    isPremiumPaywallVisible,
    snapshotPremiumAccessUpdateVersion,
    initializePremiumAccess,
    purchasePremiumPackageFromSettings,
    restorePurchasesFromSettings,
    openPremiumCustomerCenter,
    openPremiumPaywall,
    closePremiumPaywall,
    showPremiumLockedMessage,
  } = usePremiumAccess();
  const {
    selectedAppColorPresetId,
    selectedUserLocationIconId,
    customIconImageUri,
    hasCustomIconImageLoadFailed,
    applySavedIconSettings,
    updateAppColorPreset,
    handleCustomIconLoadError,
    updateUserLocationIcon,
  } = useUserLocationIconSetting();
  const theme = useMemo(() => {
    const rawTheme = getAppTheme(colorScheme);
    const preset = premiumAccessState.isPlusActive
      ? getAppColorPreset(selectedAppColorPresetId)
      : getAppColorPreset(DEFAULT_APP_COLOR_PRESET_ID);
    return applyColorPreset(rawTheme, preset);
  }, [colorScheme, premiumAccessState.isPlusActive, selectedAppColorPresetId]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isImportingGpxRef = useRef(false);
  const isAchievementDialogVisibleRef = useRef(false);
  const wasAchievementEvaluationPausedRef = useRef(false);
  /** useMapFollowState の centerOnCoordinate から呼ぶ incrementVisitedGridRefreshVersion の参照。 */
  const incrementVisitedGridRefreshVersionRef = useRef<() => void>(() => undefined);
  /**
   * useLocationRecordingSync へ渡す evaluateAchievementsIfDialogIdle の参照。
   * フック呼び出し順序の循環を避けるため ref 経由で渡す。
   */
  const evaluateAchievementsIfDialogIdleRef = useRef<() => Promise<boolean>>(() => Promise.resolve(false));
  /**
   * useLocationRecordingSync へ渡す refreshAchievementState の参照。
   * フック呼び出し順序の循環を避けるため ref 経由で渡す。
   */
  const refreshAchievementStateRef = useRef<(showPendingNotifications?: boolean, options?: { signal?: AbortSignal }) => Promise<void>>(() =>
    Promise.resolve(),
  );
  const [isReady, setIsReady] = useState(false);
  const [screenMode, setScreenMode] = useState<ScreenMode>('map');
  const [selectedAchievement, setSelectedAchievement] = useState<AchievementListItem | null>(null);
  const [keepScreenAwake, setKeepScreenAwake] = useState(false);
  const [isImportingGpx, setIsImportingGpx] = useState(false);
  const [isProcessingGpxImport, setIsProcessingGpxImport] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<MapPhoto | null>(null);
  const [achievementItems, setAchievementItems] = useState<AchievementListItem[]>([]);
  const [pendingAchievementNotifications, setPendingAchievementNotifications] = useState<PendingAchievementNotification[]>([]);
  const [selectedPhotoCluster, setSelectedPhotoCluster] = useState<MapPhotoCluster | null>(null);
  const [dailyLogsSentryScreenName, setDailyLogsSentryScreenName] = useState('DailyLogs:DailyLogList');
  const [settingsSentryScreenName, setSettingsSentryScreenName] = useState('Settings:SettingsHome');
  const [hasPromptedReview, setHasPromptedReview] = useState(false);
  const [isFirstLaunchTutorialVisible, setIsFirstLaunchTutorialVisible] = useState(false);
  const [firstLaunchTutorialMode, setFirstLaunchTutorialMode] = useState<FirstLaunchTutorialMode>('firstLaunch');
  const hasRequestedAchievementNotificationPermissionRef = useRef(false);
  /** 閉じた直後のDB再取得で同じ解除演出が戻ることを防ぐためのセッション内ガード。 */
  const dismissedAchievementQueueIdsRef = useRef(new Set<number>());

  // useLocationRecordingSync に渡す安定したコールバックラッパー。
  // ref 経由で実装しているため空 deps で問題ない。
  // これらを useCallback で安定化しないと deps 変化で refreshData が毎レンダーで再生成され
  // effect が無限ループする。
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ref経由のため空deps で安定化
  const stableIncrementVisitedGridRefreshVersion = useCallback(() => incrementVisitedGridRefreshVersionRef.current(), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ref経由のため空deps で安定化
  const stableEvaluateAchievementsIfDialogIdle = useCallback(() => evaluateAchievementsIfDialogIdleRef.current(), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ref経由のため空deps で安定化
  const stableRefreshAchievementState = useCallback(
    (...args: Parameters<typeof refreshAchievementStateRef.current>) => refreshAchievementStateRef.current(...args),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref経由のため空deps で安定化
    [],
  );

  const {
    isRecording,
    autoStartStatus,
    permissionState,
    isLocationRecordingModeSynchronized,
    isWhileInUseToastVisible,
    setIsWhileInUseToastVisible,
    setMessage,
    dailyLogs,
    points,
    monthlyAreaReport,
    appState,
    refreshData,
    startRecording,
    synchronizeLocationRecordingMode,
    requestLocationPermission,
    openLocationSettings,
    refreshDataAndEvaluateAchievementsIfDialogIdle,
  } = useLocationRecordingSync({
    isReady,
    // incrementVisitedGridRefreshVersion は useVisitedGridOverlay より後に確定するが、
    // refreshData の呼び出しは初期化完了後のため、ref 経由で渡す。
    incrementVisitedGridRefreshVersion: stableIncrementVisitedGridRefreshVersion,
    evaluateAchievementsIfDialogIdle: stableEvaluateAchievementsIfDialogIdle,
    refreshAchievementState: stableRefreshAchievementState,
  });
  const { renderRouteCoordinates, initialRegion, distance } = useMapRouteState(points, dailyLogs);
  const userLocationIcon = useMemo(
    () =>
      resolveUserLocationIcon(
        selectedUserLocationIconId,
        premiumAccessState.isPlusActive || isPremiumAccessPendingForIcon,
        hasCustomIconImageLoadFailed ? null : customIconImageUri,
      ),
    [
      customIconImageUri,
      hasCustomIconImageLoadFailed,
      isPremiumAccessPendingForIcon,
      premiumAccessState.isPlusActive,
      selectedUserLocationIconId,
    ],
  );
  const mapFollowState = useMapFollowState({
    screenMode,
    userLocationIcon,
    incrementVisitedGridRefreshVersionRef,
  });
  const {
    mapRef,
    userCoordinate,
    isFollowingUserLocation,
    isMapReady,
    visibleRegion,
    currentSpeedKmh,
    mapType,
    handleUserLocationChange,
    applyUserLocation,
    handleMapPanDrag,
    handleRegionChangeComplete,
    handleRegionChange,
    handleMapReady,
    recenterOnUserLocation,
  } = mapFollowState;
  const gridOverlayRegion = visibleRegion ?? initialRegion;
  const { visitedGridCells, gridOverlayOpacity, incrementVisitedGridRefreshVersion } = useVisitedGridOverlay({
    isReady,
    gridOverlayRegion,
    themePrimaryColor: theme.colors.primary,
  });
  // incrementVisitedGridRefreshVersion を ref に同期。useMapFollowState の centerOnCoordinate から
  // 参照するために使う。ref にすることで useVisitedGridOverlay より前に useMapFollowState を
  // 呼べる（フック呼び出し順序の循環依存を回避するため）。
  incrementVisitedGridRefreshVersionRef.current = incrementVisitedGridRefreshVersion;
  const recenterButtonOpacity = useAnimatedBooleanOpacity(!isFollowingUserLocation, 500);
  const currentAreaLabel = useCurrentAreaLabel({ userCoordinate, appState });
  const screenTransitionOpacity = useScreenTransitionOpacity(screenMode, SCREEN_TRANSITION_DURATION_MS);
  const todayDistanceMeters = useMemo(() => {
    const today = toLocalDate(new Date());
    return dailyLogs.find((log) => log.localDate === today)?.distanceMeters ?? 0;
  }, [dailyLogs]);
  const {
    showPhotosOnMap,
    isUpdatingPhotoSetting,
    photos,
    isLoadingPhotos,
    photoErrorMessage,
    initializePhotoSetting,
    updateShowPhotosOnMap,
  } = usePhotoMapCrashBreaker({ isReady, isMapReady });
  const photoClusters = useMemo(() => clusterMapPhotos(photos, visibleRegion), [photos, visibleRegion]);
  const selectedPhotoClusterPages = useMemo(() => paginateMapPhotos(selectedPhotoCluster?.photos ?? []), [selectedPhotoCluster]);
  const hasRequiredPermission = hasRequiredLocationPermission(permissionState);
  const shouldOpenSettingsForPermission = !canRequestLocationPermissionInApp(permissionState);
  const isWhileInUseRecordingMode = isWhileInUseOnlyMode(permissionState);
  const shouldDisplayCustomLocation = !userLocationIcon.useNativeUserLocation;
  const shouldPersistForegroundLocation = appState === 'active' && isWhileInUseRecordingMode && isLocationRecordingModeSynchronized;
  const foregroundWatchEnabled = appState === 'active' && (shouldDisplayCustomLocation || shouldPersistForegroundLocation);
  const shouldShowDevelopmentFlagBanner = hasEnabledDevelopmentFlags();
  const activeAchievementNotification = pendingAchievementNotifications[0] ?? null;
  /**
   * Sentryへ送る現在画面名を、前面表示を優先して解決する。
   * 日別記録/設定の子画面は各NavigationContainerの状態を `DailyLogs:*` / `Settings:*` として使う。
   */
  const sentryScreenName = useMemo(
    () =>
      resolveSentryScreenName({
        dailyLogsScreenName: dailyLogsSentryScreenName,
        firstLaunchTutorialMode,
        isFirstLaunchTutorialVisible,
        isPhotoPreviewVisible: Boolean(selectedPhoto || selectedPhotoCluster),
        isPremiumPaywallVisible,
        screenMode,
        settingsScreenName: settingsSentryScreenName,
      }),
    [
      dailyLogsSentryScreenName,
      firstLaunchTutorialMode,
      isFirstLaunchTutorialVisible,
      isPremiumPaywallVisible,
      screenMode,
      selectedPhoto,
      selectedPhotoCluster,
      settingsSentryScreenName,
    ],
  );

  /**
   * RevenueCat App User IDをSentryのユーザーコンテキストへ反映する。
   * クラッシュレポートをSupport IDで問い合わせられるようにするために必要。
   */
  useEffect(() => {
    updateSentryUserContext(revenueCatAppUserId);
  }, [revenueCatAppUserId]);

  /**
   * Plus加入状態をSentryへ反映する。
   * 課金状態に依存する画面や機能で発生した問題を切り分けやすくするために必要。
   */
  useEffect(() => {
    updateSentrySubscriptionContext(premiumAccessState);
  }, [premiumAccessState]);

  /**
   * 現在画面名をSentryへ反映する。
   * どの画面で例外が起きたかをStackTrace以外からも追えるようにするために必要。
   */
  useEffect(() => {
    updateSentryScreenContext(sentryScreenName);
  }, [sentryScreenName]);

  /** 実績一覧と未表示の解除演出キューを再読み込みする。 */
  const refreshAchievementState = useCallback(
    async (showPendingNotifications = false, options: { signal?: AbortSignal } = {}): Promise<void> => {
      const { signal } = options;
      const [items, pendingNotifications] = await Promise.all([
        getAchievementListItems(),
        showPendingNotifications ? getPendingInAppAchievementNotifications() : Promise.resolve([]),
      ]);

      if (signal?.aborted) return;

      setAchievementItems(items);

      if (showPendingNotifications) {
        setPendingAchievementNotifications(
          filterDismissedAchievementNotifications(pendingNotifications, dismissedAchievementQueueIdsRef.current),
        );
      }
    },
    [],
  );

  /**
   * 実績解除ダイアログが出ていない時だけ実績を評価する。
   * useLocationRecordingSync へ ref 経由で渡すためここで定義する。
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

  // useLocationRecordingSync へ ref 経由で関数を渡す。
  // フック呼び出し順序の循環を避けるため ref に同期する。
  evaluateAchievementsIfDialogIdleRef.current = evaluateAchievementsIfDialogIdle;
  refreshAchievementStateRef.current = refreshAchievementState;

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
  }, [refreshAchievementState, refreshData, setMessage]);

  /** 画面ON維持設定をUI状態とSQLiteの両方へ反映する。 */
  const updateKeepScreenAwake = useCallback(async (enabled: boolean): Promise<void> => {
    setKeepScreenAwake(enabled);
    await setSetting(KEEP_SCREEN_AWAKE_SETTING_KEY, enabled);
  }, []);

  /**
   * 初回起動時にDBと永続設定を読み込み、アプリを描画可能な状態へ進める。
   */
  useEffect(() => {
    const initializationController = new AbortController();
    const { signal } = initializationController;
    const initialPremiumAccessUpdateVersion = snapshotPremiumAccessUpdateVersion();
    initializeDatabase()
      .then(async () => {
        await loadAppFonts().catch((error: unknown) => {
          console.warn('Failed to load app fonts:', error);
        });
        if (signal.aborted) return;
        const initialPremiumAccessRequest = getConfirmedPremiumAccessState();
        const [
          savedKeepScreenAwake,
          savedShowPhotosOnMap,
          savedShowPhotosOnMapEnablePending,
          savedUserLocationIcon,
          savedAppColorPresetId,
          savedCustomIconImageUri,
          savedReviewPrompted,
          savedFirstLaunchTutorialCompleted,
          initialPremiumAccessResult,
        ] = await Promise.all([
          getBooleanSetting(KEEP_SCREEN_AWAKE_SETTING_KEY, false),
          getBooleanSetting(SHOW_PHOTOS_ON_MAP_SETTING_KEY, false),
          getBooleanSetting(SHOW_PHOTOS_ON_MAP_ENABLE_PENDING_SETTING_KEY, false),
          getStringSetting(USER_LOCATION_ICON_SETTING_KEY, DEFAULT_USER_LOCATION_ICON_ID),
          getStringSetting(APP_COLOR_PRESET_SETTING_KEY, DEFAULT_APP_COLOR_PRESET_ID),
          getStringSetting(CUSTOM_ICON_IMAGE_URI_SETTING_KEY, ''),
          getBooleanSetting(REVIEW_PROMPTED_SETTING_KEY, false),
          getBooleanSetting(FIRST_LAUNCH_TUTORIAL_COMPLETED_SETTING_KEY, false),
          resolveInitialPremiumAccess(initialPremiumAccessRequest, getDefaultPremiumAccessState(), { signal }),
        ]);
        if (signal.aborted) return;
        setKeepScreenAwake(savedKeepScreenAwake);
        initializePhotoSetting({ savedShowPhotosOnMap, savedShowPhotosOnMapEnablePending });
        if (savedShowPhotosOnMapEnablePending) {
          await setSetting(SHOW_PHOTOS_ON_MAP_SETTING_KEY, false);
          if (signal.aborted) return;
          await setSetting(SHOW_PHOTOS_ON_MAP_ENABLE_PENDING_SETTING_KEY, false);
          if (signal.aborted) return;
          setMessage('前回の写真表示で問題が発生した可能性があるため、写真表示をOFFに戻しました。');
        }
        initializePremiumAccess({
          initialVersion: initialPremiumAccessUpdateVersion,
          initialPremiumAccessRequest,
          result: initialPremiumAccessResult,
          signal,
        });
        await applySavedIconSettings({
          savedUserLocationIcon,
          savedAppColorPresetId,
          savedCustomIconImageUri,
          signal,
        });
        if (signal.aborted) return;
        setHasPromptedReview(savedReviewPrompted);
        initializeAchievementNotificationHandler();
        await setupAchievementNotificationChannel().catch(() => undefined);
        await setupMonthlyReportNotificationChannel().catch(() => undefined);
        if (signal.aborted) return;
        if (savedFirstLaunchTutorialCompleted) {
          await requestAchievementNotificationPermissionIfNeeded();
          if (signal.aborted) return;
          initialPremiumAccessRequest
            .then((state) => {
              if (!signal.aborted) {
                syncMonthlyReportNotification(state.isPlusActive).catch((error: unknown) => {
                  console.warn('Failed to sync monthly report notification after permission:', error);
                });
              }
            })
            .catch(() => undefined);
        }
        const initialState = await refreshData({ signal });
        if (signal.aborted) return;
        if (isWhileInUseOnlyMode(initialState.permissions)) {
          setIsWhileInUseToastVisible(true);
        }
        await synchronizeLocationRecordingMode(initialState, signal);
        if (signal.aborted) return;
        await evaluateAchievementsAndNotify({ resetBeforeEvaluate: shouldResetAchievementsOnLaunch() });
        if (signal.aborted) return;
        await refreshAchievementState(true, { signal });
        if (signal.aborted) return;
        if (!savedFirstLaunchTutorialCompleted) {
          setFirstLaunchTutorialMode('firstLaunch');
          setIsFirstLaunchTutorialVisible(true);
        }
      })
      .catch((error: unknown) => {
        if (signal.aborted) return;
        setMessage(error instanceof Error ? error.message : 'DB初期化に失敗しました。');
      })
      .finally(() => {
        if (!signal.aborted) setIsReady(true);
      });

    return () => {
      initializationController.abort();
    };
  }, [
    applySavedIconSettings,
    initializePremiumAccess,
    initializePhotoSetting,
    refreshAchievementState,
    refreshData,
    setIsWhileInUseToastVisible,
    setMessage,
    snapshotPremiumAccessUpdateVersion,
    synchronizeLocationRecordingMode,
  ]);

  useMonthlyReportNotificationResponse({ isReady, onOpenMonthlyReport: openMonthlyReport });

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
  // カスタムアイコン表示と前景限定記録で1つの位置購読を共有する。
  useForegroundUserLocation({
    enabled: foregroundWatchEnabled,
    shouldPersist: shouldPersistForegroundLocation,
    onLocation: shouldDisplayCustomLocation ? applyUserLocation : undefined,
    onError: (error: unknown) => {
      setMessage(error instanceof Error ? error.message : 'フォアグラウンド位置情報の取得に失敗しました。');
    },
  });

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
    mapFollowState.prepareMapRegionRestore();
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
    mapFollowState.toggleMapType();
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

      // ファイル選択後の取り込み処理中は、削除などの操作を防ぐためブロッキングダイアログを表示する。
      setIsProcessingGpxImport(true);
      // 同期的なパースに入る前に1フレーム譲り、ブロッキングダイアログを確実に描画させる。
      // （パースは同期処理のため、譲らないと大きなGPXでは旧画面のまま固まる）
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      const pointsToImport = parseGpxToLocationPoints(pickedFile.content);

      if (pointsToImport.length === 0) {
        Alert.alert('GPXインポート', '取り込めるGPSポイントがありませんでした。');
        return;
      }

      const result = await importLocationPointsFromGpx(pointsToImport, pickedFile.fileName);
      await refreshData();
      Alert.alert(
        'GPXインポート完了',
        `${result.importedPointCount}件を取り込みました。${result.skippedPointCount}件は既存データを優先してスキップしました。`,
      );
    } catch (error: unknown) {
      console.warn('GPX import failed:', error);
      Alert.alert('GPXインポート失敗', error instanceof Error ? error.message : 'GPXインポートに失敗しました。');
    } finally {
      isImportingGpxRef.current = false;
      setIsImportingGpx(false);
      setIsProcessingGpxImport(false);
    }
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
    requestAchievementNotificationPermissionIfNeeded()
      .then(() => syncMonthlyReportNotification(premiumAccessState.isPlusActive))
      .catch((error: unknown) => {
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
      <TopToast
        visible={isWhileInUseToastVisible}
        message="アプリが起動している場合のみ記録します！"
        theme={theme}
        onHide={() => setIsWhileInUseToastVisible(false)}
      />
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
            onCustomIconError={handleCustomIconLoadError}
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
            isWhileInUseOnlyMode={isWhileInUseRecordingMode}
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
            onRegionChange={handleRegionChange}
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
              // 日別記録スタック内の遷移をSentryの画面コンテキストへ反映する。
              onStateChange={(state) => {
                const route = state?.routes[state.index ?? 0];
                const nextScreenName = route ? `DailyLogs:${route.name}` : 'DailyLogs:DailyLogList';
                setDailyLogsSentryScreenName(nextScreenName);
                updateSentryScreenContext(nextScreenName);
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
        {screenMode === 'monthlyReport' && (
          <MonthlyReportScreen
            dailyLogs={dailyLogs}
            points={points}
            achievements={achievementItems}
            monthlyAreaReport={monthlyAreaReport}
            theme={theme}
            onBackToMap={openMap}
          />
        )}
        {screenMode === 'settings' && (
          <NavigationIndependentTree>
            <NavigationContainer
              // 設定スタック内の遷移をSentryの画面コンテキストへ反映する。
              onStateChange={(state) => {
                const route = state?.routes[state.index ?? 0];
                const nextScreenName = route ? `Settings:${route.name}` : 'Settings:SettingsHome';
                setSettingsSentryScreenName(nextScreenName);
                updateSentryScreenContext(nextScreenName);
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
                      isWhileInUseOnlyMode={isWhileInUseRecordingMode}
                      keepScreenAwake={keepScreenAwake}
                      mapType={mapType}
                      showPhotosOnMap={showPhotosOnMap}
                      isUpdatingPhotoSetting={isUpdatingPhotoSetting}
                      isImportingGpx={isImportingGpx}
                      premiumAccessState={premiumAccessState}
                      revenueCatAppUserId={revenueCatAppUserId}
                      appVersion={Application.nativeApplicationVersion}
                      buildNumber={Application.nativeBuildVersion}
                      premiumOfferingSummary={premiumOfferingSummary}
                      isLoadingPremiumOffering={isLoadingPremiumOffering}
                      isPurchasingPremiumPackage={isPurchasingPremiumPackage}
                      isPresentingPremiumCustomerCenter={isPresentingPremiumCustomerCenter}
                      isRestoringPremiumPurchases={isRestoringPremiumPurchases}
                      selectedUserLocationIconId={selectedUserLocationIconId}
                      onBackToMap={openMap}
                      onStartRecording={() => startRecording('manual')}
                      onRequestLocationPermission={requestLocationPermission}
                      onOpenLocationSettings={openLocationSettings}
                      onUpdateKeepScreenAwake={updateKeepScreenAwake}
                      onToggleMapType={toggleMapType}
                      onUpdateShowPhotosOnMap={updateShowPhotosOnMap}
                      selectedAppColorPresetId={selectedAppColorPresetId}
                      onUpdateAppColorPreset={updateAppColorPreset}
                      onUpdateUserLocationIcon={(iconId) => updateUserLocationIcon(iconId, premiumAccessState, showPremiumLockedMessage)}
                      onOpenAboutAppScreen={() => navigation.navigate('AboutApp')}
                      onOpenFirstLaunchTutorial={openFirstLaunchTutorial}
                      onOpenFaqScreen={() => navigation.navigate('Faq')}
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
                  {({ navigation }) => <AboutAppScreen styles={styles} theme={theme} onBackToSettings={() => navigation.goBack()} />}
                </SettingsStack.Screen>
                <SettingsStack.Screen name="Faq">
                  {({ navigation }) => <FaqScreen styles={styles} theme={theme} onBackToSettings={() => navigation.goBack()} />}
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
        animationKey={
          activeAchievementNotification ? `${activeAchievementNotification.queueId}:${activeAchievementNotification.definition.id}` : null
        }
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
      <GpxImportProgressDialog visible={isProcessingGpxImport} styles={styles} theme={theme} />
    </View>
  );
}
