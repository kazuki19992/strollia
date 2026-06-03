/** OSカラースキームに対応するアプリテーマ名。 */
export type AppThemeName = 'light' | 'dark';

/** ユーザーが選べるテーマ設定。 */
export type AppThemePreference = 'system' | 'light' | 'dark';

/** 画面全体で共有する色トークン一式。 */
export type AppTheme = {
  name: AppThemeName;
  colors: {
    background: string;
    card: string;
    cardStrong: string;
    text: string;
    mutedText: string;
    border: string;
    primary: string;
    primaryText: string;
    danger: string;
    dangerSurface: string;
    mapLine: string;
    surfaceOverlay: string;
    scrim: string;
    shadow: string;
  };
};

/** ライトモード用の色定義。 */
export const lightTheme: AppTheme = {
  name: 'light',
  colors: {
    background: '#ffffff',
    card: '#fffdf8',
    cardStrong: '#fffdf8',
    text: '#2d2416',
    mutedText: '#675c4d',
    border: '#e5ddcd',
    primary: '#1f7a5c',
    primaryText: '#fffdf8',
    danger: '#b33f52',
    dangerSurface: '#fff1f3',
    mapLine: '#1f7a5c',
    surfaceOverlay: 'rgba(255, 253, 248, 0.94)',
    scrim: 'rgba(45, 36, 22, 0.08)',
    shadow: '#2d2416',
  },
};

/** ダークモード用の色定義。 */
export const darkTheme: AppTheme = {
  name: 'dark',
  colors: {
    background: '#202020',
    card: '#22261d',
    cardStrong: '#2b3025',
    text: '#f3eadb',
    mutedText: '#c8bda7',
    border: '#3a4032',
    primary: '#73c7a2',
    primaryText: '#102018',
    danger: '#ff8899',
    dangerSurface: '#3a2028',
    mapLine: '#73c7a2',
    surfaceOverlay: 'rgba(34, 38, 29, 0.94)',
    scrim: 'rgba(0, 0, 0, 0.28)',
    shadow: '#000000',
  },
};

/** 保存済みテーマ設定として扱える値か判定する。 */
export function isAppThemePreference(value: string): value is AppThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** OSのカラースキームとユーザー設定から利用するテーマを選ぶ。 */
export function getAppTheme(colorScheme: 'light' | 'dark' | null | undefined, preference: AppThemePreference = 'system'): AppTheme {
  if (preference === 'light') {
    return lightTheme;
  }

  if (preference === 'dark') {
    return darkTheme;
  }

  return colorScheme === 'dark' ? darkTheme : lightTheme;
}
