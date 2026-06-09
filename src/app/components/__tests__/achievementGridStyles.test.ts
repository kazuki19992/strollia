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

    expect(styles.achievementTileImageWrap.backgroundColor).toBeUndefined();
    expect(styles.achievementTileImageWrap.borderWidth).toBeUndefined();
  });

  test('次の実績スタイルはグレースケールフィルタと薄い不透明度を持つ', () => {
    const styles = createStyles(lightTheme);

    expect(styles.achievementTileImageNext.filter).toEqual([{ grayscale: 1 }]);
    expect(styles.achievementTileImageNext.opacity).toBeLessThan(1);
  });
});
