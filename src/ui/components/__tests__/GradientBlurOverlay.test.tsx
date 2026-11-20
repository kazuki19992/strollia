import { render, screen } from '@testing-library/react-native';

import { GradientBlurOverlay } from '@/ui/components/GradientBlurOverlay';

jest.mock('expo-blur', () => ({
  BlurView: require('react-native').View,
}));

/**
 * BlurViewをViewへモックしているため、intensity propを持つホスト要素をぼかしの帯として検索する
 * (RNTL v14 で UNSAFE_getAllByProps が廃止されたため、container からホスト要素を props で検索する)。
 */
function findBlurBands() {
  return screen.container.queryAll((node) => typeof node.props.intensity === 'number');
}

describe('グラデーション状のぼかし GradientBlurOverlay', () => {
  it('指定した本数の帯で上から下へ二次曲線で強さを上げ、その下を最大の強さ1枚で覆う', async () => {
    await render(<GradientBlurOverlay gradientHeight={40} gradientTop={20} maxIntensity={80} steps={4} tint="light" />);

    const bands = findBlurBands();
    // 弱いぼかしでも境目が目立つため、序盤はゆるやかに強める
    expect(bands.map((band) => band.props.intensity)).toEqual([5, 20, 45, 80, 80]);
    expect(bands.map((band) => band.props.style.top)).toEqual([20, 30, 40, 50, 60]);
    expect(bands[3].props.style.height).toBe(10);
    // 最後の1枚はグラデーションの帯より下を下端まで覆う
    expect(bands[4].props.style.bottom).toBe(0);
    expect(bands.every((band) => band.props.tint === 'light')).toBe(true);
  });

  it('既定では16本の帯と最大の強さ90で描画する', async () => {
    await render(<GradientBlurOverlay gradientHeight={80} gradientTop={0} tint="dark" />);

    const bands = findBlurBands();
    expect(bands).toHaveLength(17);
    expect(bands[bands.length - 1].props.intensity).toBe(90);
  });

  it('fadeColorを渡すと、ぼかしの上で背景色を段階的に濃くし、その下をmaxFadeOpacityで覆う', async () => {
    await render(
      <GradientBlurOverlay fadeColor="#ffffff" gradientHeight={40} gradientTop={20} maxFadeOpacity={0.8} steps={4} tint="light" />,
    );

    const fades = screen.container.queryAll((node) => node.props.style?.backgroundColor === '#ffffff');
    const expected = [0.2, 0.4, 0.6, 0.8, 0.8];
    fades.forEach((fade, index) => expect(fade.props.style.opacity).toBeCloseTo(expected[index]));
    expect(fades).toHaveLength(expected.length);
    expect(fades[4].props.style.bottom).toBe(0);
  });

  it('fadeColorを渡さなければ背景色の層は描画しない', async () => {
    await render(<GradientBlurOverlay gradientHeight={40} gradientTop={20} steps={4} tint="light" />);

    expect(screen.container.queryAll((node) => typeof node.props.style?.opacity === 'number')).toHaveLength(0);
  });

  it('ぼかし自体はタッチを受け付けない(pointerEvents=none)', async () => {
    await render(<GradientBlurOverlay gradientHeight={40} gradientTop={20} tint="light" />);

    expect(screen.container.queryAll((node) => node.props.pointerEvents === 'none').length).toBeGreaterThan(0);
  });
});
