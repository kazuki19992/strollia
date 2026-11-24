import { useMemo, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';

import type { AnnualReportCoordinate } from '@/features/annualReport/annualReportTypes';
import { createInitialRegionFromCoordinates } from '@/features/map/routeMapper';
import { annualReportColors, annualReportStyles } from './annualReportStyles';

/** AnnualReportRouteMap の props。 */
export type AnnualReportRouteMapProps = {
  /** 描画するルート(線ごとの座標列)。 */
  segments: AnnualReportCoordinate[][];
  /** 表示範囲の基準にする座標。省略時は segments 全体。 */
  regionCoordinates?: AnnualReportCoordinate[];
  /** 地図の入れ物のスタイル。 */
  style?: StyleProp<ViewStyle>;
  /** ルート線の太さ。 */
  strokeWidth?: number;
  /** ルート線の色。省略時はアクセント色。 */
  strokeColor?: string;
  /** 追加で地図上に描く要素(軌跡や現在地点のマーカーなど)。 */
  children?: ReactNode;
};

/**
 * 年間レポートの地図ページ用の、操作できない暗い地図。
 * ルートを Polyline で描き、文字が読めるよう上に暗いオーバーレイを重ねる。
 */
export function AnnualReportRouteMap({
  segments,
  regionCoordinates,
  style,
  strokeWidth = 3,
  strokeColor = annualReportColors.accent,
  children,
}: AnnualReportRouteMapProps) {
  const region = useMemo(
    () => createInitialRegionFromCoordinates(regionCoordinates ?? segments.flat()),
    // 表示範囲はマウント時に決めれば十分(描画の途中で範囲が動くと落ち着かないため)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 初回の範囲だけを使う
    [],
  );

  return (
    <View style={style} pointerEvents="none">
      <MapView
        style={annualReportStyles.absoluteFill}
        initialRegion={region}
        mapType="mutedStandard"
        userInterfaceStyle="dark"
        pitchEnabled={false}
        rotateEnabled={false}
        scrollEnabled={false}
        zoomEnabled={false}
        toolbarEnabled={false}
      >
        {segments.map((coordinates, index) =>
          coordinates.length > 1 ? (
            <Polyline key={index} coordinates={coordinates} strokeColor={strokeColor} strokeWidth={strokeWidth} />
          ) : null,
        )}
        {children}
      </MapView>
      <View style={annualReportStyles.mapOverlay} />
    </View>
  );
}
