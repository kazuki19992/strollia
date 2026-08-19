import { Text, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';

import { createInitialRegion, createInitialRegionFromCoordinates, toRenderRouteSegments } from '@/features/map/routeMapper';
import { toPrivacyRouteSegments } from '@/features/stayPlaces/privacyRouteSegments';
import type { StayPlace } from '@/features/stayPlaces/stayPlaceTypes';
import type { AppTheme } from '@/theme/theme';
import type { LocationPoint } from '@/types/gps';
import type { AppStyles } from '@/ui/appStyles';

export type RouteMapPanelProps = {
  /** 空状態で表示する文言。 */
  emptyLabel: string;
  /** GPSポイント。 */
  points: LocationPoint[];
  /** 指定時は共有専用として非表示半径を適用する有効な滞在場所。 */
  activeStayPlaces?: StayPlace[];
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
export function RouteMapPanel({
  emptyLabel,
  points,
  activeStayPlaces,
  regionPoints = points,
  styles,
  theme,
  onMapLoaded,
}: RouteMapPanelProps) {
  const routeSegments = activeStayPlaces == null ? toRenderRouteSegments(points) : toPrivacyRouteSegments(points, activeStayPlaces);
  const routeCoordinates = routeSegments.flatMap((segment) => segment.coordinates);
  const hasPrivacyRoute = activeStayPlaces != null;

  if (regionPoints.length === 0 || (hasPrivacyRoute && routeSegments.length === 0)) {
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
        initialRegion={hasPrivacyRoute ? createInitialRegionFromCoordinates(routeCoordinates) : createInitialRegion(regionPoints)}
        scrollEnabled
        zoomEnabled
        rotateEnabled
        pitchEnabled={false}
        onMapLoaded={onMapLoaded}
      >
        {routeSegments.map((segment) => (
          <Polyline key={segment.id} coordinates={segment.coordinates} strokeColor={theme.colors.mapLine} strokeWidth={5} />
        ))}
      </MapView>
    </View>
  );
}
