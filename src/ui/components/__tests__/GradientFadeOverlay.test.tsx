import { render, screen } from '@testing-library/react-native';

import { GradientFadeOverlay } from '@/ui/components/GradientFadeOverlay';

/** 指定色で塗った帯(ホスト要素)を上から順に取得する。 */
function findFadeBands(color: string) {
  return screen.container.queryAll((node) => node.props.style?.backgroundColor === color);
}

describe('背景色のグラデーション GradientFadeOverlay', () => {
  it('指定した本数の帯で上から下へ不透明度を段階的に上げ、その下をmaxOpacityで覆う', async () => {
    await render(<GradientFadeOverlay color="#ffffff" gradientHeight={40} gradientTop={20} maxOpacity={0.8} steps={4} />);

    const bands = findFadeBands('#ffffff');
    const expected = [0.2, 0.4, 0.6, 0.8, 0.8];
    expect(bands).toHaveLength(expected.length);
    bands.forEach((band, index) => expect(band.props.style.opacity).toBeCloseTo(expected[index]));
    expect(bands.map((band) => band.props.style.top)).toEqual([20, 30, 40, 50, 60]);
    expect(bands[3].props.style.height).toBe(10);
    // 最後の1枚はグラデーションの帯より下を下端まで覆う
    expect(bands[4].props.style.bottom).toBe(0);
  });

  it('既定では16本の帯で描画し、下端とその下を不透明度1で完全に覆う', async () => {
    await render(<GradientFadeOverlay color="#202020" gradientHeight={80} gradientTop={0} />);

    const bands = findFadeBands('#202020');
    expect(bands).toHaveLength(17);
    expect(bands[bands.length - 2].props.style.opacity).toBe(1);
    expect(bands[bands.length - 1].props.style.opacity).toBe(1);
  });

  it('ぼかしは使わない(BlurViewのintensityを持つ要素を描画しない)', async () => {
    await render(<GradientFadeOverlay color="#ffffff" gradientHeight={40} gradientTop={0} />);

    expect(screen.container.queryAll((node) => node.props.intensity !== undefined)).toHaveLength(0);
  });

  it('重ねた色自体はタッチを受け付けない(pointerEvents=none)', async () => {
    await render(<GradientFadeOverlay color="#ffffff" gradientHeight={40} gradientTop={0} />);

    expect(screen.container.queryAll((node) => node.props.pointerEvents === 'none').length).toBeGreaterThan(0);
  });
});
