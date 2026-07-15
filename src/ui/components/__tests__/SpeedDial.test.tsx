import { Text } from 'react-native';
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
  test('速度値をkm/h単位のテキストで描画する', () => {
    render(<SpeedDial currentSpeedKmh={42} progressPercent={50} scale={1} speedColor="#39d9ff" styles={styles} />);

    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('km/h')).toBeTruthy();
  });

  test('progressPercent>0のときに速度リング円弧を描画する', () => {
    render(<SpeedDial currentSpeedKmh={15} progressPercent={50} scale={1} speedColor="#39d9ff" styles={styles} />);

    // testID で速度リング円弧を検索する
    // RTL のセマンティッククエリで testID を持つ SVG 要素を直接取得できないため UNSAFE を使う
    const arcs = screen.UNSAFE_getAllByProps({ testID: 'speed-meter-progress-arc' });
    expect(arcs.length).toBeGreaterThan(0);
    expect(arcs[0].props.stroke).toBe('#39d9ff');
  });

  test('progressPercent=0のときに速度リング円弧を描画しない', () => {
    render(<SpeedDial currentSpeedKmh={0} progressPercent={0} scale={1} speedColor="#aaaaaa" styles={styles} />);

    // progressPercent=0のとき円弧要素が存在しないことを確認する(queryAllは見つからなければ空配列を返す)
    expect(screen.UNSAFE_queryAllByProps({ testID: 'speed-meter-progress-arc' })).toHaveLength(0);
  });

  test('小画面ではリング背景とSVGを同じ縮小倍率で描画する', () => {
    const scale = 0.9;
    render(<SpeedDial currentSpeedKmh={10} progressPercent={30} scale={scale} speedColor="#39d9ff" styles={styles} />);

    const ringBase = screen.UNSAFE_getAllByProps({ testID: 'speed-meter-ring-base' })[0];
    const arcSvg = screen.UNSAFE_getAllByProps({ testID: 'speed-meter-arc-svg' })[0];
    expect(ringBase).toBeTruthy();
    expect(arcSvg).toBeTruthy();

    const ringStyle = Array.isArray(ringBase.props.style) ? Object.assign({}, ...ringBase.props.style) : ringBase.props.style;
    const svgStyle = Array.isArray(arcSvg.props.style) ? Object.assign({}, ...arcSvg.props.style) : arcSvg.props.style;

    expect(ringStyle.width).toBeCloseTo(100 * scale, 0);
    expect(svgStyle.width).toBeCloseTo(104 * scale, 0);
  });

  test('allowFontScaling=falseで全テキストを固定フォントサイズにする', () => {
    render(<SpeedDial currentSpeedKmh={5} progressPercent={10} scale={1} speedColor="#39d9ff" styles={styles} />);

    // allowFontScaling という非セマンティックな props の検証のため UNSAFE_getAllByType を使う
    const textNodes = screen.UNSAFE_getAllByType(Text);
    expect(textNodes.every((node) => node.props.allowFontScaling === false)).toBe(true);
  });
});
