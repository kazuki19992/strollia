import { useEffect, useMemo, useState } from 'react';
import { Marker, Polyline } from 'react-native-maps';
import { Text, View } from 'react-native';
import MapView from 'react-native-maps';

import { getLocationPointsByDate } from '../../features/logs/logRepository';
import { getEndpointMarkers } from '../../features/map/endpointMarkers';
import { createInitialRegion, toRenderRouteCoordinates } from '../../features/map/routeMapper';
import { AppTheme } from '../../theme/theme';
import { DailyLogSummary, LocationPoint } from '../../types/gps';
import { formatTime } from '../../utils/date';
import { totalDistanceMeters } from '../../utils/distance';
import { AppStyles } from '../appStyles';

export type DailyLogCardProps = {
  /** 表示対象の日別サマリー。 */
  log: DailyLogSummary;
  /** App全体で共有するStyleSheet。 */
  styles: AppStyles;
  /** ミニマップのルート色などに使う現在のテーマ。 */
  theme: AppTheme;
};

/**
 * 1日分の記録サマリーとミニマップを表示するカード。
 *
 * @param props - 日別サマリー、共有StyleSheet、現在テーマ。
 * @returns 日別ログ一覧に表示するカード要素。
 */
export function DailyLogCard({ log, styles, theme }: DailyLogCardProps) {
  const [dailyPoints, setDailyPoints] = useState<LocationPoint[]>([]);

  /**
   * 日別カードは一覧描画後に対象日の詳細ポイントを遅延取得する。
   * 一覧全体の初期表示を軽くし、ミニマップだけ後から埋めるため。
   */
  useEffect(() => {
    getLocationPointsByDate(log.localDate)
      .then(setDailyPoints)
      .catch(() => setDailyPoints([]));
  }, [log.localDate]);

  const dailyDistance = useMemo(() => log.distanceMeters ?? totalDistanceMeters(dailyPoints), [dailyPoints, log.distanceMeters]);
  const dailyRouteCoordinates = useMemo(() => toRenderRouteCoordinates(dailyPoints), [dailyPoints]);
  const dailyRegion = useMemo(() => createInitialRegion(dailyPoints), [dailyPoints]);
  const endpointMarkers = useMemo(() => getEndpointMarkers(dailyPoints), [dailyPoints]);

  return (
    <View style={styles.dailyCard}>
      <Text style={styles.dailyDate}>{log.localDate}</Text>
      <View style={styles.dailyStatsRow}>
        <Text style={styles.dailyStat}>{log.pointCount} pts</Text>
        <Text style={styles.dailyStat}>{(dailyDistance / 1000).toFixed(2)} km</Text>
      </View>
      <Text style={styles.dailyTime}>
        {formatTime(log.startedAt)} - {formatTime(log.endedAt)}
      </Text>

      {dailyPoints.length > 0 && (
        <View style={styles.dailyMapFrame}>
          <MapView
            style={styles.dailyMap}
            initialRegion={dailyRegion}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
          >
            {dailyRouteCoordinates.length > 1 && (
              <Polyline coordinates={dailyRouteCoordinates} strokeColor={theme.colors.mapLine} strokeWidth={4} />
            )}
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
      )}
    </View>
  );
}
