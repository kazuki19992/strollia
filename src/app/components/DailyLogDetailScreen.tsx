import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, Text, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

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
  computeRouteMaxEndMinutes,
  DAILY_ROUTE_START_MINUTES,
  DAILY_ROUTE_TIME_STEP_MINUTES,
  filterLocationPointsUntilMinute,
  formatTimelineHourLabel,
  formatTimelineTimeLabel,
  getCurrentMinutesOfDay,
  getTodayLocalDate,
} from '../dailyRouteTimeline';
import { formatDailyLogDetailTitle, formatDistanceKm, formatRouteEndpoints } from '../dailyLogDisplay';
import { totalDistanceMeters } from '../../utils/distance';
import type { AppStyles } from '../appStyles';
import { AchievementScroller } from './AchievementScroller';
import { AppScreenHeader } from './AppScreenHeader';
import { DataSummaryRow } from './DataSummaryRow';
import { DescriptionText } from './DescriptionText';
import { RouteMapPanel } from './RouteMapPanel';
import { SectionTitle } from './SectionTitle';
import { ShareButton } from './ShareButton';
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
  const [routeMaxMinutes, setRouteMaxMinutes] = useState(() =>
    computeRouteMaxEndMinutes(log.localDate, getTodayLocalDate(), getCurrentMinutesOfDay()),
  );
  const [routeEndMinutes, setRouteEndMinutes] = useState(() =>
    computeRouteMaxEndMinutes(log.localDate, getTodayLocalDate(), getCurrentMinutesOfDay()),
  );
  const [isSharingDetail, setIsSharingDetail] = useState(false);
  const captureViewRef = useRef<View>(null);
  const title = formatDailyLogDetailTitle(log.localDate);
  const distanceLabel = formatDistanceKm(log.distanceMeters ?? totalDistanceMeters(dailyPoints));
  const showSlider = routeMaxMinutes >= DAILY_ROUTE_TIME_STEP_MINUTES;
  const visibleRoutePoints = useMemo(
    () => (showSlider ? filterLocationPointsUntilMinute(dailyPoints, routeEndMinutes) : dailyPoints),
    [dailyPoints, routeEndMinutes, showSlider],
  );

  useEffect(() => {
    let isCancelled = false;
    const maxMinutes = computeRouteMaxEndMinutes(log.localDate, getTodayLocalDate(), getCurrentMinutesOfDay());
    setRouteMaxMinutes(maxMinutes);

    async function loadDetail(): Promise<void> {
      setIsLoadingDetail(true);
      setRouteEndMinutes(maxMinutes);

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
  }, [log]);

  async function shareDailyLogImage(): Promise<void> {
    if (!captureViewRef.current || isSharingDetail) {
      return;
    }

    setIsSharingDetail(true);

    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('共有できません', 'この環境では共有シートを利用できません。');
        return;
      }

      const uri = await captureRef(captureViewRef.current, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      await Sharing.shareAsync(uri, {
        dialogTitle: `すとろりあ 日別記録 ${title.subtitle}${title.title}`,
        mimeType: 'image/png',
        UTI: 'public.png',
      });
    } catch (error: unknown) {
      Alert.alert('共有失敗', error instanceof Error ? error.message : 'この日の記録を共有できませんでした。');
    } finally {
      setIsSharingDetail(false);
    }
  }

  return (
    <SafeAreaView style={styles.appScreen}>
      <AppScreenHeader backLabel="日ごとの記録" styles={styles} theme={theme} title={title.title} subtitle={title.subtitle} onBack={onBackToDailyLogs} />
      <ScrollView contentContainerStyle={styles.dailyLogDetailContent}>
        <View ref={captureViewRef} collapsable={false} style={[styles.dailyLogDetailCapture, { backgroundColor: theme.colors.background }]}>
          <View style={styles.routeTimeline}>
            <RouteMapPanel emptyLabel="移動地図を表示できません" points={visibleRoutePoints} regionPoints={dailyPoints} styles={styles} theme={theme} />
            {showSlider && (
              <StepSlider
                accessibilityLabel="移動地図の表示時刻"
                minValue={DAILY_ROUTE_START_MINUTES}
                maxValue={routeMaxMinutes}
                stepValue={DAILY_ROUTE_TIME_STEP_MINUTES}
                startLabel={formatTimelineHourLabel(DAILY_ROUTE_START_MINUTES)}
                endLabel={formatTimelineHourLabel(routeMaxMinutes)}
                value={routeEndMinutes}
                valueLabel={formatTimelineTimeLabel(routeEndMinutes)}
                styles={styles}
                theme={theme}
                onValueChange={setRouteEndMinutes}
              />
            )}
          </View>

          <View style={styles.dailyLogDetailSection}>
            <SectionTitle styles={styles}>移動のデータ</SectionTitle>
            <View style={styles.dataSummaryList}>
              <DataSummaryRow label="移動距離" value={distanceLabel} styles={styles} />
              <DataSummaryRow label="開始地点と終了地点" value={routeEndpointsLabel} styles={styles} />
              <DataSummaryRow label="訪問したエリア数" value={`${dailyDetailReport?.visitedAreaCount ?? 0}エリア`} styles={styles} />
              <DataSummaryRow label="新しく訪問したエリア数" value={`${dailyDetailReport?.newAreaCount ?? 0}エリア`} styles={styles} />
            </View>
            <DescriptionText styles={styles}>移動距離はGPSのブレにより本来の距離より多く記録される場合があります。</DescriptionText>
          </View>

          <View style={styles.dailyLogDetailSection}>
            <SectionTitle styles={styles}>おもいで</SectionTitle>
            <Text style={styles.dailyLogDetailSubTitle}>{isLoadingDetail ? 'この日に獲得した実績を読み込み中' : 'この日に獲得した実績'}</Text>
            <AchievementScroller achievements={dailyDetailReport?.unlockedAchievements ?? []} styles={styles} />
          </View>
        </View>

        <ShareButton
          accessibilityLabel="この日の記録を共有"
          disabled={isSharingDetail}
          iconColor="#aaaaaa"
          iconSize={24}
          label="この日の記録を共有"
          style={styles.shareButtonWide}
          textStyle={styles.shareButtonWideText}
          variant="wide"
          onPress={() => {
            shareDailyLogImage().catch(() => undefined);
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
