import { render, screen } from '@testing-library/react-native';

import { AppProgressBar } from '@/ui/components/AppProgressBar';
import { createStyles } from '@/ui/appStyles';
import { lightTheme } from '@/theme/theme';

/** テスト用のライトテーマとスタイル。 */
const theme = lightTheme;
const styles = createStyles(theme);

describe('汎用プログレスバー AppProgressBar', () => {
  it('割合に応じた幅で塗りを描画する', () => {
    render(<AppProgressBar ratio={0.75} styles={styles} theme={theme} accessibilityLabel="日本三名瀑の進捗" />);

    // 進捗バーは accessibilityValue で割合を公開する
    const bar = screen.getByLabelText('日本三名瀑の進捗');
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 75 });
  });

  it('範囲外の割合は0〜1へ丸める', () => {
    render(<AppProgressBar ratio={1.4} styles={styles} theme={theme} accessibilityLabel="進捗" />);

    expect(screen.getByLabelText('進捗').props.accessibilityValue.now).toBe(100);
  });

  it('不正な割合は0として扱う', () => {
    render(<AppProgressBar ratio={Number.NaN} styles={styles} theme={theme} accessibilityLabel="進捗" />);

    expect(screen.getByLabelText('進捗').props.accessibilityValue.now).toBe(0);
  });
});
