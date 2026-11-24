import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Marker, Polyline } from 'react-native-maps';

import type { AnnualReportCoordinate } from '@/features/annualReport/annualReportTypes';
import {
  createRoutePlayback,
  formatClockTime,
  resolveRoutePlaybackFrame,
  toFarthestDayPlaybackRoute,
} from '@/features/annualReport/annualReportVisuals';
import { formatDailyLogListDateLabel } from '@/ui/dailyLogDisplay';
import { STORY_PAGE_DURATION_MS } from '@/ui/hooks/useStoryPlayer';
import { useStoryTimeline, useStoryTimelineValue } from '@/ui/hooks/useStoryTimeline';
import { AnnualReportRise } from './AnnualReportRise';
import { AnnualReportRouteMap } from './AnnualReportRouteMap';
import { annualReportColors, annualReportStyles } from './annualReportStyles';
import { clamp01, RISE_DELAYS_MS, type AnnualReportPageProps } from './annualReportPageProps';

/** 点が進み始める時刻と、終点に着くまでの長さ(ミリ秒)。 */
const PLAYBACK_START_MS = 900;
const PLAYBACK_MS = 5200;
/** 再生の段階数。軌跡の再描画回数を抑えるため、進行度をこの段階に量子化する。 */
const PLAYBACK_STEPS = 200;

/** ease-in-out(2次)。 */
function easeInOutQuad(value: number): number {
  return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
}

/** AnnualReportFarthestDayPage の props。 */
export type AnnualReportFarthestDayPageProps = AnnualReportPageProps & {
  /**
   * 「隠して共有」のときの、非表示範囲を除いたルート。null なら通常表示(点が進む再生)にする。
   * 隠すときは点(現在地点)を出さない。終点が自宅付近のことが多く、点の位置から場所が分かってしまうため。
   */
  privacySegments: AnnualReportCoordinate[][] | null;
};

/** ページ6: いちばん遠くまで出かけた日。その日のルート上を点が進み、時刻と距離も一緒に進む。 */
export function AnnualReportFarthestDayPage({
  payload,
  paused,
  completed,
  contentTop,
  contentBottom,
  privacySegments,
}: AnnualReportFarthestDayPageProps) {
  const clock = useStoryTimeline({ durationMs: STORY_PAGE_DURATION_MS, paused, completed });
  const farthestDay = payload.farthestDay;
  const route = useMemo(() => toFarthestDayPlaybackRoute(farthestDay?.route ?? []), [farthestDay]);
  const playback = useMemo(() => createRoutePlayback(route), [route]);
  const step = useStoryTimelineValue(clock, (ms) =>
    Math.round(easeInOutQuad(clamp01((ms - PLAYBACK_START_MS) / PLAYBACK_MS)) * PLAYBACK_STEPS),
  );
  const frame = useMemo(() => resolveRoutePlaybackFrame(playback, step / PLAYBACK_STEPS), [playback, step]);
  const routeCoordinates = useMemo(() => route.map(({ latitude, longitude }) => ({ latitude, longitude })), [route]);

  if (!farthestDay) {
    return null;
  }

  const distanceKm = ((farthestDay.distanceMeters * frame.distanceFraction) / 1000).toFixed(1);
  const clockText = route.length > 0 ? formatClockTime(frame.recordedAtMs) : '--:--';

  return (
    <View style={annualReportStyles.page}>
      {privacySegments ? (
        <AnnualReportRouteMap
          style={annualReportStyles.absoluteFill}
          segments={privacySegments}
          regionCoordinates={routeCoordinates}
          strokeWidth={3}
        />
      ) : (
        <AnnualReportRouteMap
          style={annualReportStyles.absoluteFill}
          segments={[routeCoordinates]}
          strokeColor={annualReportColors.routeFaint}
          strokeWidth={2}
        >
          {frame.trail.length > 1 ? <Polyline coordinates={frame.trail} strokeColor={annualReportColors.accent} strokeWidth={3} /> : null}
          {route.length > 0 ? (
            <Marker coordinate={frame.position} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <View style={annualReportStyles.mapDot} />
            </Marker>
          ) : null}
        </AnnualReportRouteMap>
      )}
      <View style={[annualReportStyles.pageContent, { paddingTop: contentTop }]}>
        <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[0]}>
          <Text style={annualReportStyles.pageHeading}>いちばん遠くまで出かけた日</Text>
        </AnnualReportRise>
        <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[1]}>
          <Text style={annualReportStyles.pageMessage}>{formatDailyLogListDateLabel(farthestDay.localDate)}</Text>
        </AnnualReportRise>
      </View>
      <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[2]} style={[annualReportStyles.dayCard, { bottom: contentBottom }]}>
        <View>
          <Text style={annualReportStyles.dayCardLabel}>時刻</Text>
          <Text style={annualReportStyles.dayCardValue}>{clockText}</Text>
        </View>
        <View>
          <Text style={annualReportStyles.dayCardLabel}>移動距離</Text>
          {/* 7セグフォントは英字を持たないため、単位は別の Text で通常フォントにする */}
          <View style={annualReportStyles.dayCardValueRow}>
            <Text style={annualReportStyles.dayCardValue}>{distanceKm}</Text>
            <Text style={annualReportStyles.dayCardUnit}>km</Text>
          </View>
        </View>
      </AnnualReportRise>
    </View>
  );
}
