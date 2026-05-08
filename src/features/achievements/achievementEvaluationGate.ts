/**
 * 実績解除ダイアログの表示状態から、フォアグラウンド実績評価を実行できるか判定する。
 *
 * @param isAchievementDialogVisible 実績解除ダイアログが表示中かどうか。
 * @returns 実績評価を実行できる場合はtrue。
 */
export function canEvaluateAchievementsInForeground(isAchievementDialogVisible: boolean): boolean {
  return !isAchievementDialogVisible;
}
