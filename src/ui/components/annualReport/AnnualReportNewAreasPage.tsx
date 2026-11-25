import { useMemo } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';

import type { AnnualReportAreaMap } from '@/features/annualReport/annualReportTypes';
import { type AnnualReportAreaCell, buildAreaSampleCells, quantizeRevealCount } from '@/features/annualReport/annualReportVisuals';
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
/** 塗る件数を増やす段階数。 */
const PAINT_STEPS = 40;

/** 塗った件数・落ち着いた件数から1マスの色を決める。塗った直後は白く光らせ、FLASH_MS 後に緑へ落ち着かせる。 */
function resolveCellColor(cell: { kind: AnnualReportAreaCell; order: number }, paintedCount: number, settledCount: number): string {
  if (cell.kind === 'old') return annualReportColors.cellOld;
  if (cell.kind === 'empty' || cell.order >= paintedCount) return annualReportColors.cellEmpty;
  return cell.order < settledCount ? annualReportColors.accent : '#ffffff';
}

/** AnnualReportNewAreasPage の props。 */
export type AnnualReportNewAreasPageProps = AnnualReportPageProps & {
  /** 描くマス。隠して共有では非表示範囲を除いたもの。null なら地図なし。 */
  areaMap: AnnualReportAreaMap | null;
};

/** ページ8: 新しく塗ったエリア。エリア数をカウントアップし、マスを光らせながら塗る。 */
export function AnnualReportNewAreasPage({ payload, paused, completed, contentTop }: AnnualReportNewAreasPageProps) {
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
  // 数百マスを個別に補間しない。塗った件数(白く光る)と落ち着いた件数(緑)を約40段階で増やし、静的なスタイルで描く
  const paintedCount = useStoryTimelineValue(clock, (ms) => quantizeRevealCount(ms, PAINT_START_MS, interval, newTotal, PAINT_STEPS));
  const settledCount = useStoryTimelineValue(clock, (ms) =>
    quantizeRevealCount(ms, PAINT_START_MS + FLASH_MS, interval, newTotal, PAINT_STEPS),
  );

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
        {cells.map((cell, index) => (
          <View
            key={index}
            style={{ width: cellSize, height: cellSize, backgroundColor: resolveCellColor(cell, paintedCount, settledCount) }}
          />
        ))}
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
