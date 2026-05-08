import { MutableRefObject, useEffect } from 'react';
import { AppStateStatus, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';

import { PendingAchievementNotification } from '../../features/achievements/achievementRepository';

/** 実績解除ダイアログ副作用hookの引数。 */
export type UseAchievementDialogEffectsArgs = {
  /** 現在表示中の実績解除通知。 */
  activeAchievementNotification: PendingAchievementNotification | null;
  /** アプリ初期化が完了しているか。 */
  isReady: boolean;
  /** 現在のアプリ状態。 */
  appState: AppStateStatus;
  /** ダイアログ表示中かを同期するref。 */
  isAchievementDialogVisibleRef: MutableRefObject<boolean>;
  /** ダイアログ表示中に実績評価を止めたかを保持するref。 */
  wasAchievementEvaluationPausedRef: MutableRefObject<boolean>;
  /** GPSログ再読み込みと実績評価を再開する処理。 */
  refreshDataAndEvaluateAchievementsIfDialogIdle: () => Promise<void>;
  /** 画面メッセージを更新する処理。 */
  setMessage: (message: string) => void;
};

/** 実績解除ダイアログに関する評価再開、タプティック、振動の副作用をまとめる。 */
export function useAchievementDialogEffects({
  activeAchievementNotification,
  isReady,
  appState,
  isAchievementDialogVisibleRef,
  wasAchievementEvaluationPausedRef,
  refreshDataAndEvaluateAchievementsIfDialogIdle,
  setMessage,
}: UseAchievementDialogEffectsArgs): void {
  useEffect(() => {
    const isDialogVisible = activeAchievementNotification != null;
    isAchievementDialogVisibleRef.current = isDialogVisible;

    if (isDialogVisible || !wasAchievementEvaluationPausedRef.current || !isReady || appState !== 'active') {
      return;
    }

    wasAchievementEvaluationPausedRef.current = false;
    refreshDataAndEvaluateAchievementsIfDialogIdle().catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : 'GPSログの再読み込みに失敗しました。');
    });
  }, [
    activeAchievementNotification,
    appState,
    isAchievementDialogVisibleRef,
    isReady,
    refreshDataAndEvaluateAchievementsIfDialogIdle,
    setMessage,
    wasAchievementEvaluationPausedRef,
  ]);

  useEffect(() => {
    if (!activeAchievementNotification) {
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    Vibration.vibrate(1000);

    return () => Vibration.cancel();
  }, [activeAchievementNotification]);
}
