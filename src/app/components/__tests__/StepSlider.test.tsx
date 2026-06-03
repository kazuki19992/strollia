import { Text } from 'react-native';

import { lightTheme } from '../../../theme/theme';
import { normalizeValue, StepSlider } from '../StepSlider';

jest.mock('@react-native-community/slider', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: View,
  };
});

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

  it('ネイティブSliderへ30分刻みと現在時刻ラベルを渡す', () => {
    const onValueChange = jest.fn();
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
          valueLabel="12時"
          styles={styles as never}
          theme={lightTheme}
          onValueChange={onValueChange}
        />,
      );
    });

    const nativeSlider = renderer.root.findByProps({ minimumValue: 0, maximumValue: 1440 });
    expect(nativeSlider.props.step).toBe(30);
    expect(nativeSlider.props.value).toBe(720);
    expect(renderer.root.findAllByType(Text).map((node: any) => node.props.children)).toEqual(expect.arrayContaining(['0時', '12時', '24時']));

    act(() => {
      nativeSlider.props.onValueChange(751);
    });

    expect(onValueChange).toHaveBeenCalledWith(750);
  });
});
