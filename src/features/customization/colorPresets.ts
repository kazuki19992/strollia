/** アプリカラープリセットのID。 */
export type AppColorPresetId =
  | 'matcha' | 'wakaba' | 'himawari' | 'mikan' | 'yuuyake' | 'tomato'
  | 'sakura' | 'tasogare' | 'hoshizora' | 'umi' | 'ramune' | 'asatsuyu';

/** ライト・ダーク両モード用のprimary系色セット。 */
export type AppColorPresetColors = {
  primary: string;
  primaryText: string;
  mapLine: string;
};

/** アプリカラープリセット定義。 */
export type AppColorPreset = {
  id: AppColorPresetId;
  label: string;
  light: AppColorPresetColors;
  dark: AppColorPresetColors;
};

/** デフォルトで使うプリセットID（まっちゃ＝現在のプライマリカラー）。 */
export const DEFAULT_APP_COLOR_PRESET_ID: AppColorPresetId = 'matcha';

/** 12色のアプリカラープリセット一覧。 */
export const APP_COLOR_PRESETS: AppColorPreset[] = [
  {
    id: 'matcha',
    label: 'まっちゃ',
    light: { primary: '#1f7a5c', primaryText: '#fffdf8', mapLine: '#1f7a5c' },
    dark:  { primary: '#73c7a2', primaryText: '#102018', mapLine: '#73c7a2' },
  },
  {
    id: 'wakaba',
    label: 'わかば',
    light: { primary: '#5a8a1a', primaryText: '#ffffff', mapLine: '#5a8a1a' },
    dark:  { primary: '#9fd45a', primaryText: '#0f2000', mapLine: '#9fd45a' },
  },
  {
    id: 'himawari',
    label: 'ひまわり',
    light: { primary: '#b08000', primaryText: '#ffffff', mapLine: '#b08000' },
    dark:  { primary: '#f0c040', primaryText: '#1a1000', mapLine: '#f0c040' },
  },
  {
    id: 'mikan',
    label: 'みかん',
    light: { primary: '#c06010', primaryText: '#ffffff', mapLine: '#c06010' },
    dark:  { primary: '#f08840', primaryText: '#1a0800', mapLine: '#f08840' },
  },
  {
    id: 'yuuyake',
    label: 'ゆうやけ',
    light: { primary: '#c04020', primaryText: '#ffffff', mapLine: '#c04020' },
    dark:  { primary: '#f07050', primaryText: '#1a0500', mapLine: '#f07050' },
  },
  {
    id: 'tomato',
    label: 'トマト',
    light: { primary: '#b02020', primaryText: '#ffffff', mapLine: '#b02020' },
    dark:  { primary: '#f06060', primaryText: '#1a0000', mapLine: '#f06060' },
  },
  {
    id: 'sakura',
    label: 'さくら',
    light: { primary: '#b04070', primaryText: '#ffffff', mapLine: '#b04070' },
    dark:  { primary: '#f090b0', primaryText: '#1a0010', mapLine: '#f090b0' },
  },
  {
    id: 'tasogare',
    label: 'たそがれ',
    light: { primary: '#6030a0', primaryText: '#ffffff', mapLine: '#6030a0' },
    dark:  { primary: '#a870e0', primaryText: '#0a0018', mapLine: '#a870e0' },
  },
  {
    id: 'hoshizora',
    label: 'ほしぞら',
    light: { primary: '#3040a0', primaryText: '#ffffff', mapLine: '#3040a0' },
    dark:  { primary: '#7090e0', primaryText: '#00001a', mapLine: '#7090e0' },
  },
  {
    id: 'umi',
    label: 'うみ',
    light: { primary: '#1060a0', primaryText: '#ffffff', mapLine: '#1060a0' },
    dark:  { primary: '#50a0e0', primaryText: '#00101a', mapLine: '#50a0e0' },
  },
  {
    id: 'ramune',
    label: 'ラムネ',
    light: { primary: '#008090', primaryText: '#ffffff', mapLine: '#008090' },
    dark:  { primary: '#40c0d0', primaryText: '#001a1a', mapLine: '#40c0d0' },
  },
  {
    id: 'asatsuyu',
    label: 'あさつゆ',
    light: { primary: '#007060', primaryText: '#ffffff', mapLine: '#007060' },
    dark:  { primary: '#50b0a0', primaryText: '#001a16', mapLine: '#50b0a0' },
  },
];

/**
 * IDからプリセットを取得する。未知IDはまっちゃへフォールバック。
 */
export function getAppColorPreset(id: AppColorPresetId): AppColorPreset {
  const defaultPreset = APP_COLOR_PRESETS.find((preset) => preset.id === DEFAULT_APP_COLOR_PRESET_ID) ?? APP_COLOR_PRESETS[0];
  return APP_COLOR_PRESETS.find((preset) => preset.id === id) ?? defaultPreset;
}

/**
 * 文字列がAppColorPresetIdとして有効か判定する。
 */
export function isAppColorPresetId(value: string): value is AppColorPresetId {
  return APP_COLOR_PRESETS.some((preset) => preset.id === value);
}
