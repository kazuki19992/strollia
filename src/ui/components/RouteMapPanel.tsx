import { Text, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';

import { createInitialRegion, toRenderRouteCoordinates } from '@/features/map/routeMapper';
import type { AppTheme } from '@/theme/theme';
import type { LocationPoint } from '@/types/gps';
import type { AppStyles } from '@/ui/appStyles';

export type RouteMapPanelProps = {
  /** 空状態で表示する文言。 */
  emptyLabel: string;
  /** GPSポイント。 */
  points: LocationPoint[];
  /** 表示範囲の基準にするGPSポイント。未指定ならpointsを使う。 */
  regionPoints?: LocationPoint[];
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** ルート線の色などに使う現在テーマ。 */
  theme: AppTheme;
  /** 地図のタイル描画完了通知（任意）。共有画像のキャプチャ前待ちに使う。 */
  onMapLoaded?: () => void;
};

/** 保存済みルートを、ユーザーがスクロール・ズームできるMapViewで表示する。 */
export function RouteMapPanel({ emptyLabel, points, regionPoints = points, styles, theme, onMapLoaded }: RouteMapPanelProps) {
  const routeCoordinates = toRenderRouteCoordinates(points);

  if (regionPoints.length === 0) {
    return (
      <View style={styles.routeMapEmptyPanel}>
        <Text style={styles.routeMapEmptyText}>{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <View style={styles.routeMapFrame}>
      <MapView
        style={styles.routeMap}
        initialRegion={createInitialRegion(regionPoints)}
        scrollEnabled
        zoomEnabled
        rotateEnabled
        pitchEnabled={false}
        onMapLoaded={onMapLoaded}
      >
        {routeCoordinates.length > 1 ? (
          <Polyline coordinates={routeCoordinates} strokeColor={theme.colors.mapLine} strokeWidth={5} />
        ) : null}
      </MapView>
    </View>
  );
}
