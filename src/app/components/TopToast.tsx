import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

import type { AppTheme } from '../../theme/theme';

export type TopToastProps = {
  /** 表示状態。 */
  visible: boolean;
  /** 表示する文言。 */
  message: string;
  /** 配色に使うテーマ。 */
  theme: AppTheme;
  /** 自動的に閉じるまでの時間(ミリ秒)。 */
  durationMs?: number;
  /** 自動的に閉じるタイミングで呼ばれる処理。 */
  onHide: () => void;
};

/** 画面上部にしばらく表示して自動で消えるトースト。 */
export function TopToast({ visible, message, theme, durationMs = 4000, onHide }: TopToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      return;
    }

    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      onHide();
    }, durationMs);

    return () => clearTimeout(timer);
  }, [visible, durationMs, onHide, opacity]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { backgroundColor: theme.colors.primary, opacity }]}
    >
      <Text allowFontScaling={false} style={[styles.message, { color: theme.colors.primaryText }]}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    zIndex: 1000,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
