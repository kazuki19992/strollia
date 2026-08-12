/** 開発用フラグの値として扱う環境変数値。 */
const ENABLED_ENV_VALUE = 'true';

/** 開発・検証用の一時フラグを集約する。 */
export const developmentFlags: Record<
  'enablePremiumAccessWithoutRevenueCat' | 'resetAchievementsOnLaunch' | 'logVisitedGridMetrics',
  boolean
> = {
  /** RevenueCat導入前にStrollia Plus特典を仮に有効化する。 */
  enablePremiumAccessWithoutRevenueCat: process.env.EXPO_PUBLIC_ENABLE_PREMIUM_ACCESS_WITHOUT_REVENUECAT === ENABLED_ENV_VALUE,
  /** 開発中に起動時の実績解除状態と通知キューをリセットして再評価する。 */
  resetAchievementsOnLaunch: process.env.EXPO_PUBLIC_RESET_ACHIEVEMENTS_ON_LAUNCH === ENABLED_ENV_VALUE,
  /** Visited Grid Overlayの取得・結合・描画コストを開発中に確認する。 */
  logVisitedGridMetrics: process.env.EXPO_PUBLIC_LOG_VISITED_GRID_METRICS === ENABLED_ENV_VALUE,
};

/** いずれかの開発用フラグが有効か。 */
export function hasEnabledDevelopmentFlags(): boolean {
  return Object.values(developmentFlags).some(Boolean);
}

/** 現在のビルドで起動時の実績リセット再評価を有効にするか。 */
export function shouldResetAchievementsOnLaunch(): boolean {
  return developmentFlags.resetAchievementsOnLaunch;
}
