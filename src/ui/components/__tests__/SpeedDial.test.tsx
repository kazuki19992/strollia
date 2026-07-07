import { Text } from 'react-native';

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

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;
const styles = createStyles(lightTheme);

describe('SpeedDial', () => {
  test('速度値をkm/h単位のテキストで描画する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(
        <SpeedDial currentSpeedKmh={42} progressPercent={50} scale={1} speedColor="#39d9ff" styles={styles} />,
      );
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).toContain('42');
    expect(texts).toContain('km/h');
  });

  test('progressPercent>0のときに速度リング円弧を描画する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(
        <SpeedDial currentSpeedKmh={15} progressPercent={50} scale={1} speedColor="#39d9ff" styles={styles} />,
      );
    });

    const arc = renderer.root.find((node: any) => node.props.testID === 'speed-meter-progress-arc');
    expect(arc).toBeTruthy();
    expect(arc.props.stroke).toBe('#39d9ff');
  });

  test('progressPercent=0のときに速度リング円弧を描画しない', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(
        <SpeedDial currentSpeedKmh={0} progressPercent={0} scale={1} speedColor="#aaaaaa" styles={styles} />,
      );
    });

    const arcs = renderer.root.findAll((node: any) => node.props.testID === 'speed-meter-progress-arc');
    expect(arcs.length).toBe(0);
  });

  test('小画面ではリング背景とSVGを同じ縮小倍率で描画する', () => {
    const scale = 0.9;
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(
        <SpeedDial currentSpeedKmh={10} progressPercent={30} scale={scale} speedColor="#39d9ff" styles={styles} />,
      );
    });

    const ringBase = renderer.root.find((node: any) => node.props.testID === 'speed-meter-ring-base');
    const arcSvg = renderer.root.find((node: any) => node.props.testID === 'speed-meter-arc-svg');

    const ringStyle = Array.isArray(ringBase.props.style) ? Object.assign({}, ...ringBase.props.style) : ringBase.props.style;
    const svgStyle = Array.isArray(arcSvg.props.style) ? Object.assign({}, ...arcSvg.props.style) : arcSvg.props.style;

    expect(ringStyle.width).toBeCloseTo(100 * scale, 0);
    expect(svgStyle.width).toBeCloseTo(104 * scale, 0);
  });

  test('allowFontScaling=falseで全テキストを固定フォントサイズにする', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(
        <SpeedDial currentSpeedKmh={5} progressPercent={10} scale={1} speedColor="#39d9ff" styles={styles} />,
      );
    });

    const textNodes = renderer.root.findAllByType(Text);
    expect(textNodes.every((node: any) => node.props.allowFontScaling === false)).toBe(true);
  });
});
