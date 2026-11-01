import { PanResponder } from 'react-native';
import { render, screen, act } from '@testing-library/react-native';

import { lightTheme } from '@/theme/theme';
import { normalizeValue, StepSlider } from '@/ui/components/StepSlider';

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

  it('端ラベルと現在値ラベルを表示する', async () => {
    await render(<StepSlider {...defaultProps} onValueChange={jest.fn()} />);

    expect(screen.getByText('0時')).toBeTruthy();
    expect(screen.getByText('24時')).toBeTruthy();
    expect(screen.getByText('12:00')).toBeTruthy();
  });

  it('onLayout を持つタッチエリアを純粋 JS 実装として描画する', async () => {
    await render(<StepSlider {...defaultProps} onValueChange={jest.fn()} />);

    // onLayout を持つ View を container.queryAll で探す
    // 純粋JS実装のタッチエリア検証には非セマンティックな props 検索が必要なため
    const touchArea = screen.container.queryAll((node) => node.type === 'View' && typeof node.props.onLayout === 'function')[0];
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

    it('ドラッグで onValueChange がステップ単位で呼ばれる', async () => {
      const onValueChange = jest.fn();
      await render(<StepSlider {...defaultProps} value={720} onValueChange={onValueChange} />);

      // trackWidth を 300px に設定
      const touchArea = screen.container.queryAll((node) => node.type === 'View' && typeof node.props.onLayout === 'function')[0];
      await act(() => {
        touchArea!.props.onLayout({ nativeEvent: { layout: { width: 300 } } });
      });

      // ドラッグ開始: dragStartXRef = (720/1440) * 300 = 150
      await act(() => {
        capturedConfig?.onPanResponderGrant?.({});
      });

      // 50px 右にドラッグ: (150+50)/300 * 1440 = 960
      await act(() => {
        capturedConfig?.onPanResponderMove?.({}, { dx: 50 });
      });

      expect(onValueChange).toHaveBeenCalledWith(960);
    });

    it('ドラッグ開始・終了で onDragStart / onDragEnd が呼ばれる', async () => {
      const onDragStart = jest.fn();
      const onDragEnd = jest.fn();
      await render(<StepSlider {...defaultProps} onDragStart={onDragStart} onDragEnd={onDragEnd} onValueChange={jest.fn()} />);

      await act(() => {
        capturedConfig?.onPanResponderGrant?.({});
      });
      expect(onDragStart).toHaveBeenCalledTimes(1);

      await act(() => {
        capturedConfig?.onPanResponderRelease?.();
      });
      expect(onDragEnd).toHaveBeenCalledTimes(1);
    });

    it('adjustable ロールに increment/decrement accessibilityActions と現在値を宣言する', async () => {
      await render(<StepSlider {...defaultProps} value={720} onValueChange={jest.fn()} />);

      // accessibilityRole="adjustable" の View を探す
      // onAccessibilityAction は RN がネイティブレベルで処理するためテストレンダラーの props には現れない
      // container.queryAll を使うのは accessibilityRole という props でフィルタリングが必要なため
      const touchArea = screen.container.queryAll((node) => node.type === 'View' && node.props.accessibilityRole === 'adjustable')[0];

      expect(touchArea).toBeTruthy();
      expect(touchArea!.props.accessibilityActions).toEqual([{ name: 'increment' }, { name: 'decrement' }]);
      expect(touchArea!.props.accessibilityValue).toEqual({
        min: 0,
        max: 1440,
        now: 720,
        text: '12:00',
      });
    });
  });
});
