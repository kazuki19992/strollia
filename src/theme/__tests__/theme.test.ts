import { darkTheme, getAppTheme, isAppThemePreference, lightTheme } from '../theme';

describe('テーマ選択 getAppTheme', () => {
  it('画面のデフォルト背景は設定画面と同じニュートラルな背景色にする', () => {
    expect(lightTheme.colors.background).toBe('#ffffff');
    expect(darkTheme.colors.background).toBe('#202020');
  });

  it('日別ルートと共有ボタンの色はテーマトークンとして持つ', () => {
    expect(lightTheme.colors.routeMapEmptyBackground).toBe('#172b63');
    expect(darkTheme.colors.routeMapEmptyBackground).toBe('#142d5c');
    expect(lightTheme.colors.routeMapEmptyText).toBe('#ffffff');
    expect(darkTheme.colors.routeMapEmptyText).toBe('#ffffff');
    expect(lightTheme.colors.shareButtonBackground).toBe('#333333');
    expect(darkTheme.colors.shareButtonBackground).toBe('#f7f2ea');
    expect(lightTheme.colors.shareButtonText).toBe('#ffffff');
    expect(darkTheme.colors.shareButtonText).toBe('#111111');
  });

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
