import { useMemo } from 'react';
import { Animated, Text, useWindowDimensions, View } from 'react-native';

import { buildAreaSampleCells } from '@/features/annualReport/annualReportVisuals';
import { STORY_PAGE_DURATION_MS } from '@/ui/hooks/useStoryPlayer';
import { useStoryTimeline, useStoryTimelineValue } from '@/ui/hooks/useStoryTimeline';
import { AnnualReportRise } from './AnnualReportRise';
import { ANNUAL_REPORT_PAGE_HORIZONTAL_PADDING, annualReportColors, annualReportStyles } from './annualReportStyles';
import { countUpValue, RISE_DELAYS_MS, type AnnualReportPageProps } from './annualReportPageProps';

/** マス目の列数と行数(演出用のサンプルで、実際の地図の位置ではない)。 */
const CELL_COLUMNS = 18;
const CELL_ROWS = 16;
const CELL_GAP = 2;
/** 塗り始める時刻(ミリ秒)。 */
const PAINT_START_MS = 900;
/** 1マスずつ塗る間隔の上限と、全体の目安の長さ(ミリ秒)。 */
const PAINT_INTERVAL_MAX_MS = 25;
const PAINT_TOTAL_MS = 4000;
/** 白く光ってから色が落ち着くまでの長さ(ミリ秒)。 */
const FLASH_MS = 600;
/** エリア数のカウントアップの長さ(ミリ秒)。 */
const COUNT_UP_MS = 2400;

/** ページ8: 新しく塗ったエリア。エリア数をカウントアップし、マスを光らせながら塗る。 */
export function AnnualReportNewAreasPage({ payload, paused, completed, contentTop }: AnnualReportPageProps) {
  const clock = useStoryTimeline({ durationMs: STORY_PAGE_DURATION_MS, paused, completed });
  const { width } = useWindowDimensions();
  // 塗る順番(新しいエリアのマスだけの通し番号)を前もって振る
  const cells = useMemo(() => {
    let newCount = 0;
    return buildAreaSampleCells(payload.previousCellCount, payload.newCellCount, CELL_COLUMNS * CELL_ROWS).map((kind) => ({
      kind,
      order: kind === 'new' ? newCount++ : -1,
    }));
  }, [payload.previousCellCount, payload.newCellCount]);
  const count = useStoryTimelineValue(clock, (ms) => Math.round(countUpValue(ms, PAINT_START_MS, COUNT_UP_MS, payload.newCellCount)));
  const cellSize = (width - ANNUAL_REPORT_PAGE_HORIZONTAL_PADDING * 2 - CELL_GAP * (CELL_COLUMNS - 1)) / CELL_COLUMNS;
  const newTotal = cells.filter((cell) => cell.kind === 'new').length;
  const interval = Math.min(PAINT_INTERVAL_MAX_MS, PAINT_TOTAL_MS / Math.max(1, newTotal));

  return (
    <View style={[annualReportStyles.page, annualReportStyles.pageContent, { paddingTop: contentTop }]}>
      <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[0]}>
        <Text style={annualReportStyles.pageHeading}>新しく塗ったエリア</Text>
      </AnnualReportRise>
      <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[1]}>
        <Text style={annualReportStyles.pageMessage}>
          <Text style={annualReportStyles.accentNumber}>{count}</Text>
          {' エリアを\n新しく塗りました！'}
        </Text>
      </AnnualReportRise>
      <View style={annualReportStyles.cells}>
        {cells.map((cell, index) => {
          const size = { width: cellSize, height: cellSize };
          if (cell.kind !== 'new') {
            return (
              <View
                key={index}
                style={[size, { backgroundColor: cell.kind === 'old' ? annualReportColors.cellOld : annualReportColors.cellEmpty }]}
              />
            );
          }
          const start = PAINT_START_MS + cell.order * interval;
          return (
            <Animated.View
              key={index}
              style={[
                size,
                {
                  backgroundColor: clock.interpolate({
                    inputRange: [start - 1, start, start + FLASH_MS],
                    outputRange: [annualReportColors.cellEmpty, '#ffffff', annualReportColors.accent],
                    extrapolate: 'clamp',
                  }),
                },
              ]}
            />
          );
        })}
      </View>
      <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[3]}>
        <Text style={annualReportStyles.legend}>
          <Text style={{ color: annualReportColors.cellOld }}>■</Text>
          {` ${payload.year - 1}年までのエリア　`}
          <Text style={annualReportStyles.accentText}>■</Text>
          {` ${payload.year}年にはじめて`}
        </Text>
      </AnnualReportRise>
    </View>
  );
}
