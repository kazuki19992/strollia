import { Animated, Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { MonthlyReportAnimatedCard } from '@/ui/components/reports/MonthlyReportAnimatedCard';

/** UNSAFE_getByType(Animated.View) の代替として、カード本体(Animated.View)の host View を返す。 */
const getAnimatedCard = () => {
  const [card] = screen.container.queryAll((node) => node.type === 'View' && typeof node.props.onLayout === 'function');
  expect(card).toBeTruthy();
  return card;
};

describe('月レポート出現カード MonthlyReportAnimatedCard', () => {
  it('forceVisible=trueの場合はスクロール位置に関係なく表示状態にする', async () => {
    await render(
      <MonthlyReportAnimatedCard scrollY={new Animated.Value(0)} viewportHeight={800} forceVisible>
        <Text>カード</Text>
      </MonthlyReportAnimatedCard>,
    );

    // Animated.View の host View(Text を子に持つカード本体)を container から取得する。
    // v14 の host 要素ではスタイル配列が平坦化されるため、アニメーション部分を objectContaining で検証する
    const card = getAnimatedCard();
    expect(card.props.style).toEqual(expect.objectContaining({ opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] }));
  });

  it('forceVisible=falseの場合はレイアウト位置に応じた補間範囲を使う', async () => {
    const scrollY = new Animated.Value(0);
    const interpolate = jest.spyOn(scrollY, 'interpolate');
    await render(
      <MonthlyReportAnimatedCard scrollY={scrollY} viewportHeight={800}>
        <Text>カード</Text>
      </MonthlyReportAnimatedCard>,
    );

    const card = getAnimatedCard();
    await fireEvent(card, 'layout', { nativeEvent: { layout: { y: 1000 } } });

    expect(interpolate).toHaveBeenLastCalledWith({ inputRange: [280, 400], outputRange: [26, 0], extrapolate: 'clamp' });
  });
});
