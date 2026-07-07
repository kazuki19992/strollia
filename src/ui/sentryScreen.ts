import type { ScreenMode } from './appTypes';

type FirstLaunchTutorialModeForSentry = 'firstLaunch' | 'hidden' | 'replay';

type ResolveSentryScreenNameInput = {
  dailyLogsScreenName: string;
  firstLaunchTutorialMode: FirstLaunchTutorialModeForSentry;
  isFirstLaunchTutorialVisible: boolean;
  isPhotoPreviewVisible: boolean;
  isPremiumPaywallVisible: boolean;
  screenMode: ScreenMode;
  settingsScreenName: string;
};

/**
 * Sentryへ送る画面名を、前面表示の優先度とネストした画面名から解決する。
 *
 * モーダルやチュートリアルなどの前面表示を優先し、日別記録/設定は
 * NavigationContainer側で更新した `DailyLogs:*` / `Settings:*` の名前を使う。
 */
export function resolveSentryScreenName(input: ResolveSentryScreenNameInput): string {
  if (input.isPremiumPaywallVisible) {
    return 'PremiumPaywall';
  }

  if (input.isFirstLaunchTutorialVisible) {
    return input.firstLaunchTutorialMode === 'replay' ? 'FirstLaunchTutorialReplay' : 'FirstLaunchTutorial';
  }

  if (input.isPhotoPreviewVisible) {
    return 'PhotoPreview';
  }

  switch (input.screenMode) {
    case 'achievements':
      return 'AchievementList';
    case 'dailyLogs':
      return input.dailyLogsScreenName;
    case 'map':
      return 'Map';
    case 'monthlyReport':
      return 'MonthlyReport';
    case 'settings':
      return input.settingsScreenName;
  }
}
