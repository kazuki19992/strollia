import { Text, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { resolveDistanceTier, summaryMessage } from '@/features/annualReport/annualReportCopy';
import type { AnnualReportCoordinate, AnnualReportPayloadV1 } from '@/features/annualReport/annualReportTypes';
import { resolveAnnualReportPages, resolveMonthExtremes } from '@/features/annualReport/annualReportPages';
import { STORY_PAGE_DURATION_MS } from '@/ui/hooks/useStoryPlayer';
import { useStoryTimeline } from '@/ui/hooks/useStoryTimeline';
import { AnnualReportRise } from './AnnualReportRise';
import { AnnualReportRouteMap } from './AnnualReportRouteMap';
import { ANNUAL_REPORT_PAGE_HORIZONTAL_PADDING, annualReportColors, annualReportStyles } from './annualReportStyles';
import { RISE_DELAYS_MS, type AnnualReportPageProps } from './annualReportPageProps';

/** まとめのタイル同士の間隔。 */
const TILE_GAP = 10;

/** まとめの数字タイル1枚。 */
export type AnnualReportSummaryTile = { label: string; value: string };

/**
 * まとめに出す数字のタイルを決める。0件で飛ばしたページ(初訪問・エリア・実績)のタイルは出さない(spec §4)。
 */
export function resolveAnnualReportSummaryTiles(payload: AnnualReportPayloadV1): AnnualReportSummaryTile[] {
  const pages = new Set(resolveAnnualReportPages(payload));
  const { maxMonth } = resolveMonthExtremes(payload.monthlyDistanceMeters, payload.periodEnd);
  const hasSpots = payload.spots.count > 0;
  const tiles: AnnualReportSummaryTile[] = [
    { label: '記録した日数', value: `${payload.activeDays}日` },
    { label: '総移動距離', value: `${Math.round(payload.totalDistanceMeters / 1000).toLocaleString('ja-JP')}km` },
    { label: 'いちばん動いた月', value: `${maxMonth}月` },
  ];
  if (pages.has('firstVisits')) {
    tiles.push({ label: 'はじめての都道府県', value: String(payload.newPrefectures.length) });
  }
  if (pages.has('newAreas')) {
    tiles.push({ label: '新しいエリア', value: payload.newCellCount.toLocaleString('ja-JP') });
  }
  if (pages.has('achievements')) {
    tiles.push(
      hasSpots
        ? { label: '実績・スポット', value: String(payload.achievements.count + payload.spots.count) }
        : { label: '解除した実績', value: String(payload.achievements.count) },
    );
  }
  return tiles;
}

/** AnnualReportSummaryPage の props。 */
export type AnnualReportSummaryPageProps = AnnualReportPageProps & {
  /** 小さな地図に描くルート。「隠して共有」のときは非表示範囲を除いたもの。 */
  segments: AnnualReportCoordinate[][];
};

/** ページ10: その年のまとめ。段階別メッセージ、1年の地図、主要な数字のタイルを順に出す。 */
export function AnnualReportSummaryPage({ payload, paused, completed, contentTop, segments }: AnnualReportSummaryPageProps) {
  const clock = useStoryTimeline({ durationMs: STORY_PAGE_DURATION_MS, paused, completed });
  const { width } = useWindowDimensions();
  const tiles = resolveAnnualReportSummaryTiles(payload);
  const tileWidth = (width - ANNUAL_REPORT_PAGE_HORIZONTAL_PADDING * 2 - TILE_GAP) / 2;

  return (
    <View style={annualReportStyles.page}>
      <Svg style={annualReportStyles.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="summaryGlow" x1="0" y1="0" x2="0.35" y2="1">
            <Stop offset="0" stopColor="#13261f" />
            <Stop offset="0.55" stopColor={annualReportColors.background} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#summaryGlow)" />
      </Svg>
      <View style={[annualReportStyles.pageContent, { paddingTop: contentTop }]}>
        <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[0]}>
          <Text style={annualReportStyles.pageHeading}>{`${payload.year}年のまとめ`}</Text>
        </AnnualReportRise>
        <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[1]}>
          <Text style={[annualReportStyles.pageMessage, annualReportStyles.pageMessageSmall]}>
            {summaryMessage(resolveDistanceTier(payload.totalDistanceMeters), payload.year)}
          </Text>
        </AnnualReportRise>
        <View style={annualReportStyles.summaryGrid}>
          <AnnualReportRise clock={clock} delayMs={RISE_DELAYS_MS[1]} style={annualReportStyles.summaryMapTile}>
            <AnnualReportRouteMap
              style={annualReportStyles.absoluteFill}
              segments={segments}
              regionCoordinates={payload.yearRouteSegments.flat()}
              strokeWidth={2}
            />
          </AnnualReportRise>
          {tiles.map((tile, index) => (
            <AnnualReportRise
              key={tile.label}
              clock={clock}
              delayMs={RISE_DELAYS_MS[2 + Math.floor(index / 2)]}
              style={[annualReportStyles.summaryTile, { width: tileWidth }]}
            >
              <Text style={annualReportStyles.summaryLabel}>{tile.label}</Text>
              <Text style={annualReportStyles.summaryValue}>{tile.value}</Text>
            </AnnualReportRise>
          ))}
        </View>
      </View>
    </View>
  );
}
