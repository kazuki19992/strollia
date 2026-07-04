import { Animated, Text } from 'react-native';

import { MonthlyReportAnimatedCard } from '@/app/components/reports/MonthlyReportAnimatedCard';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

describe('月次レポート出現カード MonthlyReportAnimatedCard', () => {
  it('forceVisible=trueの場合はスクロール位置に関係なく表示状態にする', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(
        <MonthlyReportAnimatedCard scrollY={new Animated.Value(0)} viewportHeight={800} forceVisible>
          <Text>カード</Text>
        </MonthlyReportAnimatedCard>,
      );
    });

    const style = renderer.root.findByType(Animated.View).props.style;
    expect(style[2]).toEqual({ opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] });
  });

  it('forceVisible=falseの場合はレイアウト位置に応じた補間範囲を使う', () => {
    const scrollY = new Animated.Value(0);
    const interpolate = jest.spyOn(scrollY, 'interpolate');
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(
        <MonthlyReportAnimatedCard scrollY={scrollY} viewportHeight={800}>
          <Text>カード</Text>
        </MonthlyReportAnimatedCard>,
      );
    });

    const card = renderer.root.findByType(Animated.View);
    act(() => {
      card.props.onLayout({ nativeEvent: { layout: { y: 1000 } } });
    });

    expect(interpolate).toHaveBeenLastCalledWith({ inputRange: [280, 400], outputRange: [26, 0], extrapolate: 'clamp' });
  });
});
