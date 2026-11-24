import { Text, View } from 'react-native';

import { mapPageMessage, resolveDistanceTier } from '@/features/annualReport/annualReportCopy';
import type { AnnualReportCoordinate } from '@/features/annualReport/annualReportTypes';
import { STORY_PAGE_DURATION_MS } from '@/ui/hooks/useStoryPlayer';
import { useStoryTimeline, useStoryTimelineValue } from '@/ui/hooks/useStoryTimeline';
import { AnnualReportRise } from './AnnualReportRise';
import { AnnualReportRouteMap } from './AnnualReportRouteMap';
import { annualReportStyles } from './annualReportStyles';
import { clamp01, RISE_DELAYS_MS, type AnnualReportPageProps } from './annualReportPageProps';

/** ルートを順に描き始める時刻と、全部描き終えるまでの長さ(ミリ秒)。 */
const DRAW_START_MS = 400;
const DRAW_MS = 2200;

/** AnnualReportYearMapPage の props。 */
export type AnnualReportYearMapPageProps = AnnualReportPageProps & {
  /** 描画するルート。「隠して共有」のときは非表示範囲を除いたもの。 */
  segments: AnnualReportCoordinate[][];
};

/** ページ4: 1年の移動マップ。日ごとのルートを順に描き、距離の段階別メッセージを出す。 */
export function AnnualReportYearMapPage({ payload, paused, completed, contentTop, segments }: AnnualReportYearMapPageProps) {
  const clock = useStoryTimeline({ durationMs: STORY_PAGE_DURATION_MS, paused, completed });
  const visibleCount = useStoryTimelineValue(clock, (ms) => Math.ceil(clamp01((ms - DRAW_START_MS) / DRAW_MS) * segments.length));

  return (
    <View style={annualReportStyles.page}>
      <AnnualReportRouteMap
        style={annualReportStyles.absoluteFill}
        segments={segments.slice(0, visibleCount)}
        regionCoordinates={segments.flat()}
        strokeWidth={2}
      />
      <View style={[annualReportStyles.pageContent, { paddingTop: contentTop }]}>
        <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[0]}>
          <Text style={annualReportStyles.pageHeading}>1年の移動マップ</Text>
        </AnnualReportRise>
        <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[1]}>
          <Text style={annualReportStyles.pageMessage}>{mapPageMessage(resolveDistanceTier(payload.totalDistanceMeters))}</Text>
        </AnnualReportRise>
      </View>
    </View>
  );
}
