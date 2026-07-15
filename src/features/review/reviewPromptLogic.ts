/** レビュー促進のトリガーとなる実績ID（総移動距離200km）。 */
export const REVIEW_PROMPT_ACHIEVEMENT_ID = 'distance-200';

/** レビュー促進を出すべきか判定するための文脈。 */
export type ReviewPromptContext = {
  /** 閉じた実績のID。 */
  dismissedAchievementId: string;
  /** まだ未表示の実績通知が残っているか。 */
  hasPendingNotifications: boolean;
  /** 既にレビュー促進済みか。 */
  hasAlreadyPrompted: boolean;
};

/**
 * 実績解除ダイアログを閉じた後にレビュー促進を出すべきか判定する。
 *
 * 総移動距離200km（`distance-200`）を閉じ、連続表示中の他の実績通知が残っておらず、
 * まだ一度も促していない場合にのみtrueを返す。
 *
 * @param context - 判定に使う文脈。
 * @returns レビュー促進を要求すべきならtrue。
 */
export function shouldRequestReviewAfterAchievement(context: ReviewPromptContext): boolean {
  return context.dismissedAchievementId === REVIEW_PROMPT_ACHIEVEMENT_ID && !context.hasPendingNotifications && !context.hasAlreadyPrompted;
}
