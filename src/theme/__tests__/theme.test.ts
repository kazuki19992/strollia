import { applyColorPreset, darkTheme, getAppTheme, isAppThemePreference, lightTheme } from '@/theme/theme';
import { getAppColorPreset } from '@/features/customization/colorPresets';

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
    expect(darkTheme.colors.shareButtonBackground).toBe('#f0f0f0');
    expect(lightTheme.colors.shareButtonText).toBe('#ffffff');
    expect(darkTheme.colors.shareButtonText).toBe('#111111');
  });

  it('カード・境界・文字色は無彩色トークンを使う', () => {
    expect(lightTheme.colors.card).toBe('#f8f8f8');
    expect(lightTheme.colors.cardStrong).toBe('#f0f0f0');
    expect(lightTheme.colors.text).toBe('#1a1a1a');
    expect(lightTheme.colors.mutedText).toBe('#666666');
    expect(lightTheme.colors.border).toBe('#e0e0e0');
    expect(lightTheme.colors.surfaceOverlay).toBe('rgba(248, 248, 248, 0.94)');
    expect(lightTheme.colors.scrim).toBe('rgba(0, 0, 0, 0.08)');
    expect(lightTheme.colors.shadow).toBe('#000000');

    expect(darkTheme.colors.card).toBe('#252525');
    expect(darkTheme.colors.cardStrong).toBe('#2e2e2e');
    expect(darkTheme.colors.text).toBe('#f0f0f0');
    expect(darkTheme.colors.mutedText).toBe('#999999');
    expect(darkTheme.colors.border).toBe('#3a3a3a');
    expect(darkTheme.colors.surfaceOverlay).toBe('rgba(37, 37, 37, 0.94)');
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

describe('テーマへのプリセット適用 applyColorPreset', () => {
  it('lightThemeにまっちゃ以外のプリセットを適用するとprimaryが変わる', () => {
    const preset = getAppColorPreset('tomato');
    const applied = applyColorPreset(lightTheme, preset);
    expect(applied.colors.primary).toBe('#b02020');
    expect(applied.colors.primaryText).toBe('#ffffff');
    expect(applied.colors.mapLine).toBe('#b02020');
  });

  it('darkThemeにプリセットを適用するとdark色が使われる', () => {
    const preset = getAppColorPreset('tomato');
    const applied = applyColorPreset(darkTheme, preset);
    expect(applied.colors.primary).toBe('#f06060');
  });

  it('applyColorPresetは元のテーマを変更しない', () => {
    const preset = getAppColorPreset('umi');
    applyColorPreset(lightTheme, preset);
    expect(lightTheme.colors.primary).toBe('#1f7a5c');
  });

  it('まっちゃを適用するとデフォルトのprimary色になる', () => {
    const preset = getAppColorPreset('matcha');
    const applied = applyColorPreset(lightTheme, preset);
    expect(applied.colors.primary).toBe('#1f7a5c');
  });
});
