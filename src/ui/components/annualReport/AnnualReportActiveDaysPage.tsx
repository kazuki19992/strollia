import { useMemo } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';

import { buildCalendarCells, quantizeRevealCount } from '@/features/annualReport/annualReportVisuals';
import { STORY_PAGE_DURATION_MS } from '@/ui/hooks/useStoryPlayer';
import { useStoryTimeline, useStoryTimelineValue } from '@/ui/hooks/useStoryTimeline';
import { AnnualReportRise } from './AnnualReportRise';
import { ANNUAL_REPORT_PAGE_HORIZONTAL_PADDING, annualReportColors, annualReportStyles } from './annualReportStyles';
import { countUpValue, RISE_DELAYS_MS, type AnnualReportPageProps } from './annualReportPageProps';

/** カレンダーの列数。 */
const CALENDAR_COLUMNS = 21;
/** カレンダーのマスの間隔。 */
const CALENDAR_GAP = 3;
/** 点灯とカウントアップを始める時刻(ミリ秒)。 */
const LIGHT_START_MS = 900;
/** 1日ずつ点灯する間隔(ミリ秒)。 */
const LIGHT_INTERVAL_MS = 7;
/** 日数のカウントアップの長さ(ミリ秒)。 */
const COUNT_UP_MS = 2200;
/** 点灯件数を増やす段階数。 */
const LIGHT_STEPS = 40;

/** ページ2: 記録した日数。日数をカウントアップし、1年分のカレンダーのマスを順に点灯する。 */
export function AnnualReportActiveDaysPage({ payload, paused, completed, contentTop }: AnnualReportPageProps) {
  const clock = useStoryTimeline({ durationMs: STORY_PAGE_DURATION_MS, paused, completed });
  const { width } = useWindowDimensions();
  // 点灯の順番(記録のある日だけの通し番号)を前もって振る
  const cells = useMemo(() => {
    let litCount = 0;
    return buildCalendarCells(payload.year, payload.activeDates).map((cell) => ({ ...cell, order: cell.active ? litCount++ : -1 }));
  }, [payload.year, payload.activeDates]);
  const litTotal = payload.activeDates.length;
  // 365マスを個別に補間すると7秒間ずっとJSで計算し続けるため、点灯件数を約40段階で増やして静的なスタイルで描く
  const litCount = useStoryTimelineValue(clock, (ms) => quantizeRevealCount(ms, LIGHT_START_MS, LIGHT_INTERVAL_MS, litTotal, LIGHT_STEPS));
  const days = useStoryTimelineValue(clock, (ms) => Math.round(countUpValue(ms, LIGHT_START_MS, COUNT_UP_MS, payload.activeDays)));
  const cellSize = (width - ANNUAL_REPORT_PAGE_HORIZONTAL_PADDING * 2 - CALENDAR_GAP * (CALENDAR_COLUMNS - 1)) / CALENDAR_COLUMNS;

  return (
    <View style={[annualReportStyles.page, annualReportStyles.pageContent, { paddingTop: contentTop }]}>
      <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[0]}>
        <Text style={annualReportStyles.pageHeading}>記録した日数</Text>
      </AnnualReportRise>
      <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[1]}>
        <Text style={annualReportStyles.pageMessage}>
          {`${payload.year}年は `}
          <Text style={annualReportStyles.accentNumber}>{days}</Text>
          {' 日\n外出しました！'}
        </Text>
      </AnnualReportRise>
      <View style={annualReportStyles.calendar}>
        {cells.map((cell) => {
          const lit = cell.active && cell.order < litCount;
          return (
            <View
              key={cell.date}
              style={[
                annualReportStyles.calendarCell,
                { width: cellSize, height: cellSize },
                lit ? { backgroundColor: cell.order % 3 === 0 ? annualReportColors.accentDeep : annualReportColors.accent } : null,
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}
