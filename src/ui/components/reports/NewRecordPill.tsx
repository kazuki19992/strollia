import { useEffect, useRef } from 'react';
import { Animated, Text } from 'react-native';

import { reportStyles } from './reportStyles';

/** NEW RECORD表示のprops。 */
export type NewRecordPillProps = {
  /** 表示するかどうか。 */
  visible: boolean;
};

/** ゆっくり呼吸するように拡大縮小するNEW RECORD表示。 */
export function NewRecordPill({ visible }: NewRecordPillProps) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(
    function animateNewRecord(): () => void {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.035, duration: 1050, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 1050, useNativeDriver: true }),
        ]),
      );

      if (visible) {
        animation.start();
      }

      return () => animation.stop();
    },
    [scale, visible],
  );

  if (!visible) {
    return null;
  }

  return (
    <Animated.View style={[reportStyles.newRecordPill, { transform: [{ scale }] }]}>
      <Text style={reportStyles.newRecordText}>NEW RECORD!!</Text>
    </Animated.View>
  );
}
