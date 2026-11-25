import type { ReactNode } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

import { timelineProgress } from '@/ui/hooks/useStoryTimeline';
import { RISE_EASING } from './annualReportPageProps';

/** AnnualReportRise の props。 */
export type AnnualReportRiseProps = {
  /** ページ内アニメーションの時計(経過ミリ秒)。 */
  clock: Animated.Value;
  /** 出現を始める時刻(ミリ秒)。 */
  delayMs: number;
  /** 追加のスタイル。 */
  style?: StyleProp<ViewStyle>;
  /** 出現させる内容。 */
  children: ReactNode;
};

/** 出現アニメーションの長さ(ミリ秒)。 */
const RISE_DURATION_MS = 800;

/**
 * 下から浮かび上がって現れる(opacity 0→1、24px 下から)ストーリー本文の入れ物。
 * 年間レポートの各ページで、見出し→本文→補足の順に出すために使う。
 */
export function AnnualReportRise({ clock, delayMs, style, children }: AnnualReportRiseProps) {
  const progress = timelineProgress(clock, delayMs, RISE_DURATION_MS, RISE_EASING);
  return (
    <Animated.View
      style={[
        style,
        { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}
