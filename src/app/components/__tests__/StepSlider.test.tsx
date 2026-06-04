import { Text, View } from 'react-native';

import { lightTheme } from '../../../theme/theme';
import { normalizeValue, StepSlider } from '../StepSlider';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

const styles = new Proxy({}, { get: (_target, prop) => prop });

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
        <StepSlider
          accessibilityLabel="移動地図の表示時刻"
          minValue={0}
          maxValue={1440}
          stepValue={30}
          startLabel="0時"
          endLabel="24時"
          value={720}
          valueLabel="12:00"
          styles={styles as never}
          theme={lightTheme}
          onValueChange={jest.fn()}
        />,
      );
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).toEqual(expect.arrayContaining(['0時', '24時', '12:00']));
  });

  it('onLayout を持つタッチエリアを純粋 JS 実装として描画する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(
        <StepSlider
          accessibilityLabel="移動地図の表示時刻"
          minValue={0}
          maxValue={1440}
          stepValue={30}
          startLabel="0時"
          endLabel="24時"
          value={720}
          valueLabel="12:00"
          styles={styles as never}
          theme={lightTheme}
          onValueChange={jest.fn()}
        />,
      );
    });

    const touchArea = renderer.root.findAll(
      (node: any) => node.type === View && typeof node.props.onLayout === 'function',
    )[0];
    expect(touchArea).toBeTruthy();
  });
});
