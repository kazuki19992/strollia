import { useMemo } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';

import {
  formatAreaComparison,
  formatAreaSize,
  resolveAreaComparison,
  resolveNewAreaSquareMeters,
} from '@/features/annualReport/annualReportCopy';
import { buildAreaTileLayout, quantizeRevealCount } from '@/features/annualReport/annualReportVisuals';
import { STORY_PAGE_DURATION_MS } from '@/ui/hooks/useStoryPlayer';
import { useStoryTimeline, useStoryTimelineValue } from '@/ui/hooks/useStoryTimeline';
import { AnnualReportRise } from './AnnualReportRise';
import { ANNUAL_REPORT_PAGE_HORIZONTAL_PADDING, AREA_TILE_GAP, annualReportStyles } from './annualReportStyles';
import { countUpValue, RISE_DELAYS_MS, type AnnualReportPageProps } from './annualReportPageProps';

/** タイルの板の一辺の上限(px)。 */
const BOARD_MAX_SIDE = 240;
/**
 * 板を斜めにしたときに、見た目の高さが板の一辺の何倍になるか(おおよそ)。
 * 45°回すと対角線(√2倍)が横幅になり、55°倒すと縦が cos55° ほどに縮むため、余白を含めて 0.9 倍の場所を取る。
 */
const BOARD_STAGE_HEIGHT_RATIO = 0.9;
/** 塗り始める時刻と、最後のタイルを塗り始めるまでの長さ(ミリ秒)。900〜3,300ms に収める。 */
const PAINT_START_MS = 900;
const PAINT_SPAN_MS = 2400;
/** 塗った直後の白から、緑に落ち着くまでの長さ(ミリ秒)。 */
const FLASH_MS = 500;
/** 塗る枚数を増やす段階数。タイル個別に補間せず、16段階の静的なスタイル切り替えで描く。 */
const PAINT_STEPS = 16;
/** 広さの比較を出す時刻(ミリ秒)。出現アニメーション(800ms)を含めて 4.8 秒以内に終える。 */
const COMPARISON_DELAY_MS = 3600;

/**
 * タイルを塗る順番(0始まり)を、格子の並び順(左上から右へ)ごとに返す。
 *
 * 板は右回りに45°回して手前へ倒すため、右下の角(列+行が最大)が最も手前に見える。
 * 手前から奥へ斜めの波で塗るよう、列+行の大きい順に番号を振る(同じ斜めの列では右から)。
 */
function buildPaintOrder(tileCount: number, columns: number): number[] {
  const indices = Array.from({ length: tileCount }, (_, index) => index);
  const diagonal = (index: number) => (index % columns) + Math.floor(index / columns);
  const sorted = [...indices].sort((a, b) => diagonal(b) - diagonal(a) || (b % columns) - (a % columns));
  const order = Array<number>(tileCount);
  sorted.forEach((tileIndex, rank) => {
    order[tileIndex] = rank;
  });
  return order;
}

/** ページ8: 新しく塗ったエリア。エリア数をカウントアップし、斜めから見下ろしたタイルの広場を塗り、身近な広さで例える。 */
export function AnnualReportNewAreasPage({ payload, paused, completed, contentTop }: AnnualReportPageProps) {
  const clock = useStoryTimeline({ durationMs: STORY_PAGE_DURATION_MS, paused, completed });
  const { width } = useWindowDimensions();
  const layout = useMemo(() => buildAreaTileLayout(payload.newCellCount), [payload.newCellCount]);
  const paintOrder = useMemo(() => buildPaintOrder(layout.tileCount, layout.columns), [layout.tileCount, layout.columns]);
  const squareMeters = resolveNewAreaSquareMeters(payload);
  const comparison = formatAreaComparison(resolveAreaComparison(squareMeters));

  // 45°回すと対角線が横幅になるため、対角線が本文の幅に収まる一辺にする
  const boardSide = Math.min((width - ANNUAL_REPORT_PAGE_HORIZONTAL_PADDING * 2) / Math.SQRT2, BOARD_MAX_SIDE);
  const tileSize = layout.columns > 0 ? (boardSide - AREA_TILE_GAP * (layout.columns - 1)) / layout.columns : 0;
  const boardHeight = layout.rows * tileSize + Math.max(0, layout.rows - 1) * AREA_TILE_GAP;

  const count = useStoryTimelineValue(clock, (ms) => Math.round(countUpValue(ms, PAINT_START_MS, PAINT_SPAN_MS, payload.newCellCount)));
  const interval = PAINT_SPAN_MS / Math.max(1, layout.tileCount);
  // 塗った枚数(白)と落ち着いた枚数(緑)を段階的に増やすだけにして、タイル個別の Animated を作らない
  const paintedCount = useStoryTimelineValue(clock, (ms) =>
    quantizeRevealCount(ms, PAINT_START_MS, interval, layout.tileCount, PAINT_STEPS),
  );
  const settledCount = useStoryTimelineValue(clock, (ms) =>
    quantizeRevealCount(ms, PAINT_START_MS + FLASH_MS, interval, layout.tileCount, PAINT_STEPS),
  );

  return (
    <View style={[annualReportStyles.page, annualReportStyles.pageContent, { paddingTop: contentTop }]}>
      <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[0]}>
        <Text style={annualReportStyles.pageHeading}>新しく塗ったエリア</Text>
      </AnnualReportRise>
      <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[1]}>
        <Text style={annualReportStyles.pageMessage}>
          {'新しく '}
          <Text style={annualReportStyles.accentNumber}>{count}</Text>
          {' エリアに\n訪れました！'}
        </Text>
      </AnnualReportRise>
      <View style={[annualReportStyles.areaStage, { height: boardSide * BOARD_STAGE_HEIGHT_RATIO }]}>
        {/* 斜め見下ろしの transform は板1枚にだけかける(タイル個別に transform しない) */}
        <View style={[annualReportStyles.areaBoard, { width: boardSide, height: boardHeight }]}>
          {paintOrder.map((rank, index) => (
            <View
              key={index}
              testID="annual-report-area-tile"
              style={[
                annualReportStyles.areaTile,
                rank < settledCount
                  ? annualReportStyles.areaTilePainted
                  : rank < paintedCount
                    ? annualReportStyles.areaTileFlash
                    : annualReportStyles.areaTileEmpty,
                { width: tileSize, height: tileSize },
              ]}
            />
          ))}
        </View>
      </View>
      <AnnualReportRise clock={clock} delayMs={COMPARISON_DELAY_MS}>
        <Text style={annualReportStyles.areaComparisonText}>
          <Text style={annualReportStyles.accentText}>{comparison}</Text>
          {' の広さです'}
        </Text>
        <Text style={annualReportStyles.areaSize}>{formatAreaSize(squareMeters)}</Text>
      </AnnualReportRise>
    </View>
  );
}
