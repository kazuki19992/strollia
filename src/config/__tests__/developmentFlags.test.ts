import { developmentFlags, hasEnabledDevelopmentFlags, shouldResetAchievementsOnLaunch } from '../developmentFlags';

describe('開発用フラグ developmentFlags', () => {
  it('開発中のPlus仮有効化フラグを一箇所で管理する', () => {
    expect(developmentFlags.enablePremiumAccessWithoutRevenueCat).toBe(true);
  });

  it('開発中の起動時実績リセット再評価フラグを一箇所で管理する', () => {
    expect(developmentFlags.resetAchievementsOnLaunch).toBe(true);
    expect(shouldResetAchievementsOnLaunch()).toBe(developmentFlags.resetAchievementsOnLaunch);
  });

  it('開発用フラグがひとつでも有効な場合はtrueを返す', () => {
    expect(hasEnabledDevelopmentFlags()).toBe(true);
  });
});
