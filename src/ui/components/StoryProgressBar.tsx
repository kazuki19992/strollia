import { useLayoutEffect, useMemo, useRef } from 'react';
import { Animated, View } from 'react-native';

import { getStoryProgressLabel } from '@/ui/appText';
import type { AppStyles } from '@/ui/appStyles';

/** StoryProgressBar の props。 */
export type StoryProgressBarProps = {
  /** 総ページ数（バーの本数）。 */
  pageCount: number;
  /** 現在のページ番号（0始まり）。 */
  index: number;
  /** 現在ページの進行度（0〜1）。 */
  progress: Animated.Value;
  /** アプリ共通スタイル。 */
  styles: AppStyles;
};

/**
 * ページ数で分割した進行バー。現在より前は満タン、現在は progress に追従、後ろは空で表示する。
 *
 * 全バーの伸び具合を「ページ番号 + progress」という1つのアニメーション値から補間し、横方向の拡大率(scaleX)で描く。
 * JS で幅を書き換える方式では、iOS(Fabric)で連打してページを素早く進めたときに、React の再描画が
 * ネイティブ側の値を途中の幅で上書きし、見終わったバーが途中のまま残ることがあった。
 * そのため progress はネイティブドライバで動かし(`useStoryPlayer`)、バーは常に同じ値へ追従させる。
 */
export function StoryProgressBar({ pageCount, index, progress, styles }: StoryProgressBarProps) {
  const pageValue = useRef(new Animated.Value(index)).current;
  // 描画前に更新し、ページが変わったフレームで古いページ番号の幅が見えないようにする
  useLayoutEffect(() => {
    pageValue.setValue(index);
  }, [index, pageValue]);
  const position = useMemo(() => Animated.add(pageValue, progress), [pageValue, progress]);

  return (
    <View
      style={styles.storyProgressRow}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={getStoryProgressLabel(index, pageCount)}
    >
      {Array.from({ length: pageCount }, (_, i) => (
        <View key={i} style={styles.storyProgressSegment}>
          <Animated.View
            testID={`story-progress-fill-${i}`}
            style={[
              styles.storyProgressFill,
              {
                // 幅ではなく左端を起点に横へ伸ばす。transform ならネイティブドライバで動かせ、
                // React の再描画がネイティブ側の値を古い値で上書きしない
                transformOrigin: 'left',
                transform: [{ scaleX: position.interpolate({ inputRange: [i, i + 1], outputRange: [0, 1], extrapolate: 'clamp' }) }],
              },
            ]}
          />
        </View>
      ))}
    </View>
  );
}
