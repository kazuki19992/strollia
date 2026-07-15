import type { ScreenMode } from './appTypes';

/**
 * expo-router のパス名を既存の ScreenMode に変換する純粋関数。
 *
 * expo-router のファイルベースルーティングへ移行した後も、
 * ScreenMode に依存する既存フック (useMapFollowState 等) や
 * Sentry 画面名解決ロジックをそのまま再利用できるようにするための橋渡し。
 *
 * - `/` または `/index` → `'map'`
 * - `/daily-logs` 以下 → `'dailyLogs'`
 * - `/achievements` → `'achievements'`
 * - `/monthly-report` → `'monthlyReport'`
 * - `/settings` 以下 → `'settings'`
 * - 未知のパスは `'map'` にフォールバックする
 */
export function pathnameToScreenMode(pathname: string): ScreenMode {
  if (pathname === '/' || pathname === '/index' || pathname === '') {
    return 'map';
  }

  const segment = pathname.split('/')[1];

  switch (segment) {
    case 'daily-logs':
      return 'dailyLogs';
    case 'achievements':
      return 'achievements';
    case 'monthly-report':
      return 'monthlyReport';
    case 'settings':
      return 'settings';
    default:
      return 'map';
  }
}

/**
 * expo-router のパス名から Sentry 用の設定系子画面名を解決する。
 *
 * 設定スタック内の子ルートは `Settings:ルート名` の形式で Sentry へ送る。
 * 旧実装の `NavigationContainer#onStateChange` が生成していた文字列と完全に一致させる。
 */
export function pathnameToSettingsSentryScreenName(pathname: string): string {
  if (!pathname.startsWith('/settings')) {
    return 'Settings:SettingsHome';
  }

  const after = pathname.slice('/settings'.length);

  if (after === '' || after === '/') {
    return 'Settings:SettingsHome';
  }

  if (after === '/about') {
    return 'Settings:AboutApp';
  }

  if (after === '/faq') {
    return 'Settings:Faq';
  }

  if (after.startsWith('/licenses/') && after !== '/licenses/') {
    // /settings/licenses/[name] → Settings:LicenseDetail
    return 'Settings:LicenseDetail';
  }

  if (after === '/licenses' || after === '/licenses/') {
    return 'Settings:LicenseList';
  }

  return 'Settings:SettingsHome';
}

/**
 * expo-router のパス名から Sentry 用の日別記録系子画面名を解決する。
 *
 * 旧実装の `NavigationContainer#onStateChange` が生成していた文字列と完全に一致させる。
 */
export function pathnameToDailyLogsSentryScreenName(pathname: string): string {
  if (!pathname.startsWith('/daily-logs')) {
    return 'DailyLogs:DailyLogList';
  }

  const after = pathname.slice('/daily-logs'.length);

  if (after === '' || after === '/') {
    return 'DailyLogs:DailyLogList';
  }

  // /daily-logs/[date] → DailyLogs:DailyLogDetail
  return 'DailyLogs:DailyLogDetail';
}
