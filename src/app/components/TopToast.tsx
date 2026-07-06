import { useEffect, useRef } from 'react';
import { Animated, Text } from 'react-native';

import type { AppStyles } from '@/app/appStyles';
import type { AppTheme } from '@/theme/theme';

export type TopToastProps = {
  /** 表示状態。 */
  visible: boolean;
  /** 表示する文言。 */
  message: string;
  /**
   * 画面共通スタイル。
   * 省略した場合はスタイルキーを利用しないため、呼び出し元で backgroundColor / color を
   * インラインスタイルで設定すること（テスト等で省略を許容する互換性確保のため省略可）。
   */
  styles?: AppStyles;
  /** 配色に使うテーマ。 */
  theme: AppTheme;
  /** 自動的に閉じるまでの時間(ミリ秒)。 */
  durationMs?: number;
  /** 自動的に閉じるタイミングで呼ばれる処理。 */
  onHide: () => void;
};

/** 画面上部にしばらく表示して自動で消えるトースト。styles が省略された場合は appStyles のキーを使わない。 */
export function TopToast({ visible, message, styles, theme, durationMs = 4000, onHide }: TopToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  // onHide が毎レンダー新しい関数参照でも effect を張り直さないよう ref 経由で参照する。
  const onHideRef = useRef(onHide);

  useEffect(() => {
    onHideRef.current = onHide;
  }, [onHide]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    // 再表示のたびに確実にフェードインさせるため都度リセットする。
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      onHideRef.current();
    }, durationMs);

    return () => clearTimeout(timer);
  }, [visible, durationMs, opacity]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View pointerEvents="none" style={[styles?.topToastContainer, { backgroundColor: theme.colors.primary, opacity }]}>
      <Text allowFontScaling={false} style={[styles?.topToastMessage, { color: theme.colors.primaryText }]}>
        {message}
      </Text>
    </Animated.View>
  );
}
