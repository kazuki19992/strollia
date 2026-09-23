import { resolveSentryScreenName } from '@/ui/sentryScreen';

describe('Sentry画面名解決', () => {
  it('日別記録と設定はネストしたナビゲーション状態の画面名を使う', () => {
    expect(
      resolveSentryScreenName({
        dailyLogsScreenName: 'DailyLogs:DailyLogDetail',
        firstLaunchTutorialMode: 'hidden',
        isFirstLaunchTutorialVisible: false,
        isPremiumPaywallVisible: false,
        isPhotoPreviewVisible: false,
        screenMode: 'dailyLogs',
        settingsScreenName: 'Settings:SettingsHome',
      }),
    ).toBe('DailyLogs:DailyLogDetail');

    expect(
      resolveSentryScreenName({
        dailyLogsScreenName: 'DailyLogs:DailyLogList',
        firstLaunchTutorialMode: 'hidden',
        isFirstLaunchTutorialVisible: false,
        isPremiumPaywallVisible: false,
        isPhotoPreviewVisible: false,
        screenMode: 'settings',
        settingsScreenName: 'Settings:LicenseDetail',
      }),
    ).toBe('Settings:LicenseDetail');
  });

  it('実績スタックは子画面名を使い、未指定なら AchievementList を返す', () => {
    expect(
      resolveSentryScreenName({
        achievementsScreenName: 'Achievements:LandmarkPackDetail',
        dailyLogsScreenName: 'DailyLogs:DailyLogList',
        firstLaunchTutorialMode: 'hidden',
        isFirstLaunchTutorialVisible: false,
        isPremiumPaywallVisible: false,
        isPhotoPreviewVisible: false,
        screenMode: 'achievements',
        settingsScreenName: 'Settings:SettingsHome',
      }),
    ).toBe('Achievements:LandmarkPackDetail');

    expect(
      resolveSentryScreenName({
        dailyLogsScreenName: 'DailyLogs:DailyLogList',
        firstLaunchTutorialMode: 'hidden',
        isFirstLaunchTutorialVisible: false,
        isPremiumPaywallVisible: false,
        isPhotoPreviewVisible: false,
        screenMode: 'achievements',
        settingsScreenName: 'Settings:SettingsHome',
      }),
    ).toBe('AchievementList');
  });

  it('実績スタックでもペイウォール表示中は前面表示を優先する', () => {
    expect(
      resolveSentryScreenName({
        achievementsScreenName: 'Achievements:AchievementList',
        dailyLogsScreenName: 'DailyLogs:DailyLogList',
        firstLaunchTutorialMode: 'hidden',
        isFirstLaunchTutorialVisible: false,
        isPremiumPaywallVisible: true,
        isPhotoPreviewVisible: false,
        screenMode: 'achievements',
        settingsScreenName: 'Settings:SettingsHome',
      }),
    ).toBe('PremiumPaywall');
  });

  it('モーダル表示中はネストした画面名より前面表示を優先する', () => {
    expect(
      resolveSentryScreenName({
        dailyLogsScreenName: 'DailyLogs:DailyLogDetail',
        firstLaunchTutorialMode: 'hidden',
        isFirstLaunchTutorialVisible: false,
        isPremiumPaywallVisible: true,
        isPhotoPreviewVisible: false,
        screenMode: 'dailyLogs',
        settingsScreenName: 'Settings:SettingsHome',
      }),
    ).toBe('PremiumPaywall');
  });
});
