import * as Application from 'expo-application';
import * as Haptics from 'expo-haptics';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Linking, useColorScheme } from 'react-native';
import type MapView from 'react-native-maps';
import type { LatLng, MapType, Region, UserLocationChangeEvent } from 'react-native-maps';

import {
  updateSentrySubscriptionContext,
  updateSentryUserContext,
  setCrashReportingEnabled as applyCrashReportingToSentry,
} from '@/config/sentry';
import { syncMonthlyReportNotification } from '@/features/reports/monthlyReportNotificationService';
import { shareAllLogsAsGpx } from '@/features/export/gpxExporter';
import { parseGpxToLocationPoints } from '@/features/import/gpxImporter';
import { pickAndReadGpxFile } from '@/features/import/gpxImportService';
import { GpxImportInterruptedError, importLocationPointsFromGpx } from '@/features/import/importRepository';
import type { GpxImportResult } from '@/features/import/importRepository';
import { beginGpxImportPriority } from '@/features/location/gpxImportPriority';
import { flushLocationsBufferedDuringGpxImport } from '@/features/location/locationRecordingSession';
import {
  isWhileInUseOnlyMode,
  hasRequiredLocationPermission,
  canRequestLocationPermissionInApp,
} from '@/features/location/locationPermission';
import { deleteAllUserData, getLocationPointsByMonth } from '@/features/logs/logRepository';
import { createMonthlyReport, formatReportMonth, getPreviousReportMonth, hasMonthlyReportData } from '@/features/reports/monthlyReport';
import { createRegionFromBounds } from '@/features/map/routeMapper';
import { resolveUserLocationIcon } from '@/features/customization/customizationResolver';
import { DEFAULT_APP_COLOR_PRESET_ID, getAppColorPreset } from '@/features/customization/colorPresets';
import { getPremiumAccessState } from '@/features/premium/revenueCatAccess';
import { setSetting } from '@/features/settings/settingsRepository';
import { CRASH_REPORTING_SETTING_KEY } from '@/ui/appText';
import { MapPhotoCluster, paginateMapPhotos } from '@/features/photos/photoClusters';
import type { MapPhoto } from '@/features/photos/photoLibrary';
import type { DailyLogSummary } from '@/types/gps';
import { toLocalDate } from '@/utils/date';
import { getAppTheme, applyColorPreset } from '@/theme/theme';
import type { AppTheme } from '@/theme/theme';
import { createStyles } from '@/ui/appStyles';
import type { AppStyles } from '@/ui/appStyles';
import { ScreenMode } from '@/ui/appTypes';
import { useAchievementDialogEffects } from '@/ui/hooks/useAchievementDialogEffects';
import { useAnimatedBooleanOpacity } from '@/ui/hooks/useAnimatedBooleanOpacity';
import { useAutoFitInitialRoute } from '@/ui/hooks/useAutoFitInitialRoute';
import { useForegroundUserLocation } from '@/ui/hooks/useForegroundUserLocation';
import { useKeepScreenAwake } from '@/ui/hooks/useKeepScreenAwake';
import { useScreenTransitionOpacity } from '@/ui/hooks/useScreenTransitionOpacity';
import { useCurrentAreaLabel } from '@/ui/hooks/useCurrentAreaName';
import { usePremiumAccess } from '@/ui/hooks/usePremiumAccess';
import { useVisitedGridOverlay } from '@/ui/hooks/useVisitedGridOverlay';
import { useMonthlyReportNotificationResponse } from '@/ui/hooks/useMonthlyReportNotificationResponse';
import { useUserLocationIconSetting } from '@/ui/hooks/useUserLocationIconSetting';
import { useMapFollowState } from '@/ui/hooks/useMapFollowState';
import { usePhotoClusters } from '@/ui/hooks/usePhotoClusters';
import { usePhotoMapCrashBreaker } from '@/ui/hooks/usePhotoMapCrashBreaker';
import { DELETE_ALL_DATA_SUCCESS_MESSAGE, refreshDeletedUserDataState } from '@/ui/deleteAllDataFlow';
import { useLocationRecordingSync } from '@/ui/hooks/useLocationRecordingSync';
import { useAchievementState } from '@/ui/hooks/useAchievementState';
import { useAppInitialization } from '@/ui/hooks/useAppInitialization';
import type { PremiumAccessState, PremiumOfferingSummary } from '@/features/premium/revenueCatAccess';
import type { AchievementListItem, PendingAchievementNotification } from '@/features/achievements/achievementRepository';
import type { AchievementDefinition } from '@/features/achievements/achievementDefinitions';
import type { AutoStartStatus } from '@/ui/appTypes';
import type { LocationPermissionState } from '@/features/location/locationPermission';
import type { MonthlyAreaReport } from '@/features/reports/monthlyAreaReport';
import type { LocationPoint } from '@/types/gps';
import type { AreaLabel } from '@/ui/areaName';
import type { ResolvedUserLocationIcon } from '@/features/customization/customizationResolver';
import type { VisitedGridOverlayCell } from '@/features/map/gridOverlay';
import type { RefreshDataResult } from '@/ui/hooks/useLocationRecordingSync';
import type { AppColorPresetId } from '@/features/customization/colorPresets';
import type { UserLocationIconId } from '@/features/customization/customizationOptions';
import { hasEnabledDevelopmentFlags } from '@/config/developmentFlags';

/** expo-keep-awakeでこの画面のロック抑止を識別するタグ。 */
const KEEP_AWAKE_TAG = 'strollia-foreground-map';
/** 画面ON維持設定をSQLiteへ保存するキー。 */
const KEEP_SCREEN_AWAKE_SETTING_KEY = 'keepScreenAwake';
/** 初回起動チュートリアル完了状態をSQLiteへ保存するキー。 */
const FIRST_LAUNCH_TUTORIAL_COMPLETED_SETTING_KEY = 'firstLaunchTutorialCompleted';
/** 画面切り替えのちらつきを抑えるフェード時間。 */
const SCREEN_TRANSITION_DURATION_MS = 180;

/** チュートリアルの表示モード。 */
export type FirstLaunchTutorialMode = 'firstLaunch' | 'replay';

/**
 * AppStateContext が保持する全状態と操作の型。
 *
 * App.tsx の巨大コンポーネントをフック結線層とレンダリング層に分離するための
 * Context 型定義。expo-router 移行時の段階B で導入。
 */
export type AppStateContextValue = {
  // テーマ・スタイル
  /** アプリ全体のテーマ(ライト/ダーク + カラープリセット適用済み)。 */
  theme: AppTheme;
  /** テーマ依存スタイルシート。 */
  styles: AppStyles;

  // 初期化・Ready
  /** アプリ初期化完了フラグ。 */
  isReady: boolean;
  /** 開発フラグが有効かどうか(バナー表示用)。 */
  shouldShowDevelopmentFlagBanner: boolean;

  // 画面状態
  /** 現在表示中の画面モード。 */
  screenMode: ScreenMode;
  /** 画面切り替えフェード用 Animated.Value。 */
  screenTransitionOpacity: Animated.Value;

  // GPS/記録
  /** バックグラウンド記録中かどうか。 */
  isRecording: boolean;
  /** 自動GPS記録開始の状態。 */
  autoStartStatus: AutoStartStatus;
  /** 位置情報権限の現在状態。 */
  permissionState: LocationPermissionState;
  /** 位置情報権限が必要な状態かどうか。 */
  hasRequiredPermission: boolean;
  /** 設定アプリを開いて権限変更が必要かどうか。 */
  shouldOpenSettingsForPermission: boolean;
  /** フォアグラウンド限定記録モードかどうか。 */
  isWhileInUseRecordingMode: boolean;
  /** フォアグラウンド限定モードのToast表示中かどうか。 */
  isWhileInUseToastVisible: boolean;
  /** フォアグラウンド限定モードのToastを非表示にする。 */
  setIsWhileInUseToastVisible: (visible: boolean) => void;
  /** 日別ログの一覧。 */
  dailyLogs: DailyLogSummary[];
  /** GPS記録が1件以上あるか(空状態表示・初期フィットの判定用)。 */
  hasAnyLocationPoints: boolean;
  /** 先月分の月次レポート用GPSポイント(openMonthlyReportで取得)。 */
  monthlyReportPoints: LocationPoint[];
  /** 月次エリアレポート。 */
  monthlyAreaReport: MonthlyAreaReport | null;
  /** データ再取得。 */
  refreshData: (options?: { signal?: AbortSignal }) => Promise<RefreshDataResult>;
  /** 手動で記録を開始する。 */
  startRecording: (trigger: 'manual') => Promise<void>;
  /** 位置情報権限を要求する。 */
  requestLocationPermission: () => Promise<void>;
  /** 位置情報設定を開く。 */
  openLocationSettings: () => Promise<void>;

  // 地図
  /** MapView への ref。 */
  mapRef: React.RefObject<MapView | null>;
  /** 最後に受け取った現在地座標。 */
  userCoordinate: LatLng | null;
  /** 現在地追従中かどうか。 */
  isFollowingUserLocation: boolean;
  /** 地図初期化完了フラグ。 */
  isMapReady: boolean;
  /** 現在の表示可能領域。 */
  visibleRegion: Region | null;
  /** 現在速度(km/h)。 */
  currentSpeedKmh: number;
  /** 地図タイプ(標準/衛星)。 */
  mapType: MapType;
  /** 地図の初期表示領域(起動時・全ルートフィット用)。 */
  initialRegion: Region;
  /** 今日の移動距離(m)。 */
  todayDistanceMeters: number;
  /** 総移動距離(m)。 */
  distance: number;
  /** 現在地エリアラベル。 */
  currentAreaLabel: AreaLabel;
  /** 現在地追従ボタンの表示 Animated.Value。 */
  recenterButtonOpacity: Animated.Value;
  /** ユーザー位置変更イベントハンドラ。 */
  handleUserLocationChange: (event: UserLocationChangeEvent) => void;
  /** 地図パンドラッグハンドラ。 */
  handleMapPanDrag: () => void;
  /** 地図領域変更完了ハンドラ。 */
  handleRegionChangeComplete: (region: Region) => void;
  /** 地図領域変更ハンドラ(Android 向け間引き)。 */
  handleRegionChange: (region: Region) => void;
  /** 地図準備完了ハンドラ。 */
  handleMapReady: () => void;
  /** 現在地へ再センタリングする。 */
  recenterOnUserLocation: () => void;
  /** 地図タイプを切り替える。 */
  toggleMapType: () => void;

  // 訪問グリッド
  /** 訪問済みグリッドセル一覧。 */
  visitedGridCells: VisitedGridOverlayCell[];
  /** グリッドオーバーレイの透明度(0〜1)。 */
  gridOverlayOpacity: number;

  // 写真
  /** 地図上に写真を表示するかどうか。 */
  showPhotosOnMap: boolean;
  /** 写真表示設定の更新中かどうか。 */
  isUpdatingPhotoSetting: boolean;
  /** 地図上に表示する写真クラスタ一覧。 */
  photoClusters: MapPhotoCluster[];
  /** 写真読み込み中かどうか。 */
  isLoadingPhotos: boolean;
  /** 写真取得エラーメッセージ。 */
  photoErrorMessage: string | null;
  /** 写真表示設定を更新する。 */
  updateShowPhotosOnMap: (show: boolean) => Promise<void>;
  /** 選択された写真(単体プレビュー用)。 */
  selectedPhoto: MapPhoto | null;
  /** 選択された写真クラスタ(複数プレビュー用)。 */
  selectedPhotoCluster: MapPhotoCluster | null;
  /** ページ分割済み選択クラスタ写真一覧。 */
  selectedPhotoClusterPages: MapPhoto[][];
  /** 写真クラスタを選択する。 */
  setSelectedPhotoCluster: (cluster: MapPhotoCluster | null) => void;
  /** 写真を選択する。 */
  setSelectedPhoto: (photo: MapPhoto | null) => void;
  /** 写真クラスタタップをハンドルする。 */
  handlePhotoClusterPress: (cluster: MapPhotoCluster) => void;

  // 実績
  /** 選択された実績アイテム(詳細ダイアログ用)。 */
  selectedAchievement: AchievementListItem | null;
  /** 実績アイテムを選択/解除する。 */
  setSelectedAchievement: (item: AchievementListItem | null) => void;
  /** 実績一覧。 */
  achievementItems: AchievementListItem[];
  /** キュー先頭の実績通知(アンロックモーダル用)。 */
  activeAchievementNotification: PendingAchievementNotification | null;
  /** 実績アンロックモーダルを閉じる。 */
  closeAchievementUnlockModal: () => void;
  /** 実績をXへシェアする。 */
  shareAchievementToX: (achievement: AchievementDefinition) => void;

  // プレミアム
  /** プレミアムアクセス状態。 */
  premiumAccessState: PremiumAccessState;
  /** RevenueCat App User ID。 */
  revenueCatAppUserId: string | null;
  /** プレミアムオファリングのサマリー。 */
  premiumOfferingSummary: PremiumOfferingSummary | null;
  /** プレミアムオファリング読み込み中かどうか。 */
  isLoadingPremiumOffering: boolean;
  /** プレミアムパッケージ購入中かどうか。 */
  isPurchasingPremiumPackage: boolean;
  /** プレミアムカスタマーセンター表示中かどうか。 */
  isPresentingPremiumCustomerCenter: boolean;
  /** プレミアム購入復元中かどうか。 */
  isRestoringPremiumPurchases: boolean;
  /** ペイウォール表示中かどうか。 */
  isPremiumPaywallVisible: boolean;
  /** 設定画面からプレミアムパッケージを購入する。 */
  purchasePremiumPackageFromSettings: (period: 'monthly' | 'yearly') => Promise<void>;
  /** 設定画面から購入を復元する。 */
  restorePurchasesFromSettings: () => Promise<void>;
  /** プレミアムカスタマーセンターを開く。 */
  openPremiumCustomerCenter: () => Promise<void>;
  /** ペイウォールを開く。 */
  openPremiumPaywall: () => void;
  /** ペイウォールを閉じる。 */
  closePremiumPaywall: () => void;
  /** プレミアム限定機能ロックメッセージを表示する。 */
  showPremiumLockedMessage: (featureName: string) => void;

  // カスタマイゼーション
  /** 選択されているカラープリセットID。 */
  selectedAppColorPresetId: AppColorPresetId;
  /** 選択されている現在地アイコンID。 */
  selectedUserLocationIconId: UserLocationIconId;
  /** 解決済みユーザー位置アイコン設定。 */
  userLocationIcon: ResolvedUserLocationIcon;
  /** カラープリセットを更新する。 */
  updateAppColorPreset: (presetId: AppColorPresetId) => void;
  /** カスタムアイコン読み込みエラーハンドラ。 */
  handleCustomIconLoadError: () => void;
  /** ユーザー位置アイコンを更新する。 */
  updateUserLocationIcon: (
    iconId: UserLocationIconId,
    premiumAccessState: PremiumAccessState,
    showPremiumLockedMessage: (label: string) => void,
  ) => void;

  // 設定
  /** 画面ON維持が有効かどうか。 */
  keepScreenAwake: boolean;
  /** 画面ON維持を更新する。 */
  updateKeepScreenAwake: (enabled: boolean) => Promise<void>;
  /** 不具合レポートを送信するか。 */
  crashReportingEnabled: boolean;
  /** 不具合レポート送信設定を更新する。 */
  updateCrashReportingEnabled: (enabled: boolean) => Promise<void>;
  /** データをエクスポートする。 */
  exportAllLogs: () => Promise<void>;
  /** GPXをインポートする。 */
  importGpx: () => Promise<void>;
  /** 全データを削除する。 */
  deleteAllData: () => Promise<void>;
  /** 法的リンクをブラウザで開く。 */
  openLegalLink: (url: string) => void;
  /** GPXインポート中かどうか(ファイル選択開始後)。 */
  isImportingGpx: boolean;
  /** GPX処理中かどうか(ブロッキングダイアログ表示用)。 */
  isProcessingGpxImport: boolean;
  /** アプリバージョン文字列。 */
  appVersion: string | null;
  /** ビルド番号文字列。 */
  buildNumber: string | null;

  // チュートリアル
  /** 初回チュートリアル表示中かどうか。 */
  isFirstLaunchTutorialVisible: boolean;
  /** チュートリアルの表示モード(初回 or リプレイ)。 */
  firstLaunchTutorialMode: FirstLaunchTutorialMode;
  /** チュートリアルを完了する。 */
  completeFirstLaunchTutorial: () => void;

  // 画面遷移
  /** 地図画面へ移動する(mapFollowState の prepareMapRegionRestore も行う)。 */
  openMap: () => void;
  /** 日別記録画面へ移動する。 */
  openDailyLogs: () => void;
  /** 実績画面へ移動する。 */
  openAchievements: () => void;
  /** 月次レポート画面へ移動する(Plusゲート付き)。 */
  openMonthlyReport: () => void;
  /** 設定画面へ移動する。 */
  openSettings: () => void;
  /** 設定からチュートリアルを再表示する。 */
  openFirstLaunchTutorial: () => void;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

/**
 * アプリ全体の状態と操作を提供する Context フック。
 *
 * AppStateProvider の外で呼ばれた場合は Error を投げる。
 */
export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error('useAppState は AppStateProvider の内側で使う必要があります');
  }

  return ctx;
}

/** AppStateProvider の子コンポーネント型。 */
type AppStateProviderProps = {
  /** 子コンポーネント。 */
  children: React.ReactNode;
  /**
   * 画面遷移コールバックをオーバーライドするための外部ナビゲーター。
   * expo-router のルートで router.push を挟みたい場合に渡す。
   * 未指定の場合は内部の screenMode 切り替えのみで動作する。
   */
  navigator?: {
    /** 地図画面へ移動する。 */
    openMap?: () => void;
    /** 日別記録画面へ移動する。 */
    openDailyLogs?: () => void;
    /** 実績画面へ移動する。 */
    openAchievements?: () => void;
    /** 月次レポート画面へ移動する。 */
    openMonthlyReport?: () => void;
    /** 設定画面へ移動する。 */
    openSettings?: () => void;
  };
  /**
   * expo-router の現在パスから導出した ScreenMode。
   *
   * navigator 経由の遷移は router.push のみで内部 state を更新しないため、
   * これを渡さないと screenMode が初期値 'map' のまま実際の route とズレ、
   * 地図追従の画面判定や画面遷移フックが同期しなくなる。
   * 指定時は内部 state より優先する単一ソースとして扱う(ディープリンク直遷移にも追従)。
   * 未指定時は内部の screenMode 切り替えで動作する(テスト互換モード)。
   */
  currentScreenMode?: ScreenMode;
};

/**
 * アプリ全体の状態・フック・コールバックを提供する Context Provider。
 *
 * 旧 App.tsx のフック結線部を一括して受け持ち、expo-router 移行後も
 * 既存フックの呼び出し順序・依存関係を完全に維持する。
 *
 * navigator prop を渡すと画面遷移を expo-router の router.push 経由にできる。
 * 未指定時は内部の screenMode 切り替えで動作する(テスト互換モード)。
 */
export function AppStateProvider({ children, navigator, currentScreenMode }: AppStateProviderProps): React.ReactElement {
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
  const [internalScreenMode, setScreenMode] = useState<ScreenMode>('map');
  // currentScreenMode(expo-routerのパス由来)が渡されていればそれを単一ソースとして優先する。
  // 未指定時(テスト互換モード)のみ内部 state で画面を切り替える。
  const screenMode = currentScreenMode ?? internalScreenMode;
  const [keepScreenAwake, setKeepScreenAwake] = useState(false);
  const [crashReportingEnabled, setCrashReportingEnabledState] = useState(true);
  const [isImportingGpx, setIsImportingGpx] = useState(false);
  const [isProcessingGpxImport, setIsProcessingGpxImport] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<MapPhoto | null>(null);
  const [selectedPhotoCluster, setSelectedPhotoCluster] = useState<MapPhotoCluster | null>(null);
  const [isFirstLaunchTutorialVisible, setIsFirstLaunchTutorialVisible] = useState(false);
  const [firstLaunchTutorialMode, setFirstLaunchTutorialMode] = useState<FirstLaunchTutorialMode>('firstLaunch');
  const [monthlyReportPoints, setMonthlyReportPoints] = useState<LocationPoint[]>([]);
  /**
   * 現在 monthlyReportPoints に読み込み済みの対象月(YYYY-MM)。
   *
   * openMonthlyReport 経由の通常遷移と、月次レポート画面表示中の補完 effect の
   * 両方が対象月ポイントを取得しうるため、同じ月への重複フェッチを避けるために使う。
   * 未読み込み(初期値 null)のときはディープリンク等の直接到達を示す。
   */
  const loadedMonthlyReportMonthRef = useRef<string | null>(null);

  const {
    selectedAchievement,
    setSelectedAchievement,
    achievementItems,
    pendingAchievementNotifications,
    isAchievementDialogVisibleRef,
    wasAchievementEvaluationPausedRef,
    refreshAchievementState,
    evaluateAchievementsIfDialogIdle,
    closeAchievementUnlockModal,
    shareAchievementToX,
    initializeAchievementReviewState,
    requestAchievementNotificationPermissionIfNeeded,
  } = useAchievementState();

  // useLocationRecordingSync に渡す安定したコールバックラッパー。
  // ref 経由で実装しているため空 deps で問題ない。
  // これらを useCallback で安定化しないと deps 変化で refreshData が毎レンダーで再生成され
  // effect が無限ループする。
  const stableIncrementVisitedGridRefreshVersion = useCallback(() => incrementVisitedGridRefreshVersionRef.current(), []);
  const stableEvaluateAchievementsIfDialogIdle = useCallback(() => evaluateAchievementsIfDialogIdleRef.current(), []);
  const stableRefreshAchievementState = useCallback(
    (...args: Parameters<typeof refreshAchievementStateRef.current>) => refreshAchievementStateRef.current(...args),
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
    pointsBounds,
    distance,
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
  const hasAnyLocationPoints = pointsBounds != null;
  const initialRegion = useMemo(() => createRegionFromBounds(pointsBounds), [pointsBounds]);
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
  // パン(中心移動のみ)では再クラスタリングをスキップする。詳細は usePhotoClusters を参照。
  const photoClusters = usePhotoClusters(photos, visibleRegion);
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
   * 月次レポート画面の表示中、対象月のポイントが未読み込みなら補完取得する。
   *
   * 通常は openMonthlyReport → enterMonthlyReportOrPrompt の中で monthlyReportPoints を
   * 取得するが、scheme 追加によりディープリンクやアプリ復元で /monthly-report へ直接
   * 到達できるため、その経路では monthlyReportPoints が空のままになり、日別ログ由来の
   * 距離・日数は表示されるのにルート地図・共有画像だけ空になる不整合が起きる。
   * screenMode が 'monthlyReport' の間、読み込み済み月(loadedMonthlyReportMonthRef)と
   * 対象月が異なる場合だけ取得し、通常遷移直後の重複フェッチを避ける。
   * 失敗時は console.warn に留める。画面は dailyLogs 由来のデータで表示済みのため、
   * 補完取得の失敗でAlert等の割り込みは行わず、ref も更新しないため次回表示時に再試行される。
   */
  useEffect(() => {
    if (screenMode !== 'monthlyReport') {
      return;
    }

    const targetMonth = formatReportMonth(getPreviousReportMonth());
    if (loadedMonthlyReportMonthRef.current === targetMonth) {
      return;
    }

    let cancelled = false;
    getLocationPointsByMonth(targetMonth)
      .then((points) => {
        if (cancelled) {
          return;
        }
        setMonthlyReportPoints(points);
        loadedMonthlyReportMonthRef.current = targetMonth;
      })
      .catch((error: unknown) => {
        console.warn('Failed to load monthly report points on direct screen entry:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [screenMode]);

  // useAchievementState の evaluateAchievementsIfDialogIdle / refreshAchievementState を
  // useLocationRecordingSync へ ref 経由で渡す。
  // フック呼び出し順序の循環を避けるため ref に同期する。
  evaluateAchievementsIfDialogIdleRef.current = evaluateAchievementsIfDialogIdle;
  refreshAchievementStateRef.current = refreshAchievementState;

  /** 全期間のGPSログをGPXとして共有する。 */
  const exportAllLogs = useCallback(async (): Promise<void> => {
    try {
      await shareAllLogsAsGpx();
    } catch (error: unknown) {
      Alert.alert('エクスポート失敗', error instanceof Error ? error.message : 'GPX出力に失敗しました。');
    }
  }, []);

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
              // 取り消せない操作の完了は、見落としやすいトーストではなくAlertで明示する
              Alert.alert('削除完了', DELETE_ALL_DATA_SUCCESS_MESSAGE);
            })
            .catch((error: unknown) => {
              Alert.alert('削除失敗', error instanceof Error ? error.message : 'データを削除できませんでした。');
            });
        },
      },
    ]);
  }, [refreshAchievementState, refreshData]);

  /**
   * 起動時読み込みとSentry両方へ不具合レポート設定を反映するsetter。
   * useAppInitializationのsetCrashReportingEnabled propへ渡す。
   * Sentryの同名関数と混同しないよう、Sentry側はapplyCrashReportingToSentryと別名importしている。
   */
  const applyCrashReportingSetting = useCallback((value: boolean): void => {
    setCrashReportingEnabledState(value);
    applyCrashReportingToSentry(value);
  }, []);

  /**
   * 不具合レポート送信設定をUI状態・Sentry・SQLiteの三箇所へ反映する。
   * 永続化に失敗した場合はUI状態とSentryフラグを元へ巻き戻し、乖離を残さない。
   */
  const updateCrashReportingEnabled = useCallback(
    async (enabled: boolean): Promise<void> => {
      const previousValue = crashReportingEnabled;
      setCrashReportingEnabledState(enabled);
      applyCrashReportingToSentry(enabled);
      try {
        await setSetting(CRASH_REPORTING_SETTING_KEY, enabled);
      } catch (error: unknown) {
        console.warn('Failed to persist crash reporting setting:', error);
        setCrashReportingEnabledState(previousValue);
        applyCrashReportingToSentry(previousValue);
        // 巻き戻したうえで呼び出し側へ伝播し、設定画面・チュートリアルの catch で保存失敗を通知させる。
        throw error;
      }
    },
    [crashReportingEnabled],
  );

  /**
   * 画面ON維持設定をUI状態とSQLiteの両方へ反映する。
   * 永続化に失敗した場合はUI状態を元へ巻き戻し、UIとストレージの乖離を残さない。
   */
  const updateKeepScreenAwake = useCallback(
    async (enabled: boolean): Promise<void> => {
      const previousValue = keepScreenAwake;
      setKeepScreenAwake(enabled);
      try {
        await setSetting(KEEP_SCREEN_AWAKE_SETTING_KEY, enabled);
      } catch (error: unknown) {
        console.warn('Failed to persist keep screen awake setting:', error);
        setKeepScreenAwake(previousValue);
      }
    },
    [keepScreenAwake],
  );

  useAppInitialization({
    initializePremiumAccess,
    applySavedIconSettings,
    initializePhotoSetting,
    refreshData,
    synchronizeLocationRecordingMode,
    initializeAchievementReviewState,
    refreshAchievementState,
    requestAchievementNotificationPermissionIfNeeded,
    snapshotPremiumAccessUpdateVersion,
    setKeepScreenAwake,
    setCrashReportingEnabled: applyCrashReportingSetting,
    setMessage,
    setIsWhileInUseToastVisible,
    setIsReady,
    setFirstLaunchTutorialMode,
    setIsFirstLaunchTutorialVisible,
  });

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
  useAutoFitInitialRoute(mapRef, screenMode, initialRegion, hasAnyLocationPoints, userCoordinate);
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

  /**
   * 内部の screenMode を更新する画面遷移。
   * navigator が渡されている場合はそちらへ委譲する。
   */
  function navigateToScreen(nextScreenMode: ScreenMode): void {
    triggerLightImpactHaptic();
    setScreenMode(nextScreenMode);
  }

  /** 日ごとの記録画面へ移動する。 */
  function openDailyLogs(): void {
    if (navigator?.openDailyLogs) {
      triggerLightImpactHaptic();
      navigator.openDailyLogs();
    } else {
      navigateToScreen('dailyLogs');
    }
  }

  /** 地図画面へ戻る。 */
  function openMap(): void {
    triggerLightImpactHaptic();
    mapFollowState.prepareMapRegionRestore();
    if (navigator?.openMap) {
      navigator.openMap();
    } else {
      setScreenMode('map');
    }
  }

  /** 実績画面へ移動する。 */
  function openAchievements(): void {
    refreshAchievementState().catch(() => undefined);
    if (navigator?.openAchievements) {
      triggerLightImpactHaptic();
      navigator.openAchievements();
    } else {
      navigateToScreen('achievements');
    }
  }

  /** 月次レポート画面へ移動する。無料ユーザーはペイウォールを表示する。 */
  function openMonthlyReport(): void {
    // 起動直後は premiumAccessState がデフォルト値（未確定）のままの可能性があるため、
    // ボタン押下時に最新状態を取得してから判定する。
    getPremiumAccessState()
      .then((latestState) => {
        setPremiumAccessState(latestState);
        return enterMonthlyReportOrPrompt(latestState.isPlusActive);
      })
      .catch((error: unknown) => {
        console.warn('Failed to check premium access state:', error);
        return enterMonthlyReportOrPrompt(premiumAccessState.isPlusActive);
      });
  }

  /**
   * Plus状態と先月データの有無に応じて、月次レポート遷移・ペイウォール・集計中案内を出し分ける。
   *
   * 先月分のGPSポイントはこの関数の中で取得する(全期間ポイントをメモリへ保持しないため)。
   *
   * @param isPlusActive - Strollia Plusが有効かどうか。
   * @returns なし。
   */
  async function enterMonthlyReportOrPrompt(isPlusActive: boolean): Promise<void> {
    if (!isPlusActive) {
      openPremiumPaywall();
      return;
    }

    const targetMonth = formatReportMonth(getPreviousReportMonth());
    let previousMonthPoints: LocationPoint[];
    try {
      previousMonthPoints = await getLocationPointsByMonth(targetMonth);
    } catch (error: unknown) {
      console.warn('Failed to load previous month points:', error);
      Alert.alert('エラー', '月次レポートの読み込みに失敗しました。');
      return;
    }

    const previousMonthReport = createMonthlyReport(dailyLogs, previousMonthPoints, getPreviousReportMonth());
    if (!hasMonthlyReportData(previousMonthReport)) {
      Alert.alert('現在集計中です！', '来月になったらもう一度来てください！');
      return;
    }

    setMonthlyReportPoints(previousMonthPoints);
    // ディープリンク補完 effect が直後に同じ月を再取得しないよう、読み込み済み月を記録する。
    loadedMonthlyReportMonthRef.current = targetMonth;
    refreshAchievementState().catch(() => undefined);
    if (navigator?.openMonthlyReport) {
      triggerLightImpactHaptic();
      navigator.openMonthlyReport();
    } else {
      navigateToScreen('monthlyReport');
    }
  }

  /** 設定画面へ移動する。 */
  function openSettings(): void {
    if (navigator?.openSettings) {
      triggerLightImpactHaptic();
      navigator.openSettings();
    } else {
      navigateToScreen('settings');
    }
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

  /** GPXファイルを選択し、既存データ優先で端末内DBへ取り込む。 */
  async function importGpx(): Promise<void> {
    if (isImportingGpxRef.current) {
      return;
    }

    triggerSelectionHaptic();
    isImportingGpxRef.current = true;
    setIsImportingGpx(true);

    try {
      // 注意ダイアログをユーザーが閉じるまで待ってからファイル選択を開く。
      // 待たずに開くと、ダイアログの上にピッカーが被さり注意文を読めなくなる。
      await new Promise<void>((resolve) => {
        Alert.alert(
          'GPXインポートと実績について',
          'GPXインポートでは、総移動距離や記録日数など一部の実績だけが判定対象になります。訪問した地域など、実際の記録中に確認する実績には反映されません。',
          [{ text: 'OK', onPress: () => resolve() }],
          { cancelable: false },
        );
      });
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

      // インポート中はGPS記録の書き込みを止めてバッファへ退避し、DBロック競合を避ける。
      beginGpxImportPriority();
      let result: GpxImportResult;
      try {
        result = await importLocationPointsFromGpx(pointsToImport, pickedFile.fileName);
      } finally {
        // 成否にかかわらず優先モードを解除し、退避分をまとめて取り込む。
        await flushLocationsBufferedDuringGpxImport().catch((error: unknown) => {
          console.warn('Failed to flush buffered locations after GPX import:', error);
        });
      }
      await refreshData();
      // 取り込んだ大量データ(ルート・訪問グリッド)の再描画が終わるまでブロッキングダイアログを維持する。
      // 先に閉じると再描画中のフリーズが操作可能な画面のまま露出する。
      // rAFはJSスレッドが再描画で塞がっている間は発火しないため、2回挟むことで描画コミット完了後に解決される。
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });
      Alert.alert(
        'GPXインポート完了',
        `${result.importedPointCount}件を取り込みました。${result.skippedPointCount}件は既存データを優先してスキップしました。`,
      );
    } catch (error: unknown) {
      console.warn('GPX import failed:', error);

      // チャンク分割インポートの途中失敗では取り込み済みデータがDBに残るため、
      // 画面を実態に合わせて更新し、部分取り込みと安全な再試行方法を通知する。
      if (error instanceof GpxImportInterruptedError) {
        await refreshData().catch((refreshError: unknown) => {
          console.warn('Failed to refresh data after interrupted GPX import:', refreshError);
        });
        Alert.alert(
          'GPXインポート失敗',
          `途中まで(${error.importedPointCount}件)取り込んだところで失敗しました。同じファイルを再度インポートすると、取り込み済みの分は重複せず残りから安全に再開できます。`,
        );
        return;
      }

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

  /** 地図タイプを切り替える。 */
  function toggleMapType(): void {
    triggerSelectionHaptic();
    mapFollowState.toggleMapType();
  }

  const value: AppStateContextValue = {
    theme,
    styles,
    isReady,
    shouldShowDevelopmentFlagBanner,
    screenMode,
    screenTransitionOpacity,
    isRecording,
    autoStartStatus,
    permissionState,
    hasRequiredPermission,
    shouldOpenSettingsForPermission,
    isWhileInUseRecordingMode,
    isWhileInUseToastVisible,
    setIsWhileInUseToastVisible,
    dailyLogs,
    hasAnyLocationPoints,
    monthlyReportPoints,
    monthlyAreaReport,
    refreshData,
    startRecording,
    requestLocationPermission,
    openLocationSettings,
    mapRef,
    userCoordinate,
    isFollowingUserLocation,
    isMapReady,
    visibleRegion,
    currentSpeedKmh,
    mapType,
    initialRegion,
    todayDistanceMeters,
    distance,
    currentAreaLabel,
    recenterButtonOpacity,
    handleUserLocationChange,
    handleMapPanDrag,
    handleRegionChangeComplete,
    handleRegionChange,
    handleMapReady,
    recenterOnUserLocation,
    toggleMapType,
    visitedGridCells,
    gridOverlayOpacity,
    showPhotosOnMap,
    isUpdatingPhotoSetting,
    photoClusters,
    isLoadingPhotos,
    photoErrorMessage,
    updateShowPhotosOnMap,
    selectedPhoto,
    selectedPhotoCluster,
    selectedPhotoClusterPages,
    setSelectedPhotoCluster,
    setSelectedPhoto,
    handlePhotoClusterPress,
    selectedAchievement,
    setSelectedAchievement,
    achievementItems,
    activeAchievementNotification,
    closeAchievementUnlockModal,
    shareAchievementToX,
    premiumAccessState,
    revenueCatAppUserId,
    premiumOfferingSummary,
    isLoadingPremiumOffering,
    isPurchasingPremiumPackage,
    isPresentingPremiumCustomerCenter,
    isRestoringPremiumPurchases,
    isPremiumPaywallVisible,
    purchasePremiumPackageFromSettings,
    restorePurchasesFromSettings,
    openPremiumCustomerCenter,
    openPremiumPaywall,
    closePremiumPaywall,
    showPremiumLockedMessage,
    selectedAppColorPresetId,
    selectedUserLocationIconId,
    userLocationIcon,
    updateAppColorPreset,
    handleCustomIconLoadError,
    updateUserLocationIcon,
    keepScreenAwake,
    updateKeepScreenAwake,
    crashReportingEnabled,
    updateCrashReportingEnabled,
    exportAllLogs,
    importGpx,
    deleteAllData,
    openLegalLink,
    isImportingGpx,
    isProcessingGpxImport,
    appVersion: Application.nativeApplicationVersion,
    buildNumber: Application.nativeBuildVersion,
    isFirstLaunchTutorialVisible,
    firstLaunchTutorialMode,
    completeFirstLaunchTutorial,
    openMap,
    openDailyLogs,
    openAchievements,
    openMonthlyReport,
    openSettings,
    openFirstLaunchTutorial,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}
