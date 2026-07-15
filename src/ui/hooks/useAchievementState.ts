import { MutableRefObject, useCallback, useRef, useState } from 'react';
import { Alert, Share } from 'react-native';
import * as Haptics from 'expo-haptics';

import { AchievementDefinition } from '@/features/achievements/achievementDefinitions';
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
import { requestAchievementNotificationPermissionOnFirstLaunch } from '@/features/achievements/achievementNotificationService';
import { shouldRequestReviewAfterAchievement } from '@/features/review/reviewPromptLogic';
import { requestStoreReview } from '@/features/review/storeReview';
import { setSetting } from '@/features/settings/settingsRepository';

/** reviewPrompted 設定の SQLite キー。 */
const REVIEW_PROMPTED_SETTING_KEY = 'reviewPrompted';

/** `useAchievementState` が返す状態と操作。 */
export type UseAchievementStateResult = {
  /** 実績一覧画面で選択した実績（詳細ダイアログ用）。 */
  selectedAchievement: AchievementListItem | null;
  /** 選択中の実績を更新するsetter。 */
  setSelectedAchievement: (achievement: AchievementListItem | null) => void;
  /** 取得済みの実績一覧。 */
  achievementItems: AchievementListItem[];
  /** 未表示の実績解除通知キュー。 */
  pendingAchievementNotifications: PendingAchievementNotification[];
  /** ダイアログ表示中かを同期する ref。useAchievementDialogEffects へ渡す。 */
  isAchievementDialogVisibleRef: MutableRefObject<boolean>;
  /** ダイアログ表示中に実績評価を止めたかを保持する ref。useAchievementDialogEffects へ渡す。 */
  wasAchievementEvaluationPausedRef: MutableRefObject<boolean>;
  /**
   * 実績一覧と未表示の解除演出キューを再読み込みする。
   * useLocationRecordingSync へ ref 経由で渡すためにも使う。
   */
  refreshAchievementState: (showPendingNotifications?: boolean, options?: { signal?: AbortSignal }) => Promise<void>;
  /**
   * 実績解除ダイアログが出ていない時だけ実績を評価する。
   * useLocationRecordingSync へ ref 経由で渡すためにも使う。
   *
   * @returns 実績評価を実行した場合は true。
   */
  evaluateAchievementsIfDialogIdle: () => Promise<boolean>;
  /** 実績解除モーダルを閉じ、次の未表示実績があれば続けて表示する。 */
  closeAchievementUnlockModal: () => void;
  /** OS標準共有シートへ実績共有文言を渡す。 */
  shareAchievementToX: (achievement: AchievementDefinition) => void;
  /**
   * 起動時に savedReviewPrompted を適用し、hasPromptedReview の初期値を確定させる。
   * 初期化 effect から1回だけ呼ぶ。
   */
  initializeAchievementReviewState: (savedReviewPrompted: boolean) => void;
  /**
   * 実績通知権限要求を同一セッションで重複実行しないよう呼び出す。
   * 初期化 effect と初回チュートリアル完了後から呼ぶ。
   */
  requestAchievementNotificationPermissionIfNeeded: () => Promise<void>;
};

/**
 * 実績の表示状態・評価・解除モーダル・通知権限を束ねるフック。
 *
 * App.tsx の「実績関連」責務を切り出す。
 * refreshAchievementState と evaluateAchievementsIfDialogIdle は
 * useLocationRecordingSync へ ref 経由で渡すために公開する。
 */
export function useAchievementState(): UseAchievementStateResult {
  const isAchievementDialogVisibleRef = useRef(false);
  const wasAchievementEvaluationPausedRef = useRef(false);
  const hasRequestedAchievementNotificationPermissionRef = useRef(false);
  /** 閉じた直後のDB再取得で同じ解除演出が戻ることを防ぐためのセッション内ガード。 */
  const dismissedAchievementQueueIdsRef = useRef(new Set<number>());

  const [selectedAchievement, setSelectedAchievement] = useState<AchievementListItem | null>(null);
  const [achievementItems, setAchievementItems] = useState<AchievementListItem[]>([]);
  const [pendingAchievementNotifications, setPendingAchievementNotifications] = useState<PendingAchievementNotification[]>([]);
  const [hasPromptedReview, setHasPromptedReview] = useState(false);

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

  /** 実績解除モーダルを閉じ、次の未表示実績があれば続けて表示する。 */
  const closeAchievementUnlockModal = useCallback((): void => {
    const current = pendingAchievementNotifications[0] ?? null;

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
  }, [hasPromptedReview, pendingAchievementNotifications]);

  /** OS標準共有シートへ実績共有文言を渡す。 */
  const shareAchievementToX = useCallback((achievement: AchievementDefinition): void => {
    Haptics.selectionAsync().catch(() => undefined);
    Share.share({ message: achievement.shareText }).catch((error: unknown) => {
      Alert.alert('共有失敗', error instanceof Error ? error.message : '共有シートを開けませんでした。');
    });
  }, []);

  /**
   * 起動時に savedReviewPrompted を適用する。
   * 初期化 effect から1回だけ呼ぶ想定。
   */
  const initializeAchievementReviewState = useCallback((savedReviewPrompted: boolean): void => {
    setHasPromptedReview(savedReviewPrompted);
  }, []);

  /** 実績通知権限要求を同一セッションで重複実行しないよう呼び出す。 */
  const requestAchievementNotificationPermissionIfNeeded = useCallback(async (): Promise<void> => {
    if (hasRequestedAchievementNotificationPermissionRef.current) {
      return;
    }

    hasRequestedAchievementNotificationPermissionRef.current = true;
    await requestAchievementNotificationPermissionOnFirstLaunch();
  }, []);

  return {
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
  };
}
