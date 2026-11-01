import { render, screen } from '@testing-library/react-native';

import { createStyles } from '@/ui/appStyles';
import { lightTheme } from '@/theme/theme';
import { DashboardDistanceMetric } from '@/ui/components/DashboardDistanceMetric';

const styles = createStyles(lightTheme);

describe('DashboardDistanceMetric', () => {
  test('ODOラベルとdashboardOdometerMetricスタイルで描画する', async () => {
    await render(<DashboardDistanceMetric label="ODO" parts={['1234', '56']} scale={1} styles={styles} />);

    expect(screen.getByText('ODO')).toBeTruthy();
    expect(screen.getByText('1234')).toBeTruthy();
    expect(screen.getByText('56')).toBeTruthy();

    // ODOスタイルが適用されているコンテナを確認する
    // スタイル配列にスタイルオブジェクトが含まれているかはホスト要素を走査して検証する
    const container = screen.container
      .queryAll(() => true)
      .find((node) => Array.isArray(node.props.style) && node.props.style.includes(styles.dashboardOdometerMetric));
    expect(container).toBeTruthy();
  });

  test('TODAYラベルとdashboardTodayMetricスタイルで描画する', async () => {
    await render(<DashboardDistanceMetric label="TODAY" parts={['9876', '54']} scale={1} styles={styles} />);

    expect(screen.getByText('TODAY')).toBeTruthy();
    expect(screen.getByText('9876')).toBeTruthy();
    expect(screen.getByText('54')).toBeTruthy();

    // TODAYスタイルが適用されているコンテナを確認する
    const container = screen.container
      .queryAll(() => true)
      .find((node) => Array.isArray(node.props.style) && node.props.style.includes(styles.dashboardTodayMetric));
    expect(container).toBeTruthy();
  });

  test('allowFontScaling=falseで全テキストを固定フォントサイズにする', async () => {
    await render(<DashboardDistanceMetric label="ODO" parts={['0', '00']} scale={1} styles={styles} />);

    // allowFontScaling=false を持つ Text ノードを全て取得して確認する
    // allowFontScaling という非セマンティックな props の検証のため Text ホスト要素を走査する
    const textNodes = screen.container.queryAll((node) => node.type === 'Text');
    expect(textNodes.length).toBeGreaterThan(0);
    expect(textNodes.every((node) => node.props.allowFontScaling === false)).toBe(true);
  });
});
