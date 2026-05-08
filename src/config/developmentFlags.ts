/** 開発用フラグの値として扱う環境変数値。 */
const ENABLED_ENV_VALUE = 'true';

/**
 * 環境変数から開発用フラグを読む。
 *
 * @param name - 読み取る環境変数名。
 * @returns 環境変数の値がtrue文字列ならtrue。
 */
function readDevelopmentFlag(name: string): boolean {
  return process.env[name] === ENABLED_ENV_VALUE;
}

/** 開発・検証用の一時フラグを集約する。 */
export const developmentFlags: Record<'enablePremiumAccessWithoutRevenueCat' | 'resetAchievementsOnLaunch', boolean> = {
  /** RevenueCat導入前にStrollia Plus特典を仮に有効化する。 */
  enablePremiumAccessWithoutRevenueCat: readDevelopmentFlag('EXPO_PUBLIC_ENABLE_PREMIUM_ACCESS_WITHOUT_REVENUECAT'),
  /** 開発中に起動時の実績解除状態と通知キューをリセットして再評価する。 */
  resetAchievementsOnLaunch: readDevelopmentFlag('EXPO_PUBLIC_RESET_ACHIEVEMENTS_ON_LAUNCH'),
};

/** いずれかの開発用フラグが有効か。 */
export function hasEnabledDevelopmentFlags(): boolean {
  return Object.values(developmentFlags).some(Boolean);
}

/** 現在のビルドで起動時の実績リセット再評価を有効にするか。 */
export function shouldResetAchievementsOnLaunch(): boolean {
  return developmentFlags.resetAchievementsOnLaunch;
}
