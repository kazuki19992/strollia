import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';

import type { AppStyles } from '@/app/appStyles';

export type IndeterminateProgressBarProps = {
  /** 画面共通スタイル。track/fill のスタイルを使う。 */
  styles: AppStyles;
  /** アニメーションを動かすか。false のとき静止する（テスト等で利用）。 */
  animating?: boolean;
};

/**
 * 進捗割合が分からない処理向けの不定（indeterminate）プログレスバー。
 * 固定幅の塗りをトラック内で左右にループ移動させる。
 */
export function IndeterminateProgressBar({ styles, animating = true }: IndeterminateProgressBarProps) {
  const progress = useRef(new Animated.Value(0)).current;
  // レイアウト確定前でも見栄えするよう初期値を入れておく。
  const [trackWidth, setTrackWidth] = useState(240);

  useEffect(() => {
    if (!animating) {
      return;
    }

    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();

    return () => loop.stop();
  }, [animating, progress]);

  // 塗りはトラック幅の約40%。トラック左端外から右端外まで移動させる。
  const fillWidth = Math.max(trackWidth * 0.4, 1);
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-fillWidth, trackWidth],
  });

  return (
    <View
      style={styles.gifProgressTrack}
      onLayout={(event) => {
        const width = event.nativeEvent.layout.width;
        if (width > 0) {
          setTrackWidth(width);
        }
      }}
    >
      <Animated.View style={[styles.gifProgressFill, { width: fillWidth, transform: [{ translateX }] }]} />
    </View>
  );
}
