import { PendingAchievementNotification } from './achievementRepository';

/**
 * すでに画面上で閉じた実績解除キューを除外する。
 *
 * @param notifications DBから取得した未表示の実績解除キュー。
 * @param dismissedQueueIds このセッションで閉じた実績解除キューID。
 * @returns まだ画面に表示すべき実績解除キュー。
 */
export function filterDismissedAchievementNotifications(
  notifications: PendingAchievementNotification[],
  dismissedQueueIds: ReadonlySet<number>,
): PendingAchievementNotification[] {
  return notifications.filter((notification) => !dismissedQueueIds.has(notification.queueId));
}
