import { Animated, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { STORY_PAGE_DURATION_MS } from '@/ui/hooks/useStoryPlayer';
import { timelineProgress, useStoryTimeline } from '@/ui/hooks/useStoryTimeline';
import { AnnualReportRise } from './AnnualReportRise';
import { RISE_DELAYS_MS, type AnnualReportPageProps } from './annualReportPageProps';
import { annualReportColors, annualReportStyles } from './annualReportStyles';

/** 足あとの数。 */
const FOOTPRINT_COUNT = 14;
/** 足あとが浮かぶ間隔(ミリ秒)。 */
const FOOTPRINT_INTERVAL_MS = 180;
/** 足あと1つの表示アニメーションの長さ(ミリ秒)。 */
const FOOTPRINT_DURATION_MS = 3500;
/** デモの画面サイズ(足あとの配置の基準)。 */
const DESIGN_WIDTH = 355;
const DESIGN_HEIGHT = 760;

/** `YYYY-MM-DD` を `YYYY/M/D` 形式の部品にする。 */
function splitDate(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map((value) => Number.parseInt(value, 10));
  return { year, month, day };
}

/** オープニングに出す集計期間の文言(例: `集計期間 2026/1/1〜12/15`)。 */
export function formatAnnualReportPeriod(periodStart: string, periodEnd: string): string {
  const start = splitDate(periodStart);
  const end = splitDate(periodEnd);
  return `集計期間 ${start.year}/${start.month}/${start.day}〜${end.month}/${end.day}`;
}

/** ページ1: オープニング。年(7セグ)と集計期間を出し、足あとを画面下から順に浮かべる。 */
export function AnnualReportOpeningPage({ payload, paused, completed }: AnnualReportPageProps) {
  const clock = useStoryTimeline({ durationMs: STORY_PAGE_DURATION_MS, paused, completed });
  const { width, height } = useWindowDimensions();

  return (
    <View style={annualReportStyles.page}>
      <Svg style={annualReportStyles.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient id="openingGlow" cx="30%" cy="80%" r="75%">
            <Stop offset="0" stopColor="#1f4a3c" />
            <Stop offset="0.6" stopColor={annualReportColors.background} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#openingGlow)" />
      </Svg>
      {Array.from({ length: FOOTPRINT_COUNT }, (_, index) => {
        const progress = timelineProgress(clock, index * FOOTPRINT_INTERVAL_MS, FOOTPRINT_DURATION_MS);
        return (
          <Animated.View
            key={index}
            style={[
              annualReportStyles.footprint,
              {
                left: ((30 + index * 22 + (index % 2) * 8) / DESIGN_WIDTH) * width,
                top: ((650 - index * 38) / DESIGN_HEIGHT) * height,
                opacity: progress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.9, 0.15] }),
                transform: [{ rotate: '20deg' }],
              },
            ]}
          />
        );
      })}
      <View style={annualReportStyles.openingContent}>
        <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[0]}>
          <Text style={annualReportStyles.pageHeading}>あなたの1年をふりかえろう</Text>
        </AnnualReportRise>
        <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[1]}>
          <Text style={annualReportStyles.openingYear}>{payload.year}</Text>
        </AnnualReportRise>
        <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[2]}>
          <Text style={annualReportStyles.pageMessage}>あなたのあしあと</Text>
        </AnnualReportRise>
        <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[3]}>
          <Text style={annualReportStyles.openingPeriod}>{formatAnnualReportPeriod(payload.periodStart, payload.periodEnd)}</Text>
        </AnnualReportRise>
      </View>
    </View>
  );
}
