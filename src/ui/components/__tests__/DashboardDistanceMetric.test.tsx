import { Text } from 'react-native';

import { createStyles } from '@/ui/appStyles';
import { lightTheme } from '@/theme/theme';
import { DashboardDistanceMetric } from '@/ui/components/DashboardDistanceMetric';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;
const styles = createStyles(lightTheme);

describe('DashboardDistanceMetric', () => {
  test('ODOラベルとdashboardOdometerMetricスタイルで描画する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<DashboardDistanceMetric label="ODO" parts={['1234', '56']} scale={1} styles={styles} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).toContain('ODO');
    expect(texts).toContain('1234');
    expect(texts).toContain('56');

    // ODOスタイルが適用されているコンテナを確認する
    const container = renderer.root.findAll(
      (node: any) => Array.isArray(node.props.style) && node.props.style.includes(styles.dashboardOdometerMetric),
    );
    expect(container.length).toBeGreaterThan(0);
  });

  test('TODAYラベルとdashboardTodayMetricスタイルで描画する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<DashboardDistanceMetric label="TODAY" parts={['9876', '54']} scale={1} styles={styles} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).toContain('TODAY');
    expect(texts).toContain('9876');
    expect(texts).toContain('54');

    const container = renderer.root.findAll(
      (node: any) => Array.isArray(node.props.style) && node.props.style.includes(styles.dashboardTodayMetric),
    );
    expect(container.length).toBeGreaterThan(0);
  });

  test('allowFontScaling=falseで全テキストを固定フォントサイズにする', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<DashboardDistanceMetric label="ODO" parts={['0', '00']} scale={1} styles={styles} />);
    });

    const textNodes = renderer.root.findAllByType(Text);
    expect(textNodes.every((node: any) => node.props.allowFontScaling === false)).toBe(true);
  });
});
