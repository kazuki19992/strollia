import { useEffect } from 'react';

import { initializeDatabase } from '@/db/database';
import { shouldResetAchievementsOnLaunch } from '@/config/developmentFlags';
import {
  initializeAchievementNotificationHandler,
  setupAchievementNotificationChannel,
} from '@/features/achievements/achievementNotificationService';
import { evaluateAchievementsAndNotify } from '@/features/achievements/achievementService';
import { setupMonthlyReportNotificationChannel, syncMonthlyReportNotification } from '@/features/reports/monthlyReportNotificationService';
import { isWhileInUseOnlyMode } from '@/features/location/locationPermission';
import { getDefaultPremiumAccessState, getConfirmedPremiumAccessState } from '@/features/premium/revenueCatAccess';
import { resolveInitialPremiumAccess } from '@/features/premium/initialPremiumAccess';
import { getBooleanSetting, getStringSetting, setSetting } from '@/features/settings/settingsRepository';
import { loadAppFonts } from '@/theme/fonts';
import { CRASH_REPORTING_SETTING_KEY } from '@/ui/appText';
import {
  USER_LOCATION_ICON_SETTING_KEY,
  APP_COLOR_PRESET_SETTING_KEY,
  CUSTOM_ICON_IMAGE_URI_SETTING_KEY,
} from './useUserLocationIconSetting';
import { SHOW_PHOTOS_ON_MAP_SETTING_KEY, SHOW_PHOTOS_ON_MAP_ENABLE_PENDING_SETTING_KEY } from './usePhotoMapCrashBreaker';
import type { LocationPermissionState } from '@/features/location/locationPermission';
import type { RefreshDataResult } from './useLocationRecordingSync';
import { DEFAULT_USER_LOCATION_ICON_ID } from '@/features/customization/customizationOptions';
import { DEFAULT_APP_COLOR_PRESET_ID } from '@/features/customization/colorPresets';

/** 画面ON維持設定をSQLiteへ保存するキー。 */
const KEEP_SCREEN_AWAKE_SETTING_KEY = 'keepScreenAwake';
/** 初回起動チュートリアル完了状態をSQLiteへ保存するキー。 */
const FIRST_LAUNCH_TUTORIAL_COMPLETED_SETTING_KEY = 'firstLaunchTutorialCompleted';

/** `useAppInitialization` に渡す依存関数と setter の型。 */
export type UseAppInitializationOptions = {
  /** Plus課金状態の初期化。 */
  initializePremiumAccess: (params: {
    initialVersion: number;
    initialPremiumAccessRequest: ReturnType<typeof getConfirmedPremiumAccessState>;
    result: Awaited<ReturnType<typeof resolveInitialPremiumAccess>>;
    signal: AbortSignal;
  }) => void;
  /** 現在地アイコン・カラープリセット設定の読み込み。 */
  applySavedIconSettings: (params: {
    savedUserLocationIcon: string;
    savedAppColorPresetId: string;
    savedCustomIconImageUri: string;
    signal: AbortSignal;
  }) => Promise<void>;
  /** 写真表示設定の初期化（クラッシュブレーカー付き）。 */
  initializePhotoSetting: (params: { savedShowPhotosOnMap: boolean; savedShowPhotosOnMapEnablePending: boolean }) => void;
  /** GPS記録データとDBの初回読み込み。 */
  refreshData: (options?: { signal?: AbortSignal }) => Promise<RefreshDataResult>;
  /** GPS記録モード同期。 */
  synchronizeLocationRecordingMode: (
    state: { permissions: LocationPermissionState; recording: boolean },
    signal?: AbortSignal,
  ) => Promise<void>;
  /** 実績レビュー促進フラグの初期化。 */
  initializeAchievementReviewState: (savedReviewPrompted: boolean) => void;
  /** 実績一覧の初回読み込み。 */
  refreshAchievementState: (showPendingNotifications?: boolean, options?: { signal?: AbortSignal }) => Promise<void>;
  /** 実績通知権限の初回要求（重複防止付き）。 */
  requestAchievementNotificationPermissionIfNeeded: () => Promise<void>;
  /** Plus課金更新バージョンの snapshotを取得する。 */
  snapshotPremiumAccessUpdateVersion: () => number;
  /** 画面ON維持状態を初期化する。 */
  setKeepScreenAwake: (value: boolean) => void;
  /** 不具合レポート設定のUI状態を反映する。 */
  setCrashReportingEnabled: (value: boolean) => void;
  /** ユーザー向けメッセージを更新する。 */
  setMessage: (message: string) => void;
  /** 前景限定記録トーストの表示を更新する。 */
  setIsWhileInUseToastVisible: (visible: boolean) => void;
  /** アプリ初期化完了を通知する。 */
  setIsReady: (ready: boolean) => void;
  /** 初回チュートリアルの表示モードを設定する。 */
  setFirstLaunchTutorialMode: (mode: 'firstLaunch' | 'replay') => void;
  /** 初回チュートリアルの表示・非表示を設定する。 */
  setIsFirstLaunchTutorialVisible: (visible: boolean) => void;
};

/**
 * 起動時の初期化フローを束ねるオーケストレーターフック。
 *
 * App.tsx の巨大初期化 effect を切り出し、各フックが公開する初期化関数を
 * 既存と完全に同一の順序で呼び出す。AbortController / signal チェックのパターンも維持する。
 * deps 変化による再実行はしない設計（初期化は一度だけ）。
 */
export function useAppInitialization({
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
  setCrashReportingEnabled,
  setMessage,
  setIsWhileInUseToastVisible,
  setIsReady,
  setFirstLaunchTutorialMode,
  setIsFirstLaunchTutorialVisible,
}: UseAppInitializationOptions): void {
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
          savedCrashReportingEnabled,
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
          getBooleanSetting(CRASH_REPORTING_SETTING_KEY, true),
          getBooleanSetting(SHOW_PHOTOS_ON_MAP_SETTING_KEY, false),
          getBooleanSetting(SHOW_PHOTOS_ON_MAP_ENABLE_PENDING_SETTING_KEY, false),
          getStringSetting(USER_LOCATION_ICON_SETTING_KEY, DEFAULT_USER_LOCATION_ICON_ID),
          getStringSetting(APP_COLOR_PRESET_SETTING_KEY, DEFAULT_APP_COLOR_PRESET_ID),
          getStringSetting(CUSTOM_ICON_IMAGE_URI_SETTING_KEY, ''),
          getBooleanSetting('reviewPrompted', false),
          getBooleanSetting(FIRST_LAUNCH_TUTORIAL_COMPLETED_SETTING_KEY, false),
          resolveInitialPremiumAccess(initialPremiumAccessRequest, getDefaultPremiumAccessState(), { signal }),
        ]);
        if (signal.aborted) return;
        setKeepScreenAwake(savedKeepScreenAwake);
        setCrashReportingEnabled(savedCrashReportingEnabled);
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
        initializeAchievementReviewState(savedReviewPrompted);
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
    initializeAchievementReviewState,
    initializePremiumAccess,
    initializePhotoSetting,
    refreshAchievementState,
    refreshData,
    requestAchievementNotificationPermissionIfNeeded,
    setIsReady,
    setIsWhileInUseToastVisible,
    setMessage,
    snapshotPremiumAccessUpdateVersion,
    synchronizeLocationRecordingMode,
    setFirstLaunchTutorialMode,
    setIsFirstLaunchTutorialVisible,
    setKeepScreenAwake,
    setCrashReportingEnabled,
  ]);
}
