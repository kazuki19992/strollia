type DevelopmentFlagsModule = typeof import('../developmentFlags');

/** process.envに値を設定し、undefinedなら削除する。 */
function setEnvValue(name: string, value: string | undefined): void {
  if (value == null) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

/** 環境変数を反映した状態で開発フラグモジュールを読み直す。 */
function loadDevelopmentFlagsModule(env: Record<string, string | undefined>): DevelopmentFlagsModule {
  const originalPremiumFlag = process.env.EXPO_PUBLIC_ENABLE_PREMIUM_ACCESS_WITHOUT_REVENUECAT;
  const originalAchievementResetFlag = process.env.EXPO_PUBLIC_RESET_ACHIEVEMENTS_ON_LAUNCH;

  setEnvValue('EXPO_PUBLIC_ENABLE_PREMIUM_ACCESS_WITHOUT_REVENUECAT', env.EXPO_PUBLIC_ENABLE_PREMIUM_ACCESS_WITHOUT_REVENUECAT);
  setEnvValue('EXPO_PUBLIC_RESET_ACHIEVEMENTS_ON_LAUNCH', env.EXPO_PUBLIC_RESET_ACHIEVEMENTS_ON_LAUNCH);
  jest.resetModules();
  const loadedModule = require('../developmentFlags') as DevelopmentFlagsModule;
  setEnvValue('EXPO_PUBLIC_ENABLE_PREMIUM_ACCESS_WITHOUT_REVENUECAT', originalPremiumFlag);
  setEnvValue('EXPO_PUBLIC_RESET_ACHIEVEMENTS_ON_LAUNCH', originalAchievementResetFlag);

  return loadedModule;
}

describe('開発用フラグ developmentFlags', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('既定では開発用フラグを無効にする', () => {
    const { hasEnabledDevelopmentFlags, shouldResetAchievementsOnLaunch } = loadDevelopmentFlagsModule({});

    expect(hasEnabledDevelopmentFlags()).toBe(false);
    expect(shouldResetAchievementsOnLaunch()).toBe(false);
  });

  it('環境変数でPlus仮有効化フラグを有効にできる', () => {
    const { developmentFlags, hasEnabledDevelopmentFlags } = loadDevelopmentFlagsModule({
      EXPO_PUBLIC_ENABLE_PREMIUM_ACCESS_WITHOUT_REVENUECAT: 'true',
    });

    expect(developmentFlags.enablePremiumAccessWithoutRevenueCat).toBe(true);
    expect(hasEnabledDevelopmentFlags()).toBe(true);
  });

  it('環境変数で起動時実績リセット判定を有効にできる', () => {
    const { shouldResetAchievementsOnLaunch } = loadDevelopmentFlagsModule({
      EXPO_PUBLIC_RESET_ACHIEVEMENTS_ON_LAUNCH: 'true',
    });

    expect(shouldResetAchievementsOnLaunch()).toBe(true);
  });
});
