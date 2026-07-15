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
