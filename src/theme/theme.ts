import type { AppColorPreset } from '@/features/customization/colorPresets';

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
    routeMapEmptyBackground: string;
    routeMapEmptyText: string;
    shareButtonBackground: string;
    shareButtonText: string;
    plusCtaBackground: string;
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
    card: '#f8f8f8',
    cardStrong: '#f0f0f0',
    text: '#1a1a1a',
    mutedText: '#666666',
    border: '#e0e0e0',
    primary: '#1f7a5c',
    primaryText: '#fffdf8',
    danger: '#b33f52',
    dangerSurface: '#fff1f3',
    mapLine: '#1f7a5c',
    routeMapEmptyBackground: '#172b63',
    routeMapEmptyText: '#ffffff',
    shareButtonBackground: '#333333',
    shareButtonText: '#ffffff',
    plusCtaBackground: 'rgba(31, 122, 92, 0.08)',
    surfaceOverlay: 'rgba(248, 248, 248, 0.94)',
    scrim: 'rgba(0, 0, 0, 0.08)',
    shadow: '#000000',
  },
};

/** ダークモード用の色定義。 */
export const darkTheme: AppTheme = {
  name: 'dark',
  colors: {
    background: '#202020',
    card: '#252525',
    cardStrong: '#2e2e2e',
    text: '#f0f0f0',
    mutedText: '#999999',
    border: '#3a3a3a',
    primary: '#73c7a2',
    primaryText: '#102018',
    danger: '#ff8899',
    dangerSurface: '#3a2028',
    mapLine: '#73c7a2',
    routeMapEmptyBackground: '#142d5c',
    routeMapEmptyText: '#ffffff',
    shareButtonBackground: '#f0f0f0',
    shareButtonText: '#111111',
    plusCtaBackground: 'rgba(115, 199, 162, 0.08)',
    surfaceOverlay: 'rgba(37, 37, 37, 0.94)',
    scrim: 'rgba(0, 0, 0, 0.28)',
    shadow: '#000000',
  },
};

/** 保存済みテーマ設定として扱える値か判定する。 */
export function isAppThemePreference(value: string): value is AppThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

/**
 * OSのカラースキームとユーザー設定から利用するテーマを選ぶ。
 * RN 0.83以降の ColorSchemeName に含まれる 'unspecified' は、OS設定が不明な状態としてライトテーマへフォールバックする。
 */
export function getAppTheme(
  colorScheme: 'light' | 'dark' | 'unspecified' | null | undefined,
  preference: AppThemePreference = 'system',
): AppTheme {
  if (preference === 'light') {
    return lightTheme;
  }

  if (preference === 'dark') {
    return darkTheme;
  }

  return colorScheme === 'dark' ? darkTheme : lightTheme;
}

/**
 * テーマにカラープリセットのprimary系色を上書きした新しいテーマを返す。
 * 元のテーマオブジェクトは変更しない。
 *
 * @param theme - ベースとなるテーマ。
 * @param preset - 適用するカラープリセット。
 * @returns primary/primaryText/mapLineを上書きした新しいテーマ。
 */
export function applyColorPreset(theme: AppTheme, preset: AppColorPreset): AppTheme {
  const colors = theme.name === 'dark' ? preset.dark : preset.light;
  return {
    ...theme,
    colors: { ...theme.colors, ...colors },
  };
}
