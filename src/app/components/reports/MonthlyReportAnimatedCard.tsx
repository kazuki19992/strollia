import { PropsWithChildren, useState } from 'react';
import { Animated, LayoutChangeEvent, ViewStyle } from 'react-native';

import { reportStyles } from './reportStyles';

/** スクロールに応じて登場するカードのprops。 */
export type MonthlyReportAnimatedCardProps = PropsWithChildren<{
  /** 画面全体のスクロール位置。 */
  scrollY: Animated.Value;
  /** 画面高さ。 */
  viewportHeight: number;
  /** 追加スタイル。 */
  style?: ViewStyle | ViewStyle[];
}>;

/** 画面下部に近づいたタイミングで奥から手前へ出る月次レポートカード。 */
export function MonthlyReportAnimatedCard({ children, scrollY, viewportHeight, style }: MonthlyReportAnimatedCardProps) {
  const [cardY, setCardY] = useState(0);

  /** レイアウト位置を保持し、スクロール量から登場タイミングを算出する。 */
  function handleLayout(event: LayoutChangeEvent): void {
    setCardY(event.nativeEvent.layout.y);
  }

  const start = cardY - viewportHeight * 0.9;
  const end = cardY - viewportHeight * 0.75;
  const opacity = scrollY.interpolate({ inputRange: [start, end], outputRange: [0, 1], extrapolate: 'clamp' });
  const scale = scrollY.interpolate({ inputRange: [start, end], outputRange: [0.9, 1], extrapolate: 'clamp' });
  const translateY = scrollY.interpolate({ inputRange: [start, end], outputRange: [26, 0], extrapolate: 'clamp' });

  return (
    <Animated.View onLayout={handleLayout} style={[reportStyles.monthlyAnimatedCard, style, { opacity, transform: [{ translateY }, { scale }] }]}>
      {children}
    </Animated.View>
  );
}
