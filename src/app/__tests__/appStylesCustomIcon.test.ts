import { createStyles } from '../appStyles';
import { lightTheme } from '../../theme/theme';

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
