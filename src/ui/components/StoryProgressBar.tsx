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
 * 全バーの幅を「ページ番号 + progress」という1つのアニメーション値から補間する。
 * バーごとに静的な幅とアニメーションの幅を切り替えると、iOS(Fabric)では連打でページが速く進んだときに
 * アニメーション途中の幅がネイティブ側に残ることがあるため、どのバーも常に同じ値へ追従させる。
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
              { width: position.interpolate({ inputRange: [i, i + 1], outputRange: ['0%', '100%'], extrapolate: 'clamp' }) },
            ]}
          />
        </View>
      ))}
    </View>
  );
}
