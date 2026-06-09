import {
  APP_COLOR_PRESETS,
  DEFAULT_APP_COLOR_PRESET_ID,
  getAppColorPreset,
  isAppColorPresetId,
} from '../colorPresets';

describe('アプリカラープリセット colorPresets', () => {
  it('デフォルトIDはまっちゃ', () => {
    expect(DEFAULT_APP_COLOR_PRESET_ID).toBe('matcha');
  });

  it('12色のプリセットを持つ', () => {
    expect(APP_COLOR_PRESETS).toHaveLength(12);
  });

  it('まっちゃはlightThemeのprimary色を維持する', () => {
    const preset = getAppColorPreset('matcha');
    expect(preset.light.primary).toBe('#1f7a5c');
    expect(preset.dark.primary).toBe('#73c7a2');
  });

  it('未知IDはまっちゃへフォールバックする', () => {
    expect(getAppColorPreset('unknown' as never)).toEqual(expect.objectContaining({ id: 'matcha' }));
  });

  it('全プリセットがlight・dark両方の色を持つ', () => {
    for (const preset of APP_COLOR_PRESETS) {
      expect(preset.light.primary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(preset.light.primaryText).toMatch(/^#[0-9a-f]{6}$/i);
      expect(preset.light.mapLine).toMatch(/^#[0-9a-f]{6}$/i);
      expect(preset.dark.primary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(preset.dark.primaryText).toMatch(/^#[0-9a-f]{6}$/i);
      expect(preset.dark.mapLine).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('isAppColorPresetIdは有効なIDでtrueを返す', () => {
    expect(isAppColorPresetId('matcha')).toBe(true);
    expect(isAppColorPresetId('tomato')).toBe(true);
  });

  it('isAppColorPresetIdは無効な文字列でfalseを返す', () => {
    expect(isAppColorPresetId('unknown')).toBe(false);
    expect(isAppColorPresetId('')).toBe(false);
  });

  it('有効なIDを渡すと対応するプリセット全体を返す', () => {
    expect(getAppColorPreset('tomato')).toEqual(expect.objectContaining({
      id: 'tomato',
      label: 'トマト',
    }));
  });
});
