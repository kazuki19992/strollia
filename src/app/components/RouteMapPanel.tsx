import { Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { getEndpointMarkers } from '../../features/map/endpointMarkers';
import { createInitialRegion, toRenderRouteCoordinates } from '../../features/map/routeMapper';
import type { AppTheme } from '../../theme/theme';
import type { LocationPoint } from '../../types/gps';
import type { AppStyles } from '../appStyles';

export type RouteMapPanelProps = {
  /** 空状態で表示する文言。 */
  emptyLabel: string;
  /** GPSポイント。 */
  points: LocationPoint[];
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** ルート線の色などに使う現在テーマ。 */
  theme: AppTheme;
};

/** 保存済みルートを、ユーザーがスクロール・ズームできるMapViewで表示する。 */
export function RouteMapPanel({ emptyLabel, points, styles, theme }: RouteMapPanelProps) {
  const routeCoordinates = toRenderRouteCoordinates(points);
  const endpointMarkers = getEndpointMarkers(points);

  if (points.length === 0) {
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
        initialRegion={createInitialRegion(points)}
        scrollEnabled
        zoomEnabled
        rotateEnabled
        pitchEnabled={false}
      >
        {routeCoordinates.length > 1 ? (
          <Polyline coordinates={routeCoordinates} strokeColor={theme.colors.mapLine} strokeWidth={5} />
        ) : null}
        {endpointMarkers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={{ latitude: marker.point.latitude, longitude: marker.point.longitude }}
            anchor={{ x: 0.5, y: 1 }}
            title={marker.label}
            description={marker.point.recordedAt}
          >
            <View style={[styles.endpointMarker, { backgroundColor: marker.color }]}>
              <Text style={styles.endpointMarkerText}>{marker.label}</Text>
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}
