import { render, screen } from '@testing-library/react-native';

import { createStyles } from '@/ui/appStyles';
import { lightTheme } from '@/theme/theme';
import { SpeedDial } from '@/ui/components/SpeedDial';

jest.mock('react-native-svg', () => {
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: View,
    Circle: View,
  };
});

const styles = createStyles(lightTheme);

describe('SpeedDial', () => {
  test('速度値をkm/h単位のテキストで描画する', async () => {
    await render(<SpeedDial currentSpeedKmh={42} progressPercent={50} scale={1} speedColor="#39d9ff" styles={styles} />);

    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('km/h')).toBeTruthy();
  });

  test('progressPercent>0のときに速度リング円弧を描画する', async () => {
    await render(<SpeedDial currentSpeedKmh={15} progressPercent={50} scale={1} speedColor="#39d9ff" styles={styles} />);

    // testID で速度リング円弧を検索する
    // stroke など非セマンティックな props を検証するため testID で取得する(SVG はアクセシビリティ非表示のため hidden 要素も含める)
    const arcs = screen.getAllByTestId('speed-meter-progress-arc', { includeHiddenElements: true });
    expect(arcs.length).toBeGreaterThan(0);
    expect(arcs[0].props.stroke).toBe('#39d9ff');
  });

  test('progressPercent=0のときに速度リング円弧を描画しない', async () => {
    await render(<SpeedDial currentSpeedKmh={0} progressPercent={0} scale={1} speedColor="#aaaaaa" styles={styles} />);

    // progressPercent=0のとき円弧要素が存在しないことを確認する(queryAllは見つからなければ空配列を返す)
    expect(screen.queryAllByTestId('speed-meter-progress-arc', { includeHiddenElements: true })).toHaveLength(0);
  });

  test('小画面ではリング背景とSVGを同じ縮小倍率で描画する', async () => {
    const scale = 0.9;
    await render(<SpeedDial currentSpeedKmh={10} progressPercent={30} scale={scale} speedColor="#39d9ff" styles={styles} />);

    const ringBase = screen.getAllByTestId('speed-meter-ring-base')[0];
    const arcSvg = screen.getAllByTestId('speed-meter-arc-svg', { includeHiddenElements: true })[0];
    expect(ringBase).toBeTruthy();
    expect(arcSvg).toBeTruthy();

    const ringStyle = Array.isArray(ringBase.props.style) ? Object.assign({}, ...ringBase.props.style) : ringBase.props.style;
    const svgStyle = Array.isArray(arcSvg.props.style) ? Object.assign({}, ...arcSvg.props.style) : arcSvg.props.style;

    expect(ringStyle.width).toBeCloseTo(100 * scale, 0);
    expect(svgStyle.width).toBeCloseTo(104 * scale, 0);
  });

  test('allowFontScaling=falseで全テキストを固定フォントサイズにする', async () => {
    await render(<SpeedDial currentSpeedKmh={5} progressPercent={10} scale={1} speedColor="#39d9ff" styles={styles} />);

    // allowFontScaling という非セマンティックな props の検証のため Text ホスト要素を走査する
    const textNodes = screen.container.queryAll((node) => node.type === 'Text');
    expect(textNodes.length).toBeGreaterThan(0);
    expect(textNodes.every((node) => node.props.allowFontScaling === false)).toBe(true);
  });
});
