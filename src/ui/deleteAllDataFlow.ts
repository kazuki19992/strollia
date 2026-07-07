/** 全データ削除後に再読み込みする非同期処理。 */
type RefreshDeletedUserData = () => Promise<unknown>;

/** 削除対象を画面文言と揃えた成功メッセージ。 */
export const DELETE_ALL_DATA_SUCCESS_MESSAGE = '保存済みのGPSログ・訪問エリア・実績データを削除しました。';

/**
 * 全データ削除後にGPSログと実績表示の状態を同期する。
 *
 * @param refreshData - GPSログや権限状態を再読み込みする処理。
 * @param refreshAchievementState - 実績一覧と通知キューを再読み込みする処理。
 * @returns 両方の再読み込みが完了したPromise。
 */
export async function refreshDeletedUserDataState(
  refreshData: RefreshDeletedUserData,
  refreshAchievementState: (showPendingNotifications: boolean) => Promise<unknown>,
): Promise<void> {
  await Promise.all([refreshData(), refreshAchievementState(true)]);
}
