import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

import { getLocationPointAdminAreaName } from '../../features/achievements/adminAreaRepository';
import { getAchievementDefinition } from '../../features/achievements/achievementDefinitions';
import { getAchievementUnlocksByDate } from '../../features/achievements/achievementRepository';
import { coordinateToGridCell } from '../../features/location/grid/gridCell';
import { getVisitedCellsByIds } from '../../features/location/visitedCellRepository';
import { getLocationPointsByDate } from '../../features/logs/logRepository';
import { computeGifFrameMinutes } from '../../features/export/routeGifFrames';
import { exportRouteGif } from '../../features/export/routeGifExporter';
import { createInitialRegion } from '../../features/map/routeMapper';
import { createDailyDetailReport, DailyDetailReport } from '../../features/reports/dailyReport';
import type { PremiumAccessState } from '../../features/premium/revenueCatAccess';
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
import { ActionPill } from './ActionPill';
import { AppScreenHeader } from './AppScreenHeader';
import { DataSummaryRow } from './DataSummaryRow';
import { DescriptionText } from './DescriptionText';
import { Dialog } from './Dialog';
import { GifFrameRenderer } from './GifFrameRenderer';
import { RouteMapPanel } from './RouteMapPanel';
import { SectionTitle } from './SectionTitle';
import { StepSlider } from './StepSlider';

const GIF_FRAME_STEP_MINUTES = 10;
const GIF_FRAME_DELAY_MS = 500;

export type DailyLogDetailScreenProps = {
  /** 表示対象の日別サマリー。 */
  log: DailyLogSummary;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** Plus課金状態。 */
  premiumAccessState: PremiumAccessState;
  /** 日別ログ一覧へ戻る処理。 */
  onBackToDailyLogs: () => void;
  /** ペイウォールモーダルを開く処理。 */
  onOpenPremiumPaywall: () => void;
};

/** 日ごとの記録の詳細画面を描画する。 */
export function DailyLogDetailScreen({ log, styles, theme, premiumAccessState, onBackToDailyLogs, onOpenPremiumPaywall }: DailyLogDetailScreenProps) {
  const isPlusActive = premiumAccessState.isPlusActive;
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
  const [isSliderDragging, setIsSliderDragging] = useState(false);
  const [isCapturingShare, setIsCapturingShare] = useState(false);
  const [gifProgress, setGifProgress] = useState<{ done: number; total: number } | null>(null);
  const [gifFrameIndex, setGifFrameIndex] = useState(-1);
  const gifAbortRef = useRef(false);
  const gifFrameRef = useRef<View>(null);
  const gifFrameResolveRef = useRef<(() => void) | null>(null);
  const gifMapReadyRef = useRef<(() => void) | null>(null);
  const captureViewRef = useRef<View>(null);
  const title = formatDailyLogDetailTitle(log.localDate);
  const distanceLabel = formatDistanceKm(log.distanceMeters ?? totalDistanceMeters(dailyPoints));
  const showSlider = isPlusActive && routeMaxMinutes >= DAILY_ROUTE_TIME_STEP_MINUTES;
  const visibleRoutePoints = useMemo(
    () => (showSlider ? filterLocationPointsUntilMinute(dailyPoints, routeEndMinutes) : dailyPoints),
    [dailyPoints, routeEndMinutes, showSlider],
  );
  const gifFrameMinutes = useMemo(() => computeGifFrameMinutes(dailyPoints, GIF_FRAME_STEP_MINUTES), [dailyPoints]);
  const canExportGif = isPlusActive && gifFrameMinutes.length >= 2;
  const gifRegion = useMemo(() => (dailyPoints.length > 0 ? createInitialRegion(dailyPoints) : null), [dailyPoints]);
  const isGeneratingGif = gifProgress !== null;
  const gifFramePoints = useMemo(
    () => (gifRegion ? filterLocationPointsUntilMinute(dailyPoints, gifFrameMinutes[gifFrameIndex] ?? 0) : []),
    [dailyPoints, gifFrameMinutes, gifFrameIndex, gifRegion],
  );
  const gifFrameTimeLabel = formatTimelineTimeLabel(gifFrameMinutes[gifFrameIndex] ?? 0);

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

  useEffect(() => {
    if (!isGeneratingGif) {
      return;
    }
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        gifFrameResolveRef.current?.();
        gifFrameResolveRef.current = null;
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [gifFrameIndex, isGeneratingGif]);

  async function shareDailyLogImage(): Promise<void> {
    if (!captureViewRef.current || isSharingDetail) {
      return;
    }

    setIsSharingDetail(true);
    setIsCapturingShare(true);

    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

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
      setIsCapturingShare(false);
      setIsSharingDetail(false);
    }
  }

  function waitForGifMapReady(): Promise<void> {
    return new Promise<void>((resolve) => {
      gifMapReadyRef.current = resolve;
    });
  }

  function renderGifFrame(index: number): Promise<void> {
    return new Promise<void>((resolve) => {
      gifFrameResolveRef.current = resolve;
      setGifFrameIndex(index);
    });
  }

  async function handleExportGif(): Promise<void> {
    if (!canExportGif || isGeneratingGif || !gifRegion) {
      return;
    }
    gifAbortRef.current = false;
    setGifFrameIndex(-1);
    setGifProgress({ done: 0, total: gifFrameMinutes.length });
    try {
      await waitForGifMapReady();
      if (gifAbortRef.current) {
        return;
      }
      const success = await exportRouteGif({
        captureTarget: () => gifFrameRef.current,
        frameCount: gifFrameMinutes.length,
        delayMs: GIF_FRAME_DELAY_MS,
        fileName: `strollia-${log.localDate}`,
        renderFrame: renderGifFrame,
        onProgress: (done, total) => setGifProgress({ done, total }),
        shouldAbort: () => gifAbortRef.current,
      });
      if (!success && !gifAbortRef.current) {
        Alert.alert('GIF出力', 'GIFを生成できませんでした。');
      }
    } catch (error: unknown) {
      Alert.alert('GIF出力失敗', error instanceof Error ? error.message : 'GIFを生成できませんでした。');
    } finally {
      setGifProgress(null);
      setGifFrameIndex(-1);
      gifMapReadyRef.current = null;
      gifFrameResolveRef.current = null;
    }
  }

  function handleCancelGif(): void {
    gifAbortRef.current = true;
    gifMapReadyRef.current?.();
    gifMapReadyRef.current = null;
  }

  return (
    <SafeAreaView style={styles.appScreen}>
      <AppScreenHeader backLabel="日ごとの記録" styles={styles} theme={theme} title={title.title} subtitle={title.subtitle} onBack={onBackToDailyLogs} />
      <ScrollView scrollEnabled={!isSliderDragging} contentContainerStyle={styles.dailyLogDetailContent}>

        {/* キャプチャ範囲 */}
        <View ref={captureViewRef} collapsable={false} style={[styles.dailyLogDetailCapture, { backgroundColor: theme.colors.background }]}>
          <View style={styles.routeTimeline}>
            <RouteMapPanel emptyLabel="移動地図を表示できません" points={visibleRoutePoints} regionPoints={dailyPoints} styles={styles} theme={theme} />
            {showSlider && !isCapturingShare && (
              <StepSlider
                accessibilityLabel="移動地図の表示時刻"
                minValue={DAILY_ROUTE_START_MINUTES}
                maxValue={routeMaxMinutes}
                stepValue={DAILY_ROUTE_TIME_STEP_MINUTES}
                startLabel={formatTimelineHourLabel(DAILY_ROUTE_START_MINUTES)}
                endLabel={routeMaxMinutes % 60 === 0 ? formatTimelineHourLabel(routeMaxMinutes) : formatTimelineTimeLabel(routeMaxMinutes)}
                value={routeEndMinutes}
                valueLabel={formatTimelineTimeLabel(routeEndMinutes)}
                styles={styles}
                theme={theme}
                onDragStart={() => setIsSliderDragging(true)}
                onDragEnd={() => setIsSliderDragging(false)}
                onValueChange={setRouteEndMinutes}
              />
            )}
            {canExportGif && !isCapturingShare && (
              <ActionPill
                disabled={isGeneratingGif}
                icon={<MaterialCommunityIcons name="image-multiple" size={20} color={theme.colors.text} />}
                label="移動記録をGIFで出力"
                styles={styles}
                onPress={() => {
                  handleExportGif().catch(() => undefined);
                }}
              />
            )}
          </View>

          <View style={styles.dailyLogDetailSection}>
            <SectionTitle styles={styles}>移動のデータ</SectionTitle>
            {!isPlusActive && (
              <DescriptionText styles={styles}>移動距離はGPSのブレにより本来の距離より多く記録される場合があります。</DescriptionText>
            )}
            <View style={styles.dataSummaryList}>
              <DataSummaryRow label="移動距離" value={distanceLabel} styles={styles} />
              <DataSummaryRow label="開始地点と終了地点" value={routeEndpointsLabel} styles={styles} />
              {isPlusActive && (
                <>
                  <DataSummaryRow label="訪問したエリア数" value={`${dailyDetailReport?.visitedAreaCount ?? 0}エリア`} styles={styles} />
                  <DataSummaryRow label="新しく訪問したエリア数" value={`${dailyDetailReport?.newAreaCount ?? 0}エリア`} styles={styles} />
                </>
              )}
            </View>
            {isPlusActive && (
              <DescriptionText styles={styles}>移動距離はGPSのブレにより本来の距離より多く記録される場合があります。</DescriptionText>
            )}
          </View>

          {isPlusActive && (
            <View style={styles.dailyLogDetailSection}>
              <SectionTitle styles={styles}>おもいで</SectionTitle>
              <Text style={styles.dailyLogDetailSubTitle}>{isLoadingDetail ? 'この日に獲得した実績を読み込み中' : 'この日に獲得した実績'}</Text>
              <AchievementScroller achievements={dailyDetailReport?.unlockedAchievements ?? []} styles={styles} />
            </View>
          )}
        </View>

        {/* ブラーセクション（一般ユーザーのみ・キャプチャ範囲外） */}
        {!isPlusActive && (
          <View style={[styles.dailyLogDetailSection, styles.dailyLogDetailPlusSection]}>
            <SectionTitle styles={styles}>おもいで</SectionTitle>
            <Text style={styles.dailyLogDetailSubTitle}>{isLoadingDetail ? 'この日に獲得した実績を読み込み中' : 'この日に獲得した実績'}</Text>
            <AchievementScroller achievements={dailyDetailReport?.unlockedAchievements ?? []} styles={styles} />
            <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, lockedOverlayStyles.overlay]}>
              <Text style={styles.dailyLogDetailPlusLabel}>Plusでくわしく！</Text>
            </View>
          </View>
        )}

        {/* アクションボタン群（キャプチャ範囲外） */}
        <View style={styles.dailyLogDetailActions}>
          <ActionPill
            disabled={isSharingDetail}
            icon={<Feather name="share-2" size={20} color={theme.colors.text} />}
            label="この日の記録を共有"
            styles={styles}
            onPress={() => {
              shareDailyLogImage().catch(() => undefined);
            }}
          />
          {!isPlusActive && (
            <>
              <ActionPill
                backgroundColor={theme.colors.plusCtaBackground}
                borderColor={theme.colors.primary}
                icon={<MaterialCommunityIcons name="chevron-right" size={21} color={theme.colors.primary} />}
                label="Plusでもっと詳しく！"
                styles={styles}
                textColor={theme.colors.primary}
                onPress={onOpenPremiumPaywall}
              />
              <DescriptionText styles={styles}>移動軌跡を時系列でふりかえられたり、獲得した実績、エリア数などもみることができます！</DescriptionText>
            </>
          )}
        </View>

      </ScrollView>

      {isGeneratingGif && gifRegion && (
        <GifFrameRenderer
          ref={gifFrameRef}
          region={gifRegion}
          points={gifFramePoints}
          timeLabel={gifFrameTimeLabel}
          styles={styles}
          theme={theme}
          onMapReady={() => {
            gifMapReadyRef.current?.();
            gifMapReadyRef.current = null;
          }}
        />
      )}

      <Dialog visible={isGeneratingGif} dismissible={false} swipeToClose={false} styles={styles} onClose={() => undefined}>
        <Text style={styles.gifProgressTitle}>アニメGIF生成中…</Text>
        <Text style={styles.gifProgressBody}>生成が終わるまで少しお待ちください。画面を閉じないでください。</Text>
        <View style={styles.gifProgressTrack}>
          <View
            style={[
              styles.gifProgressFill,
              { width: `${gifProgress ? Math.round((gifProgress.done / Math.max(gifProgress.total, 1)) * 100) : 0}%` as unknown as number },
            ]}
          />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="GIF生成をキャンセル" style={styles.gifProgressCancel} onPress={handleCancelGif}>
          <Text style={styles.gifProgressCancelText}>キャンセル</Text>
        </Pressable>
      </Dialog>
    </SafeAreaView>
  );
}

const lockedOverlayStyles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
