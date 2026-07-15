import { createStyles } from '@/ui/appStyles';
import { applyColorPreset, darkTheme, lightTheme } from '@/theme/theme';
import { getAppColorPreset } from '@/features/customization/colorPresets';

describe('カスタムアイコン画像スタイル', () => {
  it('customUserLocationMarkerImageスタイルを持つ', () => {
    const styles = createStyles(lightTheme);
    expect(styles.customUserLocationMarkerImage).toBeDefined();
  });

  it('customUserLocationMarkerImageは正方形かつborderRadius:999である', () => {
    const styles = createStyles(lightTheme);
    expect(styles.customUserLocationMarkerImage.width).toBe(42);
    expect(styles.customUserLocationMarkerImage.height).toBe(42);
    expect(styles.customUserLocationMarkerImage.borderRadius).toBe(999);
  });
});

describe('Plusバッジの色', () => {
  it('プリセットを変更してもライトモードでは常にまっちゃ色を使う', () => {
    const tomatoTheme = applyColorPreset(lightTheme, getAppColorPreset('tomato'));
    const styles = createStyles(tomatoTheme);
    expect(styles.settingsPlusBadge.backgroundColor).toBe('#1f7a5c');
  });

  it('プリセットを変更してもダークモードでは常にまっちゃ色を使う', () => {
    const tomatoTheme = applyColorPreset(darkTheme, getAppColorPreset('tomato'));
    const styles = createStyles(tomatoTheme);
    expect(styles.settingsPlusBadge.backgroundColor).toBe('#73c7a2');
  });

  it('文字色はまっちゃプリセットのprimaryTextを使う', () => {
    const lightStyles = createStyles(applyColorPreset(lightTheme, getAppColorPreset('tomato')));
    const darkStyles = createStyles(applyColorPreset(darkTheme, getAppColorPreset('tomato')));
    expect(lightStyles.settingsPlusBadge.color).toBe('#fffdf8');
    expect(darkStyles.settingsPlusBadge.color).toBe('#102018');
  });
});
