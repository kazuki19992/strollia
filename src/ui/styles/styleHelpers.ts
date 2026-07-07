import type { AppTheme } from '@/theme/theme';

/** #rrggbbの色をrgba表記へ変換する。 */
export function hexToRgba(hex: string, alpha: number): string {
  const normalizedHex = hex.replace('#', '');
  const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(2)})`;
}

/** 設定系画面のリスト・本文で共通に使うテーマ派生色。 */
export type SettingsDerivedColors = {
  /** 本文テキスト色。 */
  settingsText: string;
  /** 補足テキスト色。 */
  settingsMuted: string;
  /** 区切り線色。 */
  settingsBorder: string;
};

/**
 * 設定系画面のテーマ派生色を返す。
 *
 * settingsStyles / dailyLogStyles など複数のスタイルファイルが同じ実値を
 * 使うため、色の定義を1箇所に集約して乖離を防ぐ。
 */
export function getSettingsDerivedColors(theme: AppTheme): SettingsDerivedColors {
  return {
    settingsText: theme.name === 'dark' ? '#ffffff' : '#333333',
    settingsMuted: theme.name === 'dark' ? 'rgba(255, 255, 255, 0.62)' : '#767676',
    settingsBorder: theme.name === 'dark' ? 'rgba(255, 255, 255, 0.28)' : 'rgba(51, 51, 51, 0.20)',
  };
}
