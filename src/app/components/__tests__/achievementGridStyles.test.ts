import { createStyles } from '../../appStyles';
import { darkTheme, lightTheme } from '../../../theme/theme';

describe('実績グリッドのスタイル', () => {
  test('グリッドタイルとシルエット/グレースケール用スタイルを持つ', () => {
    const styles = createStyles(lightTheme);

    expect(styles.achievementGridTile).toBeDefined();
    expect(styles.achievementTileImageWrap).toBeDefined();
    expect(styles.achievementTileImage).toBeDefined();
    expect(styles.achievementTileGrayscaleOverlay).toBeDefined();
    expect(styles.achievementTileTitle).toBeDefined();
    expect(styles.achievementTileProgress).toBeDefined();
    expect(styles.achievementDialogDate).toBeDefined();
    expect(styles.achievementDialogShareButton).toBeDefined();
    expect(styles.achievementDialogShareButtonText).toBeDefined();
  });

  test('グレースケールオーバーレイはライト/ダークで色が異なる', () => {
    const light = createStyles(lightTheme);
    const dark = createStyles(darkTheme);

    expect(light.achievementTileGrayscaleOverlay.backgroundColor).toBe('rgba(255, 255, 255, 0.55)');
    expect(dark.achievementTileGrayscaleOverlay.backgroundColor).toBe('rgba(0, 0, 0, 0.55)');
  });
});
