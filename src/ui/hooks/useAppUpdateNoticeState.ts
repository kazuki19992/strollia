import { useCallback, useMemo, useState } from 'react';
import { Linking, Platform } from 'react-native';

import { getStrolliaStoreUrl } from '@/config/storeUrls';
import {
  LAST_ACKNOWLEDGED_UPDATE_NOTICE_VERSION_SETTING_KEY,
  LATEST_UPDATE_NOTICE,
  resolveCurrentAppUpdateNotice,
} from '@/features/app-update/updateNotices';
import type { AppUpdateNotice, AppUpdateNoticeSource } from '@/features/app-update/updateNotices';
import { setSetting } from '@/features/settings/settingsRepository';
import type { AppSettingEntry } from '@/features/settings/settingsRepository';

/** 更新通知の表示を待機させるグローバルモーダルの状態。 */
export type AppUpdateNoticeBlockingModalState = {
  /** 初回チュートリアルを表示中かどうか。 */
  isFirstLaunchTutorialVisible: boolean;
  /** 実績アンロック通知を表示中かどうか。 */
  hasActiveAchievementNotification: boolean;
  /** 実績詳細ダイアログを表示中かどうか。 */
  hasSelectedAchievement: boolean;
  /** PlusのPaywallを表示中かどうか。 */
  isPremiumPaywallVisible: boolean;
  /** 写真単体プレビューを表示中かどうか。 */
  hasSelectedPhoto: boolean;
  /** 写真クラスタプレビューを表示中かどうか。 */
  hasSelectedPhotoCluster: boolean;
  /** GPX処理用のブロッキングダイアログを表示中かどうか。 */
  isProcessingGpxImport: boolean;
};

/** 更新通知の状態フックに渡す値。 */
export type UseAppUpdateNoticeStateOptions = AppUpdateNoticeBlockingModalState & {
  /** 実行中のストア配布版。 */
  nativeApplicationVersion: string | null;
  /** 最新1件の更新通知定義。テストではfixtureを注入できる。 */
  latestUpdateNotice?: AppUpdateNotice | null;
};

/** 更新通知の状態フックが返す状態と操作。 */
export type AppUpdateNoticeState = {
  /** 現在のネイティブ版に一致する通知。 */
  currentAppUpdateNotice: AppUpdateNotice | null;
  /** 表示中の通知を開いた導線。 */
  appUpdateNoticeDialogSource: AppUpdateNoticeSource | null;
  /** 他のグローバルモーダルとの排他を反映した表示可否。 */
  isAppUpdateNoticeDialogVisible: boolean;
  /** 起動時の未読通知を開く。 */
  openAutomaticAppUpdateNotice: () => void;
  /** 設定画面から最新の通知を開く。 */
  openLatestAppUpdateNotice: () => void;
  /** 通知を閉じ、起動時表示分だけ既読版を保存する。 */
  closeAppUpdateNotice: () => void;
  /** 端末OSに対応するストアページを開く。 */
  openAppStorePage: () => Promise<void>;
};

/**
 * 初回チュートリアル完了と同一トランザクションで保存する更新通知の既読エントリーを追加する。
 *
 * 新規インストールでは通知を表示しないため、現在版通知がある場合だけここで既読化する。
 */
export function appendFirstLaunchUpdateNoticeAcknowledgement(
  entries: readonly AppSettingEntry[],
  currentAppUpdateNotice: AppUpdateNotice | null,
): AppSettingEntry[] {
  if (!currentAppUpdateNotice) {
    return [...entries];
  }

  return [...entries, { key: LAST_ACKNOWLEDGED_UPDATE_NOTICE_VERSION_SETTING_KEY, value: currentAppUpdateNotice.version }];
}

/**
 * アプリ更新通知の表示元・既読保存・モーダル排他を一元管理する。
 *
 * 自動表示の既読保存は閉じる操作と同時に非同期で開始する。保存失敗でも表示状態は
 * 巻き戻さず、次の起動で再通知できるよう警告だけを残す。
 */
export function useAppUpdateNoticeState({
  nativeApplicationVersion,
  latestUpdateNotice = LATEST_UPDATE_NOTICE,
  isFirstLaunchTutorialVisible,
  hasActiveAchievementNotification,
  hasSelectedAchievement,
  isPremiumPaywallVisible,
  hasSelectedPhoto,
  hasSelectedPhotoCluster,
  isProcessingGpxImport,
}: UseAppUpdateNoticeStateOptions): AppUpdateNoticeState {
  const currentAppUpdateNotice = useMemo(
    () => resolveCurrentAppUpdateNotice(latestUpdateNotice, nativeApplicationVersion),
    [latestUpdateNotice, nativeApplicationVersion],
  );
  const [appUpdateNoticeDialogSource, setAppUpdateNoticeDialogSource] = useState<AppUpdateNoticeSource | null>(null);
  const hasBlockingGlobalModal = Boolean(
    isFirstLaunchTutorialVisible ||
    hasActiveAchievementNotification ||
    hasSelectedAchievement ||
    isPremiumPaywallVisible ||
    hasSelectedPhoto ||
    hasSelectedPhotoCluster ||
    isProcessingGpxImport,
  );
  const isAppUpdateNoticeDialogVisible = appUpdateNoticeDialogSource !== null && currentAppUpdateNotice !== null && !hasBlockingGlobalModal;

  /** 起動時の未読通知を自動表示として予約する。 */
  const openAutomaticAppUpdateNotice = useCallback((): void => {
    if (currentAppUpdateNotice) {
      setAppUpdateNoticeDialogSource('automatic');
    }
  }, [currentAppUpdateNotice]);

  /** 現在版の通知がある場合だけ、設定起点で表示する。 */
  const openLatestAppUpdateNotice = useCallback((): void => {
    if (currentAppUpdateNotice) {
      setAppUpdateNoticeDialogSource('settings');
    }
  }, [currentAppUpdateNotice]);

  /** 通知を閉じ、起動時に自動表示した通知だけを既読として保存する。 */
  const closeAppUpdateNotice = useCallback((): void => {
    const source = appUpdateNoticeDialogSource;
    const notice = currentAppUpdateNotice;
    setAppUpdateNoticeDialogSource(null);

    if (source !== 'automatic' || !notice) {
      return;
    }

    setSetting(LAST_ACKNOWLEDGED_UPDATE_NOTICE_VERSION_SETTING_KEY, notice.version).catch((error: unknown) => {
      console.warn('Failed to persist app update notice acknowledgement:', error);
    });
  }, [appUpdateNoticeDialogSource, currentAppUpdateNotice]);

  /** 端末OSに対応するストアページを開く。失敗してもダイアログ状態は変更しない。 */
  const openAppStorePage = useCallback(async (): Promise<void> => {
    try {
      await Linking.openURL(getStrolliaStoreUrl(Platform.OS));
    } catch (error: unknown) {
      console.warn('Failed to open app store page:', error);
    }
  }, []);

  return {
    currentAppUpdateNotice,
    appUpdateNoticeDialogSource,
    isAppUpdateNoticeDialogVisible,
    openAutomaticAppUpdateNotice,
    openLatestAppUpdateNotice,
    closeAppUpdateNotice,
    openAppStorePage,
  };
}
