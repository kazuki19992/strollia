import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

/** 画面キーが変わるたびにフェード/スライド用のAnimated.Valueを再生する。 */
export function useScreenTransitionOpacity(screenKey: string, durationMs: number): Animated.Value {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: durationMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [durationMs, opacity, screenKey]);

  return opacity;
}
