/**
 * 開発・検証用の一時フラグを集約する。
 *
 * previewビルドや開発中の動作確認だけで使う値をここに置く。
 * 本番公開前には各フラグの意図を確認し、不要なものはfalseまたは正式実装へ差し替える。
 */
export const developmentFlags = {
  /** RevenueCat導入前にStrollia Plus特典を仮に有効化する。 */
  enablePremiumAccessWithoutRevenueCat: true,
  /** 開発中に起動時の実績解除状態と通知キューをリセットして再評価する。 */
  resetAchievementsOnLaunch: true,
} as const;

/** いずれかの開発用フラグが有効か。 */
export function hasEnabledDevelopmentFlags(): boolean {
  return Object.values(developmentFlags).some(Boolean);
}

/** 現在のビルドで起動時の実績リセット再評価を有効にするか。 */
export function shouldResetAchievementsOnLaunch(): boolean {
  return developmentFlags.resetAchievementsOnLaunch;
}
