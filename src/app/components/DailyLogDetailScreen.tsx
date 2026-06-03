import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, Share, Text, View } from 'react-native';

import { getLocationPointAdminAreaName } from '../../features/achievements/adminAreaRepository';
import { getAchievementDefinition } from '../../features/achievements/achievementDefinitions';
import { getAchievementUnlocksByDate } from '../../features/achievements/achievementRepository';
import { coordinateToGridCell } from '../../features/location/grid/gridCell';
import { getVisitedCellsByIds } from '../../features/location/visitedCellRepository';
import { getLocationPointsByDate } from '../../features/logs/logRepository';
import { createDailyDetailReport, DailyDetailReport } from '../../features/reports/dailyReport';
import type { AppTheme } from '../../theme/theme';
import type { DailyLogSummary, LocationPoint } from '../../types/gps';
import {
  DAILY_ROUTE_END_MINUTES,
  DAILY_ROUTE_START_MINUTES,
  DAILY_ROUTE_TIME_STEP_MINUTES,
  filterLocationPointsUntilMinute,
  formatTimelineHourLabel,
} from '../dailyRouteTimeline';
import { formatDailyLogDetailTitle, formatDistanceKm, formatRouteEndpoints } from '../dailyLogDisplay';
import { totalDistanceMeters } from '../../utils/distance';
import type { AppStyles } from '../appStyles';
import { AchievementScroller } from './AchievementScroller';
import { ActionPill } from './ActionPill';
import { AppScreenHeader } from './AppScreenHeader';
import { DataSummaryRow } from './DataSummaryRow';
import { RouteMapPanel } from './RouteMapPanel';
import { SectionTitle } from './SectionTitle';
import { StepSlider } from './StepSlider';

export type DailyLogDetailScreenProps = {
  /** 表示対象の日別サマリー。 */
  log: DailyLogSummary;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 日別ログ一覧へ戻る処理。 */
  onBackToDailyLogs: () => void;
};

/** 日ごとの記録の詳細画面を描画する。 */
export function DailyLogDetailScreen({ log, styles, theme, onBackToDailyLogs }: DailyLogDetailScreenProps) {
  const [dailyPoints, setDailyPoints] = useState<LocationPoint[]>([]);
  const [dailyDetailReport, setDailyDetailReport] = useState<DailyDetailReport | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(true);
  const [routeEndpointsLabel, setRouteEndpointsLabel] = useState(formatRouteEndpoints());
  const [routeEndMinutes, setRouteEndMinutes] = useState(DAILY_ROUTE_END_MINUTES);
  const title = formatDailyLogDetailTitle(log.localDate);
  const distanceLabel = formatDistanceKm(log.distanceMeters ?? totalDistanceMeters(dailyPoints));
  const visibleRoutePoints = useMemo(() => filterLocationPointsUntilMinute(dailyPoints, routeEndMinutes), [dailyPoints, routeEndMinutes]);
  const shareMessage = useMemo(() => `Strolliaで${title.subtitle}${title.title}に${distanceLabel}移動しました。`, [distanceLabel, title.subtitle, title.title]);

  useEffect(() => {
    let isCancelled = false;

    async function loadDetail(): Promise<void> {
      setIsLoadingDetail(true);
      setRouteEndMinutes(DAILY_ROUTE_END_MINUTES);

      try {
        const points = await getLocationPointsByDate(log.localDate);
        const firstPoint = points[0] ?? null;
        const lastPoint = points.at(-1) ?? null;
        const cellIds = [...new Set(points.map((point) => coordinateToGridCell(point).cellId))];
        const [visitedCells, achievementUnlocks, startArea, endArea] = await Promise.all([
          getVisitedCellsByIds(cellIds),
          getAchievementUnlocksByDate(log.localDate),
          firstPoint ? getLocationPointAdminAreaName(firstPoint.id) : Promise.resolve(null),
          lastPoint ? getLocationPointAdminAreaName(lastPoint.id) : Promise.resolve(null),
        ]);
        const unlockedAchievements = achievementUnlocks.flatMap((unlock) => {
          const definition = getAchievementDefinition(unlock.achievementId);
          return definition
            ? [{ id: definition.id, title: definition.title, unlockedAt: unlock.unlockedAt, trophyImage: definition.trophyImage }]
            : [];
        });
        const report = createDailyDetailReport({ localDate: log.localDate, points, visitedCells, unlockedAchievements });

        if (!isCancelled) {
          setDailyPoints(points);
          setDailyDetailReport(report);
          setRouteEndpointsLabel(formatRouteEndpoints(startArea?.areaName, endArea?.areaName));
        }
      } catch {
        if (!isCancelled) {
          setDailyPoints([]);
          setDailyDetailReport(null);
          setRouteEndpointsLabel(formatRouteEndpoints());
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingDetail(false);
        }
      }
    }

    loadDetail().catch(() => undefined);

    return () => {
      isCancelled = true;
    };
  }, [log.localDate]);

  async function shareDailyLog(): Promise<void> {
    try {
      await Share.share({ message: shareMessage });
    } catch (error: unknown) {
      Alert.alert('共有失敗', error instanceof Error ? error.message : 'この日の記録を共有できませんでした。');
    }
  }

  return (
    <SafeAreaView style={styles.appScreen}>
      <AppScreenHeader backLabel="日ごとの記録" styles={styles} theme={theme} title={title.title} subtitle={title.subtitle} onBack={onBackToDailyLogs} />
      <ScrollView contentContainerStyle={styles.dailyLogDetailContent}>
        <View style={styles.routeTimeline}>
          <RouteMapPanel emptyLabel="移動地図を表示できません" points={visibleRoutePoints} regionPoints={dailyPoints} styles={styles} theme={theme} />
          <StepSlider
            accessibilityLabel="移動地図の表示時刻"
            minValue={DAILY_ROUTE_START_MINUTES}
            maxValue={DAILY_ROUTE_END_MINUTES}
            stepValue={DAILY_ROUTE_TIME_STEP_MINUTES}
            startLabel={formatTimelineHourLabel(DAILY_ROUTE_START_MINUTES)}
            endLabel={formatTimelineHourLabel(DAILY_ROUTE_END_MINUTES)}
            value={routeEndMinutes}
            styles={styles}
            onValueChange={setRouteEndMinutes}
          />
        </View>

        <View style={styles.dailyLogDetailSection}>
          <SectionTitle styles={styles}>移動のデータ</SectionTitle>
          <View style={styles.dataSummaryList}>
            <DataSummaryRow label="移動距離" value={distanceLabel} styles={styles} />
            <DataSummaryRow label="開始地点と終了地点" value={routeEndpointsLabel} styles={styles} />
            <DataSummaryRow label="訪問したエリア数" value={`${dailyDetailReport?.visitedAreaCount ?? 0}エリア`} styles={styles} />
            <DataSummaryRow label="新しく訪問したエリア数" value={`${dailyDetailReport?.newAreaCount ?? 0}エリア`} styles={styles} />
          </View>
        </View>

        <View style={styles.dailyLogDetailSection}>
          <SectionTitle styles={styles}>おもいで</SectionTitle>
          <Text style={styles.dailyLogDetailSubTitle}>{isLoadingDetail ? 'この日に獲得した実績を読み込み中' : 'この日に獲得した実績'}</Text>
          <AchievementScroller achievements={dailyDetailReport?.unlockedAchievements ?? []} styles={styles} />
        </View>

        <ActionPill
          backgroundColor={theme.name === 'dark' ? '#3f3f3f' : '#333333'}
          borderColor="transparent"
          icon={<Feather name="share-2" size={24} color="#aaaaaa" />}
          label="共有"
          styles={styles}
          textColor="#ffffff"
          onPress={() => {
            shareDailyLog().catch(() => undefined);
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
