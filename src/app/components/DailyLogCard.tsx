import { useEffect, useMemo, useState } from 'react';
import { Marker, Polyline } from 'react-native-maps';
import { Pressable, Text, View } from 'react-native';
import MapView from 'react-native-maps';

import { getAchievementDefinition } from '../../features/achievements/achievementDefinitions';
import { getAchievementUnlocksByDate } from '../../features/achievements/achievementRepository';
import { coordinateToGridCell } from '../../features/location/grid/gridCell';
import { getVisitedCellsByIds } from '../../features/location/visitedCellRepository';
import { getLocationPointsByDate } from '../../features/logs/logRepository';
import { getEndpointMarkers } from '../../features/map/endpointMarkers';
import { createInitialRegion, toRenderRouteCoordinates } from '../../features/map/routeMapper';
import { createDailyDetailReport, DailyDetailReport } from '../../features/reports/dailyReport';
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
  /** Plusが有効かどうか。 */
  isPlusActive: boolean;
  /** Plus未加入時にPaywallを表示する処理。 */
  onPresentPremiumPaywall: () => void;
};

/**
 * 1日分の記録サマリーとミニマップを表示するカード。
 *
 * @param props - 日別サマリー、共有StyleSheet、現在テーマ。
 * @returns 日別ログ一覧に表示するカード要素。
 */
export function DailyLogCard({ log, styles, theme, isPlusActive, onPresentPremiumPaywall }: DailyLogCardProps) {
  const [dailyPoints, setDailyPoints] = useState<LocationPoint[]>([]);
  const [dailyDetailReport, setDailyDetailReport] = useState<DailyDetailReport | null>(null);

  /**
   * 日別カードは一覧描画後に対象日の詳細ポイントを遅延取得する。
   * 一覧全体の初期表示を軽くし、ミニマップだけ後から埋めるため。
   */
  useEffect(() => {
    getLocationPointsByDate(log.localDate)
      .then(setDailyPoints)
      .catch(() => setDailyPoints([]));
  }, [log.localDate]);

  useEffect(() => {
    let isMounted = true;

    async function loadDailyDetailReport(): Promise<void> {
      if (!isPlusActive || dailyPoints.length === 0) {
        setDailyDetailReport(null);
        return;
      }

      const cellIds = [...new Set(dailyPoints.map((point) => coordinateToGridCell(point).cellId))];
      const [visitedCells, achievementUnlocks] = await Promise.all([
        getVisitedCellsByIds(cellIds),
        getAchievementUnlocksByDate(log.localDate),
      ]);
      const unlockedAchievements = achievementUnlocks.flatMap((unlock) => {
        const definition = getAchievementDefinition(unlock.achievementId);
        return definition ? [{ id: definition.id, title: definition.title, unlockedAt: unlock.unlockedAt }] : [];
      });

      if (isMounted) {
        setDailyDetailReport(createDailyDetailReport({ localDate: log.localDate, points: dailyPoints, visitedCells, unlockedAchievements }));
      }
    }

    loadDailyDetailReport().catch(() => {
      if (isMounted) {
        setDailyDetailReport(null);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [dailyPoints, isPlusActive, log.localDate]);

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

      {isPlusActive ? (
        dailyDetailReport && (
          <View style={styles.dailyDetailPanel}>
            <View style={styles.dailyDetailRow}>
              <Text style={styles.dailyDetailLabel}>訪問エリア</Text>
              <Text style={styles.dailyDetailValue}>{dailyDetailReport.visitedAreaCount}</Text>
            </View>
            <View style={styles.dailyDetailRow}>
              <Text style={styles.dailyDetailLabel}>新規エリア</Text>
              <Text style={styles.dailyDetailValue}>{dailyDetailReport.newAreaCount}</Text>
            </View>
            <View style={styles.dailyDetailRow}>
              <Text style={styles.dailyDetailLabel}>解除した実績</Text>
              <Text style={styles.dailyDetailValue}>{dailyDetailReport.unlockedAchievements.length}</Text>
            </View>
          </View>
        )
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Strollia Plusで日別詳細レポートを見る"
          onPress={onPresentPremiumPaywall}
          style={styles.dailyDetailLockedPanel}
        >
          <Text style={styles.dailyDetailLockedTitle}>Plusで詳細レポートを表示</Text>
          <Text style={styles.dailyDetailLockedText}>訪問エリア、新規エリア、その日に解除した実績を確認できます。</Text>
        </Pressable>
      )}

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
