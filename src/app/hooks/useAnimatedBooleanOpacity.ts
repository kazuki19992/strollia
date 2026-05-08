import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

/** 真偽値に応じて0/1へフェードするAnimated.Valueを返す。 */
export function useAnimatedBooleanOpacity(visible: boolean, durationMs: number): Animated.Value {
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: durationMs,
      useNativeDriver: true,
    }).start();
  }, [durationMs, opacity, visible]);

  return opacity;
}
