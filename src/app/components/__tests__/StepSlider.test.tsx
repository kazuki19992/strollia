import { PanResponder, Text, View } from 'react-native';

import { lightTheme } from '../../../theme/theme';
import { normalizeValue, StepSlider } from '../StepSlider';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

const styles = new Proxy({}, { get: (_target, prop) => prop });

const defaultProps = {
  accessibilityLabel: '移動地図の表示時刻',
  minValue: 0,
  maxValue: 1440,
  stepValue: 30,
  startLabel: '0時',
  endLabel: '24時',
  value: 720,
  valueLabel: '12:00',
  styles: styles as never,
  theme: lightTheme,
};

describe('ステップスライダー StepSlider', () => {
  it('値を指定範囲内のステップへ丸める', () => {
    expect(normalizeValue(44, 0, 1440, 30)).toBe(30);
    expect(normalizeValue(46, 0, 1440, 30)).toBe(60);
    expect(normalizeValue(-10, 0, 1440, 30)).toBe(0);
    expect(normalizeValue(1460, 0, 1440, 30)).toBe(1440);
  });

  it('端ラベルと現在値ラベルを表示する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(
        <StepSlider {...defaultProps} onValueChange={jest.fn()} />,
      );
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).toEqual(expect.arrayContaining(['0時', '24時', '12:00']));
  });

  it('onLayout を持つタッチエリアを純粋 JS 実装として描画する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(
        <StepSlider {...defaultProps} onValueChange={jest.fn()} />,
      );
    });

    const touchArea = renderer.root.findAll(
      (node: any) => node.type === View && typeof node.props.onLayout === 'function',
    )[0];
    expect(touchArea).toBeTruthy();
  });

  describe('ジェスチャー操作とアクセシビリティ', () => {
    let capturedConfig: any = null;

    beforeEach(() => {
      capturedConfig = null;
      jest.spyOn(PanResponder, 'create').mockImplementation((config: any) => {
        capturedConfig = config;
        return { panHandlers: {} } as any;
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('ドラッグで onValueChange がステップ単位で呼ばれる', () => {
      const onValueChange = jest.fn();
      let renderer: any;

      act(() => {
        renderer = ReactTestRenderer.create(
          <StepSlider {...defaultProps} value={720} onValueChange={onValueChange} />,
        );
      });

      // trackWidth を 300px に設定
      const touchArea = renderer.root.findAll(
        (node: any) => node.type === View && typeof node.props.onLayout === 'function',
      )[0];
      act(() => {
        touchArea.props.onLayout({ nativeEvent: { layout: { width: 300 } } });
      });

      // ドラッグ開始: dragStartXRef = (720/1440) * 300 = 150
      act(() => {
        capturedConfig?.onPanResponderGrant?.({});
      });

      // 50px 右にドラッグ: (150+50)/300 * 1440 = 960
      act(() => {
        capturedConfig?.onPanResponderMove?.({}, { dx: 50 });
      });

      expect(onValueChange).toHaveBeenCalledWith(960);
    });

    it('ドラッグ開始・終了で onDragStart / onDragEnd が呼ばれる', () => {
      const onDragStart = jest.fn();
      const onDragEnd = jest.fn();
      let renderer: any;

      act(() => {
        renderer = ReactTestRenderer.create(
          <StepSlider {...defaultProps} onDragStart={onDragStart} onDragEnd={onDragEnd} onValueChange={jest.fn()} />,
        );
      });

      act(() => {
        capturedConfig?.onPanResponderGrant?.({});
      });
      expect(onDragStart).toHaveBeenCalledTimes(1);

      act(() => {
        capturedConfig?.onPanResponderRelease?.();
      });
      expect(onDragEnd).toHaveBeenCalledTimes(1);
    });

    it('adjustable ロールに increment/decrement accessibilityActions と現在値を宣言する', () => {
      let renderer: any;

      act(() => {
        renderer = ReactTestRenderer.create(
          <StepSlider {...defaultProps} value={720} onValueChange={jest.fn()} />,
        );
      });

      // accessibilityRole="adjustable" の View を探す（onAccessibilityAction は RN が
      // ネイティブレベルで処理するためテストレンダラーの props には現れない）
      const touchArea = renderer.root.findAll(
        (node: any) => node.type === View && node.props.accessibilityRole === 'adjustable',
      )[0];

      expect(touchArea).toBeTruthy();
      expect(touchArea.props.accessibilityActions).toEqual([
        { name: 'increment' },
        { name: 'decrement' },
      ]);
      expect(touchArea.props.accessibilityValue).toEqual({
        min: 0,
        max: 1440,
        now: 720,
        text: '12:00',
      });
    });
  });
});
