import { createStyles } from '../../appStyles';
import { lightTheme } from '../../../theme/theme';

describe('実績グリッドのスタイル', () => {
  test('グリッドタイルとグレースケール用スタイルを持つ', () => {
    const styles = createStyles(lightTheme);

    expect(styles.achievementGridTile).toBeDefined();
    expect(styles.achievementTileImageWrap).toBeDefined();
    expect(styles.achievementTileImage).toBeDefined();
    expect(styles.achievementTileImageNext).toBeDefined();
    expect(styles.achievementTileTitle).toBeDefined();
    expect(styles.achievementTileProgress).toBeDefined();
    expect(styles.achievementDialogDate).toBeDefined();
    expect(styles.achievementDialogShareButton).toBeDefined();
    expect(styles.achievementDialogShareButtonText).toBeDefined();
  });

  test('画像の枠はカード背景・境界線を持たない', () => {
    const styles = createStyles(lightTheme);
    const imageWrapStyle = styles.achievementTileImageWrap as Record<string, unknown>;

    expect(imageWrapStyle.backgroundColor).toBeUndefined();
    expect(imageWrapStyle.borderWidth).toBeUndefined();
  });

  test('次の実績スタイルは薄い不透明度を持つ（脱色は Grayscale ラッパーで行う）', () => {
    const styles = createStyles(lightTheme);

    expect(styles.achievementTileImageNext.opacity).toBeLessThan(1);
  });
});
