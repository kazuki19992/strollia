import { useState } from 'react';
import { Animated, Text, View } from 'react-native';

import { resolveDistanceComparison } from '@/features/annualReport/annualReportCopy';
import { STORY_PAGE_DURATION_MS } from '@/ui/hooks/useStoryPlayer';
import { useStoryTimeline, useStoryTimelineValue } from '@/ui/hooks/useStoryTimeline';
import { AnnualReportRise } from './AnnualReportRise';
import { annualReportStyles } from './annualReportStyles';
import { countUpValue, RISE_DELAYS_MS, type AnnualReportPageProps } from './annualReportPageProps';

/** 距離のカウントアップの開始時刻と長さ(ミリ秒)。 */
const COUNT_UP_START_MS = 300;
const COUNT_UP_MS = 2400;
/** 両端の地名の間を点が往復する開始時刻と片道の長さ(ミリ秒)。比較文言が出たあとに動かす。 */
const SHUTTLE_START_MS = RISE_DELAYS_MS[3] + 1600;
const SHUTTLE_LEG_MS = 1400;
/** 往復の点の直径。 */
const SHUTTLE_DOT_SIZE = 12;

/** ページ3: 総移動距離。7セグの距離をカウントアップし、比較対象(§4.1)で言い換える。 */
export function AnnualReportDistancePage({ payload, paused, completed, contentTop }: AnnualReportPageProps) {
  const clock = useStoryTimeline({ durationMs: STORY_PAGE_DURATION_MS, paused, completed });
  const totalKm = payload.totalDistanceMeters / 1000;
  const distanceText = useStoryTimelineValue(clock, (ms) => countUpValue(ms, COUNT_UP_START_MS, COUNT_UP_MS, totalKm).toFixed(1));
  const comparison = resolveDistanceComparison(payload.totalDistanceMeters);
  const [trackWidth, setTrackWidth] = useState(0);
  const travel = Math.max(0, trackWidth - SHUTTLE_DOT_SIZE);

  return (
    <View style={[annualReportStyles.page, annualReportStyles.pageContent, { paddingTop: contentTop }]}>
      <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[0]}>
        <Text style={annualReportStyles.pageHeading}>総移動距離</Text>
      </AnnualReportRise>
      <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[1]}>
        <Text style={annualReportStyles.pageMessage}>{`あなたは${payload.year}年`}</Text>
        <View style={annualReportStyles.distanceValueRow}>
          <Text style={annualReportStyles.distanceValue} numberOfLines={1} adjustsFontSizeToFit>
            {distanceText}
          </Text>
          <Text style={annualReportStyles.distanceUnit}>km</Text>
        </View>
      </AnnualReportRise>
      <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[2]}>
        <Text style={[annualReportStyles.pageMessage, annualReportStyles.pageMessageSmall]}>移動しました！</Text>
      </AnnualReportRise>
      <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[3]} style={annualReportStyles.comparison}>
        <Text style={annualReportStyles.comparisonText}>
          {`${comparison.label} `}
          <Text style={annualReportStyles.comparisonValue}>{comparison.value.toFixed(1)}</Text>
          {` ${comparison.unit}`}
        </Text>
        {comparison.endpoints ? (
          <View
            testID="annual-report-distance-shuttle"
            style={annualReportStyles.shuttleTrack}
            onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
          >
            <Text style={annualReportStyles.shuttleLabelLeft}>{comparison.endpoints[0]}</Text>
            <Text style={annualReportStyles.shuttleLabelRight}>{comparison.endpoints[1]}</Text>
            <Animated.View
              style={[
                annualReportStyles.shuttleDot,
                {
                  transform: [
                    {
                      // 片道ずつ3回(行き・帰り・行き)動かす
                      translateX: clock.interpolate({
                        inputRange: [
                          SHUTTLE_START_MS,
                          SHUTTLE_START_MS + SHUTTLE_LEG_MS,
                          SHUTTLE_START_MS + SHUTTLE_LEG_MS * 2,
                          SHUTTLE_START_MS + SHUTTLE_LEG_MS * 3,
                        ],
                        outputRange: [0, travel, 0, travel],
                        extrapolate: 'clamp',
                      }),
                    },
                  ],
                },
              ]}
            />
          </View>
        ) : null}
      </AnnualReportRise>
    </View>
  );
}
