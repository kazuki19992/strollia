import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Polygon } from 'react-native-maps';

import type { AnnualReportAreaMap } from '@/features/annualReport/annualReportTypes';
import { areaCellToPolygon, quantizeRevealCount } from '@/features/annualReport/annualReportVisuals';
import { STORY_PAGE_DURATION_MS } from '@/ui/hooks/useStoryPlayer';
import { useStoryTimeline, useStoryTimelineValue } from '@/ui/hooks/useStoryTimeline';
import { AnnualReportRise } from './AnnualReportRise';
import { AnnualReportRouteMap } from './AnnualReportRouteMap';
import { annualReportColors, annualReportStyles } from './annualReportStyles';
import { countUpValue, RISE_DELAYS_MS, type AnnualReportPageProps } from './annualReportPageProps';

/** 塗り始める時刻(ミリ秒)。 */
const PAINT_START_MS = 900;
/** 1マスずつ塗る間隔の上限と、全体の目安の長さ(ミリ秒)。 */
const PAINT_INTERVAL_MAX_MS = 25;
const PAINT_TOTAL_MS = 4000;
/** 白く光ってから色が落ち着くまでの長さ(ミリ秒)。 */
const FLASH_MS = 600;
/** エリア数のカウントアップの長さ(ミリ秒)。 */
const COUNT_UP_MS = 2400;
/**
 * 塗る件数を増やす段階数。
 * Polygon の色の塗り替えはネイティブの描き直しになるため、従来のマス目(40段階)より減らしている。
 */
const PAINT_STEPS = 20;
/** 塗った直後に光らせる色。 */
const FLASH_COLOR = '#ffffff';

/** AnnualReportNewAreasPage の props。 */
export type AnnualReportNewAreasPageProps = AnnualReportPageProps & {
  /** 描くマス。隠して共有では非表示範囲を除いたもの。null なら地図なし(古い保存データ)。 */
  areaMap: AnnualReportAreaMap | null;
};

/** 地図に描く1マス。key はセル番号から作り、色が変わってもマウントし直さない。 */
type AreaPolygon = { key: string; coordinates: ReturnType<typeof areaCellToPolygon> };

/** マスの一覧を、セル番号の key と4頂点の組へ変換する。 */
function toAreaPolygons(cells: AnnualReportAreaMap['newCells'], cellSizeMeters: number): AreaPolygon[] {
  return cells.map((cell) => ({ key: `${cell[0]}:${cell[1]}`, coordinates: areaCellToPolygon(cell, cellSizeMeters) }));
}

/**
 * ページ8: 新しく塗ったエリア。
 * 暗い地図の上に、前から塗っていたマスを薄く描き、その年にはじめて塗ったマスを古い順に光らせながら塗る。
 * エリア数もカウントアップする。地図の無い古い保存データでは、数と凡例だけを出す。
 */
export function AnnualReportNewAreasPage({
  payload,
  paused,
  completed,
  contentTop,
  contentBottom,
  areaMap,
}: AnnualReportNewAreasPageProps) {
  const clock = useStoryTimeline({ durationMs: STORY_PAGE_DURATION_MS, paused, completed });
  const count = useStoryTimelineValue(clock, (ms) => Math.round(countUpValue(ms, PAINT_START_MS, COUNT_UP_MS, payload.newCellCount)));

  const newPolygons = useMemo(() => (areaMap ? toAreaPolygons(areaMap.newCells, areaMap.cellSizeMeters) : []), [areaMap]);
  // 前からのマスは色を変えないため、要素ごと一度だけ作って演出中に描き直さない
  const previousPolygonElements = useMemo(
    () =>
      areaMap
        ? toAreaPolygons(areaMap.previousCells, areaMap.cellSizeMeters).map((polygon) => (
            <Polygon
              key={`previous-${polygon.key}`}
              coordinates={polygon.coordinates}
              fillColor={annualReportColors.cellOld}
              strokeWidth={0}
            />
          ))
        : null,
    [areaMap],
  );
  // 表示範囲は新しいマス全体(AnnualReportRouteMap が余白を付けて収める)
  const regionCoordinates = useMemo(() => newPolygons.flatMap((polygon) => polygon.coordinates), [newPolygons]);

  const newTotal = newPolygons.length;
  const interval = Math.min(PAINT_INTERVAL_MAX_MS, PAINT_TOTAL_MS / Math.max(1, newTotal));
  // マスを個別に補間しない。塗った件数(白く光る)と落ち着いた件数(緑)を段階的に増やし、静的な色で描く
  const paintedCount = useStoryTimelineValue(clock, (ms) => quantizeRevealCount(ms, PAINT_START_MS, interval, newTotal, PAINT_STEPS));
  const settledCount = useStoryTimelineValue(clock, (ms) =>
    quantizeRevealCount(ms, PAINT_START_MS + FLASH_MS, interval, newTotal, PAINT_STEPS),
  );

  return (
    <View style={annualReportStyles.page}>
      {areaMap && newTotal > 0 ? (
        <AnnualReportRouteMap style={annualReportStyles.absoluteFill} segments={[]} regionCoordinates={regionCoordinates}>
          {previousPolygonElements}
          {/* 未塗りのマスは描かない。塗った直後は白く光り、FLASH_MS 後に緑へ落ち着く */}
          {newPolygons.slice(0, paintedCount).map((polygon, order) => (
            <Polygon
              key={`new-${polygon.key}`}
              coordinates={polygon.coordinates}
              fillColor={order < settledCount ? annualReportColors.accent : FLASH_COLOR}
              strokeWidth={0}
            />
          ))}
        </AnnualReportRouteMap>
      ) : null}
      <View style={[annualReportStyles.pageContent, { paddingTop: contentTop }]}>
        <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[0]}>
          <Text style={annualReportStyles.pageHeading}>新しく塗ったエリア</Text>
        </AnnualReportRise>
        <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[1]}>
          <Text style={annualReportStyles.pageMessage}>
            <Text style={annualReportStyles.accentNumber}>{count}</Text>
            {' エリアを\n新しく塗りました！'}
          </Text>
        </AnnualReportRise>
      </View>
      <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[3]} style={[annualReportStyles.areaLegend, { bottom: contentBottom }]}>
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
