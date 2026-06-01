import { darkTheme, getAppTheme, isAppThemePreference, lightTheme } from '../theme';

describe('テーマ選択 getAppTheme', () => {
  it('OSがダークモードでない場合はライトテーマを返す', () => {
    expect(getAppTheme('light')).toBe(lightTheme);
    expect(getAppTheme(null)).toBe(lightTheme);
  });

  it('OSがダークモードの場合はダークテーマを返す', () => {
    expect(getAppTheme('dark')).toBe(darkTheme);
  });

  it('ライト固定設定の場合はOS設定に関係なくライトテーマを返す', () => {
    expect(getAppTheme('dark', 'light')).toBe(lightTheme);
  });

  it('ダーク固定設定の場合はOS設定に関係なくダークテーマを返す', () => {
    expect(getAppTheme('light', 'dark')).toBe(darkTheme);
  });
});

describe('テーマ設定判定 isAppThemePreference', () => {
  it('保存可能なテーマ設定だけをtrueにする', () => {
    expect(isAppThemePreference('system')).toBe(true);
    expect(isAppThemePreference('light')).toBe(true);
    expect(isAppThemePreference('dark')).toBe(true);
    expect(isAppThemePreference('broken')).toBe(false);
  });
});
