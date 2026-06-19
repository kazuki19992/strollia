import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Dimensions, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

import { getLocationPointAdminAreaName } from '../../features/achievements/adminAreaRepository';
import { getAchievementDefinition } from '../../features/achievements/achievementDefinitions';
import { getAchievementUnlocksByDate } from '../../features/achievements/achievementRepository';
import { coordinateToGridCell } from '../../features/location/grid/gridCell';
import { getVisitedCellsByIds } from '../../features/location/visitedCellRepository';
import { getLocationPointsByDate } from '../../features/logs/logRepository';
import {
  computeGifFrameMinutesInRange,
  resolveGifFrameStepMinutes,
  GIF_FRAME_DELAY_MS,
  GIF_MIN_RANGE_MINUTES,
} from '../../features/export/routeGifFrames';
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
  filterLocationPointsBetweenMinutes,
  filterLocationPointsUntilMinute,
  formatTimelineTimeLabel,
  formatTimelineTimeLabelPadded,
  getCurrentMinutesOfDay,
  getPointMinutesOfDay,
  getTodayLocalDate,
} from '../dailyRouteTimeline';
import { formatDailyLogDetailTitle, formatDistanceKm, formatGifFrameDateLabel, formatRouteEndpoints } from '../dailyLogDisplay';
import { totalDistanceMeters } from '../../utils/distance';
import type { AppStyles } from '../appStyles';
import { AchievementScroller } from './AchievementScroller';
import { ActionPill } from './ActionPill';
import { AppScreenHeader } from './AppScreenHeader';
import { DailyLogShareCard } from './DailyLogShareCard';
import { DailyLogShareSections } from './DailyLogShareSections';
import { DescriptionText } from './DescriptionText';
import { animateDialogResize, Dialog } from './Dialog';
import { GifFrameRenderer } from './GifFrameRenderer';
import { RangeSlider } from './RangeSlider';
import { RouteMapPanel } from './RouteMapPanel';
import { SectionTitle } from './SectionTitle';
import { StepSlider } from './StepSlider';

/** GIF区間指定スライダーの選択粒度（分）。最小単位時間と同じ15分刻みで、00/15/30/45分に揃える。 */
const GIF_RANGE_STEP_MINUTES = GIF_MIN_RANGE_MINUTES;
/** 地図のタイル描画完了待ちのフォールバック上限（ミリ秒）。onMapLoadedが発火しない端末向け。 */
const GIF_MAP_READY_TIMEOUT_MS = 6000;
/** 各コマで Polyline 等のネイティブ更新が反映されるのを待つフレーム数。少ないと線が伸びない瞬間が出る。 */
const GIF_FRAME_RENDER_SETTLE_FRAMES = 6;

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
  const [gifProgress, setGifProgress] = useState<{ done: number; total: number } | null>(null);
  const [gifFrameIndex, setGifFrameIndex] = useState(-1);
  const [isSelectingGifRange, setIsSelectingGifRange] = useState(false);
  const [gifRangeStart, setGifRangeStart] = useState(0);
  const [gifRangeEnd, setGifRangeEnd] = useState(0);
  const gifAbortRef = useRef(false);
  const gifFrameRef = useRef<View>(null);
  const gifFrameResolveRef = useRef<(() => void) | null>(null);
  const gifMapReadyRef = useRef<(() => void) | null>(null);
  // 実行中の生成ループ。キャンセル後の再実行で、前のループ完了を待ってから次を始めるために使う。
  const gifGenerationRef = useRef<Promise<void> | null>(null);
  const shareCardRef = useRef<View>(null);
  const shareMapReadyRef = useRef<(() => void) | null>(null);
  const shareAbortRef = useRef(false);
  // 画面を離れたかどうか。離脱後のキャプチャ・アラート・state更新を抑止する。
  const isMountedRef = useRef(true);
  const title = formatDailyLogDetailTitle(log.localDate);
  const distanceLabel = formatDistanceKm(log.distanceMeters ?? totalDistanceMeters(dailyPoints));
  const showSlider = isPlusActive && routeMaxMinutes >= DAILY_ROUTE_TIME_STEP_MINUTES;
  const visibleRoutePoints = useMemo(
    () => (showSlider ? filterLocationPointsUntilMinute(dailyPoints, routeEndMinutes) : dailyPoints),
    [dailyPoints, routeEndMinutes, showSlider],
  );
  // 記録の最初/最後の時刻（GIF区間指定スライダーの範囲）。
  const recordingStartMinute = dailyPoints.length > 0 ? getPointMinutesOfDay(dailyPoints[0]) : 0;
  const recordingEndMinute = dailyPoints.length > 0 ? getPointMinutesOfDay(dailyPoints[dailyPoints.length - 1]) : 0;
  // スライダーの選択肢を00/15/30/45分に揃えるため、範囲を15分境界へ丸める。
  const gifRangeMinMinute = Math.floor(recordingStartMinute / GIF_RANGE_STEP_MINUTES) * GIF_RANGE_STEP_MINUTES;
  const gifRangeMaxMinute = Math.ceil(recordingEndMinute / GIF_RANGE_STEP_MINUTES) * GIF_RANGE_STEP_MINUTES;
  const canExportGif = isPlusActive && dailyPoints.length >= 2 && gifRangeMaxMinute - gifRangeMinMinute >= GIF_MIN_RANGE_MINUTES;
  // 選択区間内のポイント（プレビュー地図と地図範囲フィットに使う）。
  const gifRangePoints = useMemo(
    () => filterLocationPointsBetweenMinutes(dailyPoints, gifRangeStart, gifRangeEnd),
    [dailyPoints, gifRangeStart, gifRangeEnd],
  );
  // 選択区間を刻んだ各コマの時刻。既定は15分刻みだが、最短5秒に満たない短い区間は刻みを細かくする。
  const gifFrameMinutes = useMemo(() => {
    const step = resolveGifFrameStepMinutes(gifRangeEnd - gifRangeStart);
    return computeGifFrameMinutesInRange(gifRangeStart, gifRangeEnd, step);
  }, [gifRangeStart, gifRangeEnd]);
  const gifRegion = useMemo(
    () => (gifRangePoints.length > 0 ? createInitialRegion(gifRangePoints) : null),
    [gifRangePoints],
  );
  const isGeneratingGif = gifProgress !== null;
  // 各コマは選択開始時刻からその時刻までの累積軌跡（区間内のみ）。
  const gifFrameMinute = gifFrameMinutes[gifFrameIndex] ?? gifRangeStart;
  const gifFramePoints = useMemo(
    () => filterLocationPointsBetweenMinutes(dailyPoints, gifRangeStart, gifFrameMinute),
    [dailyPoints, gifRangeStart, gifFrameMinute],
  );
  const gifFrameTimeLabel = formatTimelineTimeLabelPadded(gifFrameMinute);
  const gifFrameDateLabel = formatGifFrameDateLabel(log.localDate);

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

  // 画面を離れたら、進行中の共有/GIF生成を中断する。
  // 待ち（地図ロード）を解決してループを巻き戻し、離脱後のキャプチャやアラートを抑止する。
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      gifAbortRef.current = true;
      shareAbortRef.current = true;
      gifMapReadyRef.current?.();
      gifMapReadyRef.current = null;
      shareMapReadyRef.current?.();
      shareMapReadyRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isGeneratingGif) {
      return;
    }
    // Polyline などネイティブのオーバーレイ更新が反映されてからキャプチャするため、
    // 数フレーム待ってから解決する（少なすぎると更新前の状態を撮ってしまい、線が伸びない瞬間が出る）。
    let rafId = 0;
    let remaining = GIF_FRAME_RENDER_SETTLE_FRAMES;
    const tick = () => {
      remaining -= 1;
      if (remaining <= 0) {
        gifFrameResolveRef.current?.();
        gifFrameResolveRef.current = null;
        return;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [gifFrameIndex, isGeneratingGif]);

  // 共有用カードの地図タイル描画完了を待つ。発火しない端末でも詰まらないようフォールバックを設ける。
  function waitForShareMapReady(): Promise<void> {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        shareMapReadyRef.current = null;
        resolve();
      }, GIF_MAP_READY_TIMEOUT_MS);
      shareMapReadyRef.current = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }

  async function shareDailyLogImage(): Promise<void> {
    if (isSharingDetail) {
      return;
    }

    // 画面外に共有用カード（スライダー・ボタンを含まない）をマウントしてキャプチャするため、
    // 画面上のスライダーや共有ボタンは消えない。
    shareAbortRef.current = false;
    setIsSharingDetail(true);

    try {
      // ポイントがある日だけ地図のタイル描画完了を待つ。空の日は MapView がマウントされず
      // onMapLoaded が発火しないため、待つとフォールバックの数秒間ぶん無駄に待ってしまう。
      if (dailyPoints.length > 0) {
        await waitForShareMapReady();
      }

      // 画面を離れた／カードが消えたら、別画面をキャプチャせず中断する。
      if (shareAbortRef.current || !shareCardRef.current) {
        return;
      }

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('共有できません', 'この環境では共有シートを利用できません。');
        return;
      }

      const uri = await captureRef(shareCardRef.current, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      // キャプチャ中に画面を離れた／中断された場合は共有しない。
      if (shareAbortRef.current || !isMountedRef.current) {
        return;
      }

      await Sharing.shareAsync(uri, {
        dialogTitle: `すとろりあ 日別記録 ${title.subtitle}${title.title}`,
        mimeType: 'image/png',
        UTI: 'public.png',
      });
    } catch (error: unknown) {
      if (!shareAbortRef.current && isMountedRef.current) {
        Alert.alert('共有失敗', error instanceof Error ? error.message : 'この日の記録を共有できませんでした。');
      }
    } finally {
      shareMapReadyRef.current = null;
      if (isMountedRef.current) {
        setIsSharingDetail(false);
      }
    }
  }

  // 地図のタイル描画完了（onMapLoaded）を待つ。最初のコマが読み込み途中で撮られて
  // 半分しか表示されない/軌跡線が出ない問題を防ぐ。万一発火しない端末でも詰まらないよう
  // フォールバックのタイムアウトを設ける。
  function waitForGifMapReady(): Promise<void> {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        gifMapReadyRef.current = null;
        resolve();
      }, GIF_MAP_READY_TIMEOUT_MS);
      gifMapReadyRef.current = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }

  function renderGifFrame(index: number): Promise<void> {
    return new Promise<void>((resolve) => {
      gifFrameResolveRef.current = resolve;
      setGifFrameIndex(index);
    });
  }

  function openGifRangeSelection(): void {
    setGifRangeStart(gifRangeMinMinute);
    setGifRangeEnd(gifRangeMaxMinute);
    setIsSelectingGifRange(true);
  }

  function handleConfirmGifRange(): void {
    // 区間選択→生成中で中身の高さが変わるので、滑らかにリサイズさせる。
    animateDialogResize();
    handleExportGif().catch(() => undefined);
  }

  async function handleExportGif(): Promise<void> {
    if (!canExportGif || !gifRegion || gifFrameMinutes.length < 2) {
      return;
    }

    // 直前の生成がキャンセル後にまだ巻き戻り中なら、中断させて完了を待ってから新しい生成を始める。
    // refを共有しているため、前のループと新しいループを重ねて走らせない。
    if (gifGenerationRef.current) {
      gifAbortRef.current = true;
      gifMapReadyRef.current?.();
      gifMapReadyRef.current = null;
      await gifGenerationRef.current;
    }

    const total = gifFrameMinutes.length;
    const run = (async () => {
      gifAbortRef.current = false;
      setGifFrameIndex(-1);
      setIsSelectingGifRange(false);
      setGifProgress({ done: 0, total });
      try {
        await waitForGifMapReady();
        if (gifAbortRef.current) {
          return;
        }
        const success = await exportRouteGif({
          captureTarget: () => gifFrameRef.current,
          frameCount: total,
          delayMs: GIF_FRAME_DELAY_MS,
          fileName: `strollia-${log.localDate}`,
          renderFrame: renderGifFrame,
          onProgress: (done, frameTotal) => setGifProgress({ done, total: frameTotal }),
          shouldAbort: () => gifAbortRef.current,
        });
        if (!success && !gifAbortRef.current && isMountedRef.current) {
          Alert.alert('GIF出力', 'GIFを生成できませんでした。');
        }
      } catch (error: unknown) {
        if (!gifAbortRef.current && isMountedRef.current) {
          Alert.alert('GIF出力失敗', error instanceof Error ? error.message : 'GIFを生成できませんでした。');
        }
      } finally {
        if (isMountedRef.current) {
          setGifProgress(null);
          setGifFrameIndex(-1);
        }
        gifMapReadyRef.current = null;
        gifFrameResolveRef.current = null;
      }
    })();
    gifGenerationRef.current = run;
    try {
      await run;
    } finally {
      if (gifGenerationRef.current === run) {
        gifGenerationRef.current = null;
      }
    }
  }

  function handleCancelGif(): void {
    gifAbortRef.current = true;
    gifMapReadyRef.current?.();
    gifMapReadyRef.current = null;
    // 生成を中断し、ダイアログは閉じずに区間選択へ戻す（裏でループは安全に巻き戻る）。
    animateDialogResize();
    setIsSelectingGifRange(true);
  }

  return (
    <SafeAreaView style={styles.appScreen}>
      <AppScreenHeader backLabel="日ごとの記録" styles={styles} theme={theme} title={title.title} subtitle={title.subtitle} onBack={onBackToDailyLogs} />
      <ScrollView scrollEnabled={!isSliderDragging} contentContainerStyle={styles.dailyLogDetailContent}>

        {/* 画面表示用。共有画像は画面外の DailyLogShareCard をキャプチャするため、
            ここにあるスライダー・GIFボタンは共有時も消えない。 */}
        <View style={[styles.dailyLogDetailCapture, { backgroundColor: theme.colors.background }]}>
          <View style={styles.routeTimeline}>
            <RouteMapPanel emptyLabel="移動地図を表示できません" points={visibleRoutePoints} regionPoints={dailyPoints} styles={styles} theme={theme} />
            {showSlider && (
              <StepSlider
                accessibilityLabel="移動地図の表示時刻"
                minValue={DAILY_ROUTE_START_MINUTES}
                maxValue={routeMaxMinutes}
                stepValue={DAILY_ROUTE_TIME_STEP_MINUTES}
                startLabel={formatTimelineTimeLabel(DAILY_ROUTE_START_MINUTES)}
                endLabel={formatTimelineTimeLabel(routeMaxMinutes)}
                value={routeEndMinutes}
                valueLabel={formatTimelineTimeLabel(routeEndMinutes)}
                styles={styles}
                theme={theme}
                onDragStart={() => setIsSliderDragging(true)}
                onDragEnd={() => setIsSliderDragging(false)}
                onValueChange={setRouteEndMinutes}
              />
            )}
            {canExportGif && (
              <ActionPill
                disabled={isGeneratingGif}
                icon={<MaterialCommunityIcons name="image-multiple" size={20} color={theme.colors.text} />}
                label="移動記録をGIFで出力"
                styles={styles}
                onPress={openGifRangeSelection}
              />
            )}
          </View>

          <DailyLogShareSections
            isPlusActive={isPlusActive}
            distanceLabel={distanceLabel}
            routeEndpointsLabel={routeEndpointsLabel}
            dailyDetailReport={dailyDetailReport}
            isLoadingDetail={isLoadingDetail}
            styles={styles}
          />
        </View>

        {/* ブラーセクション（一般ユーザーのみ） */}
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
            label={isSharingDetail ? '画像を作っています……' : 'この日の記録を共有'}
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

      {isSharingDetail && (
        <DailyLogShareCard
          ref={shareCardRef}
          width={Dimensions.get('window').width}
          points={visibleRoutePoints}
          regionPoints={dailyPoints}
          isPlusActive={isPlusActive}
          distanceLabel={distanceLabel}
          routeEndpointsLabel={routeEndpointsLabel}
          dailyDetailReport={dailyDetailReport}
          isLoadingDetail={isLoadingDetail}
          dateLabel={gifFrameDateLabel}
          styles={styles}
          theme={theme}
          onMapLoaded={() => {
            shareMapReadyRef.current?.();
            shareMapReadyRef.current = null;
          }}
        />
      )}

      {isGeneratingGif && gifRegion && (
        <GifFrameRenderer
          ref={gifFrameRef}
          region={gifRegion}
          points={gifFramePoints}
          timeLabel={gifFrameTimeLabel}
          dateLabel={gifFrameDateLabel}
          styles={styles}
          theme={theme}
          onMapLoaded={() => {
            gifMapReadyRef.current?.();
            gifMapReadyRef.current = null;
          }}
        />
      )}

      {/* 区間選択と生成中は同じ Dialog（=同じ Modal）を使う。別 Modal にすると、選択ダイアログの
          閉じアニメーション中に生成ダイアログを開くことになり、多重モーダルで生成中が表示されない。 */}
      <Dialog
        visible={isSelectingGifRange || isGeneratingGif}
        dismissible={isSelectingGifRange}
        swipeToClose={false}
        styles={styles}
        onClose={() => {
          if (isSelectingGifRange) {
            setIsSelectingGifRange(false);
          }
        }}
      >
        {/* 区間選択を優先表示。キャンセル時は isSelectingGifRange を立てて即座に選択へ戻る
            （生成ループは裏で巻き戻る）。 */}
        {!isSelectingGifRange && isGeneratingGif ? (
          <View style={styles.gifRangeContent}>
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
          </View>
        ) : (
          <View style={styles.gifRangeContent}>
            <Text style={styles.gifRangeTitle}>GIFにする時間範囲</Text>
            <Text style={styles.gifRangeBody}>出力する移動の開始・終了時刻を選べます。範囲が短いほど早く生成できます。</Text>
            <RouteMapPanel
              emptyLabel="この範囲に移動記録がありません"
              points={gifRangePoints}
              regionPoints={dailyPoints}
              styles={styles}
              theme={theme}
            />
            <RangeSlider
              accessibilityLabel="GIFにする時間範囲"
              minValue={gifRangeMinMinute}
              maxValue={gifRangeMaxMinute}
              stepValue={GIF_RANGE_STEP_MINUTES}
              minSeparation={GIF_MIN_RANGE_MINUTES}
              startValue={gifRangeStart}
              endValue={gifRangeEnd}
              startLabel={formatTimelineTimeLabel(gifRangeMinMinute)}
              endLabel={formatTimelineTimeLabel(gifRangeMaxMinute)}
              valueLabel={`${formatTimelineTimeLabel(gifRangeStart)} 〜 ${formatTimelineTimeLabel(gifRangeEnd)}`}
              styles={styles}
              theme={theme}
              onChange={(start, end) => {
                setGifRangeStart(start);
                setGifRangeEnd(end);
              }}
            />
            <ActionPill
              disabled={gifFrameMinutes.length < 2 || !gifRegion}
              icon={<MaterialCommunityIcons name="image-multiple" size={20} color={theme.colors.text} />}
              label="この範囲で出力"
              styles={styles}
              onPress={handleConfirmGifRange}
            />
          </View>
        )}
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
