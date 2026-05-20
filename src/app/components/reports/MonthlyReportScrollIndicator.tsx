import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

import { reportStyles } from './reportStyles';

/** スクロール誘導表示のprops。 */
export type MonthlyReportScrollIndicatorProps = {
  /** 表示色。 */
  color: string;
};

/** 月次レポート冒頭で縦スクロールを示す小さなアニメーション。 */
export function MonthlyReportScrollIndicator({ color }: MonthlyReportScrollIndicatorProps) {
  const offset = useRef(new Animated.Value(0)).current;

  useEffect(function animateScrollIndicator(): () => void {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(offset, { toValue: 8, duration: 780, useNativeDriver: true }),
        Animated.timing(offset, { toValue: 0, duration: 780, useNativeDriver: true }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [offset]);

  return (
    <Animated.View style={[reportStyles.monthlyScrollIndicator, { transform: [{ translateY: offset }] }]}>
      <Animated.Text style={[reportStyles.monthlyScrollText, { color }]}>SCROLL</Animated.Text>
      <View style={reportStyles.monthlyScrollArrow}>
        <View style={[reportStyles.monthlyScrollArrowLine, { backgroundColor: color, left: 3, transform: [{ rotate: '42deg' }] }]} />
        <View style={[reportStyles.monthlyScrollArrowLine, { backgroundColor: color, right: 3, transform: [{ rotate: '-42deg' }] }]} />
      </View>
    </Animated.View>
  );
}
