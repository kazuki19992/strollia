import {
  pathnameToAchievementsSentryScreenName,
  pathnameToScreenMode,
  pathnameToSettingsSentryScreenName,
  pathnameToDailyLogsSentryScreenName,
} from '@/ui/pathnameToScreenMode';

describe('pathnameToScreenMode', () => {
  it('ルートパス "/" は map を返す', () => {
    expect(pathnameToScreenMode('/')).toBe('map');
  });

  it('空文字列は map を返す', () => {
    expect(pathnameToScreenMode('')).toBe('map');
  });

  it('"/index" は map を返す', () => {
    expect(pathnameToScreenMode('/index')).toBe('map');
  });

  it('"/daily-logs" は dailyLogs を返す', () => {
    expect(pathnameToScreenMode('/daily-logs')).toBe('dailyLogs');
  });

  it('"/daily-logs/2024-01-01" は dailyLogs を返す', () => {
    expect(pathnameToScreenMode('/daily-logs/2024-01-01')).toBe('dailyLogs');
  });

  it('"/achievements" は achievements を返す', () => {
    expect(pathnameToScreenMode('/achievements')).toBe('achievements');
  });

  it('"/achievements/01a0c450-6c00-7000-8000-000000000001" は achievements を返す', () => {
    expect(pathnameToScreenMode('/achievements/01a0c450-6c00-7000-8000-000000000001')).toBe('achievements');
  });

  it('"/monthly-report" は monthlyReport を返す', () => {
    expect(pathnameToScreenMode('/monthly-report')).toBe('monthlyReport');
  });

  it('"/settings" は settings を返す', () => {
    expect(pathnameToScreenMode('/settings')).toBe('settings');
  });

  it('"/settings/about" は settings を返す', () => {
    expect(pathnameToScreenMode('/settings/about')).toBe('settings');
  });

  it('"/settings/licenses/react@19.1.0" は settings を返す', () => {
    expect(pathnameToScreenMode('/settings/licenses/react@19.1.0')).toBe('settings');
  });

  it('未知のパスは map にフォールバックする', () => {
    expect(pathnameToScreenMode('/unknown-route')).toBe('map');
  });
});

describe('pathnameToSettingsSentryScreenName', () => {
  it('"/settings" は Settings:SettingsHome を返す', () => {
    expect(pathnameToSettingsSentryScreenName('/settings')).toBe('Settings:SettingsHome');
  });

  it('"/settings/" は Settings:SettingsHome を返す', () => {
    expect(pathnameToSettingsSentryScreenName('/settings/')).toBe('Settings:SettingsHome');
  });

  it('"/settings/about" は Settings:AboutApp を返す', () => {
    expect(pathnameToSettingsSentryScreenName('/settings/about')).toBe('Settings:AboutApp');
  });

  it('"/settings/faq" は Settings:Faq を返す', () => {
    expect(pathnameToSettingsSentryScreenName('/settings/faq')).toBe('Settings:Faq');
  });

  it('"/settings/stay-places" とその子画面は Settings:StayPlaces を返す', () => {
    expect(pathnameToSettingsSentryScreenName('/settings/stay-places')).toBe('Settings:StayPlaces');
    expect(pathnameToSettingsSentryScreenName('/settings/stay-places/new')).toBe('Settings:StayPlaces');
  });

  it('"/settings/licenses" は Settings:LicenseList を返す', () => {
    expect(pathnameToSettingsSentryScreenName('/settings/licenses')).toBe('Settings:LicenseList');
  });

  it('"/settings/licenses/react@19.1.0" は Settings:LicenseDetail を返す', () => {
    expect(pathnameToSettingsSentryScreenName('/settings/licenses/react@19.1.0')).toBe('Settings:LicenseDetail');
  });

  it('設定系でないパスは Settings:SettingsHome にフォールバックする', () => {
    expect(pathnameToSettingsSentryScreenName('/map')).toBe('Settings:SettingsHome');
  });
});

describe('pathnameToAchievementsSentryScreenName', () => {
  it('"/achievements" は Achievements:AchievementList を返す', () => {
    expect(pathnameToAchievementsSentryScreenName('/achievements')).toBe('Achievements:AchievementList');
  });

  it('"/achievements/" は Achievements:AchievementList を返す', () => {
    expect(pathnameToAchievementsSentryScreenName('/achievements/')).toBe('Achievements:AchievementList');
  });

  it('"/achievements/[packId]" は Achievements:LandmarkPackDetail を返す', () => {
    expect(pathnameToAchievementsSentryScreenName('/achievements/01a0c450-6c00-7000-8000-000000000001')).toBe(
      'Achievements:LandmarkPackDetail',
    );
  });

  it('実績系でないパスは Achievements:AchievementList にフォールバックする', () => {
    expect(pathnameToAchievementsSentryScreenName('/settings')).toBe('Achievements:AchievementList');
  });
});

describe('pathnameToDailyLogsSentryScreenName', () => {
  it('"/daily-logs" は DailyLogs:DailyLogList を返す', () => {
    expect(pathnameToDailyLogsSentryScreenName('/daily-logs')).toBe('DailyLogs:DailyLogList');
  });

  it('"/daily-logs/" は DailyLogs:DailyLogList を返す', () => {
    expect(pathnameToDailyLogsSentryScreenName('/daily-logs/')).toBe('DailyLogs:DailyLogList');
  });

  it('"/daily-logs/2024-01-01" は DailyLogs:DailyLogDetail を返す', () => {
    expect(pathnameToDailyLogsSentryScreenName('/daily-logs/2024-01-01')).toBe('DailyLogs:DailyLogDetail');
  });

  it('日別記録系でないパスは DailyLogs:DailyLogList にフォールバックする', () => {
    expect(pathnameToDailyLogsSentryScreenName('/settings')).toBe('DailyLogs:DailyLogList');
  });
});
