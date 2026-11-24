import { Animated, View } from 'react-native';

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
 */
export function StoryProgressBar({ pageCount, index, progress, styles }: StoryProgressBarProps) {
  const currentWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'], extrapolate: 'clamp' });

  return (
    <View
      style={styles.storyProgressRow}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${index + 1} / ${pageCount} ページ`}
    >
      {Array.from({ length: pageCount }, (_, i) => (
        <View key={i} style={styles.storyProgressSegment}>
          <Animated.View
            testID={`story-progress-fill-${i}`}
            style={[styles.storyProgressFill, { width: i < index ? '100%' : i === index ? currentWidth : '0%' }]}
          />
        </View>
      ))}
    </View>
  );
}
