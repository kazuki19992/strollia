import { Animated, Text, View } from 'react-native';

import { resolveMonthExtremes } from '@/features/annualReport/annualReportPages';
import { STORY_PAGE_DURATION_MS } from '@/ui/hooks/useStoryPlayer';
import { timelineProgress, useStoryTimeline } from '@/ui/hooks/useStoryTimeline';
import { AnnualReportRise } from './AnnualReportRise';
import { annualReportColors, annualReportStyles } from './annualReportStyles';
import { RISE_DELAYS_MS, RISE_EASING, type AnnualReportPageProps } from './annualReportPageProps';

/** 棒グラフ領域の高さ。 */
const BAR_AREA_HEIGHT = 250;
/** 1月の棒が伸び始める時刻と、月ごとのずれ(ミリ秒)。 */
const BAR_START_MS = 900;
const BAR_INTERVAL_MS = 110;
/** 棒が伸びきるまでの長さ(ミリ秒)。 */
const BAR_GROW_MS = 1000;
/** 最多・最少の月の距離ラベルを出す時刻(ミリ秒)。 */
const LABEL_START_MS = 2400;

/** ページ5: 月ごとの移動距離。棒グラフを1月から順に伸ばし、最多・最少の2本だけ距離を棒の上に出す。 */
export function AnnualReportMonthlyDistancePage({ payload, paused, completed, contentTop }: AnnualReportPageProps) {
  const clock = useStoryTimeline({ durationMs: STORY_PAGE_DURATION_MS, paused, completed });
  const { maxMonth, minMonth } = resolveMonthExtremes(payload.monthlyDistanceMeters, payload.periodEnd);
  const maxMeters = Math.max(...payload.monthlyDistanceMeters, 1);
  // 数字の下に月番号の行があるため、棒の最大高さはその分を差し引く
  const barMaxHeight = BAR_AREA_HEIGHT - 40;

  return (
    <View style={[annualReportStyles.page, annualReportStyles.pageContent, { paddingTop: contentTop }]}>
      <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[0]}>
        <Text style={annualReportStyles.pageHeading}>月ごとの移動距離</Text>
      </AnnualReportRise>
      <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[1]}>
        <Text style={annualReportStyles.pageMessage}>
          {'いちばん移動した月は\n'}
          <Text style={annualReportStyles.accentText}>{`${maxMonth}月`}</Text>
          {'でした！'}
        </Text>
      </AnnualReportRise>
      <View style={[annualReportStyles.monthBars, { height: BAR_AREA_HEIGHT }]}>
        {payload.monthlyDistanceMeters.map((meters, index) => {
          const month = index + 1;
          const isMax = month === maxMonth;
          const isMin = month === minMonth && !isMax;
          const color = isMax ? annualReportColors.accent : isMin ? annualReportColors.barLow : annualReportColors.barDefault;
          const grow = timelineProgress(clock, BAR_START_MS + index * BAR_INTERVAL_MS, BAR_GROW_MS, RISE_EASING);
          const label = timelineProgress(clock, LABEL_START_MS, 600, RISE_EASING);
          return (
            <View key={month} style={annualReportStyles.monthColumn}>
              <Animated.View
                style={[
                  annualReportStyles.monthBar,
                  {
                    backgroundColor: color,
                    height: grow.interpolate({ inputRange: [0, 1], outputRange: [0, (meters / maxMeters) * barMaxHeight] }),
                  },
                ]}
              >
                {isMax || isMin ? (
                  <Animated.View style={[annualReportStyles.monthLabelWrapper, { opacity: label }]}>
                    <Text
                      style={[
                        annualReportStyles.monthLabel,
                        isMax
                          ? { backgroundColor: annualReportColors.accent, color: annualReportColors.accentText }
                          : { backgroundColor: annualReportColors.barLowLabel, color: annualReportColors.text },
                      ]}
                    >
                      {`${Math.round(meters / 1000)}km`}
                    </Text>
                  </Animated.View>
                ) : null}
              </Animated.View>
              <Text style={[annualReportStyles.monthNumber, isMax ? annualReportStyles.accentText : null]}>{month}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
