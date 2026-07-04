import { Feather } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { useMemo, useRef, useState } from 'react';
import { Alert, Animated, Image, Pressable, SafeAreaView, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { captureRef } from 'react-native-view-shot';

import { AchievementListItem } from '../../../features/achievements/achievementRepository';
import { MonthlyAreaReport } from '../../../features/reports/monthlyAreaReport';
import { createMonthlyReport, getPreviousReportMonth, hasMonthlyReportData, MonthlyReport } from '../../../features/reports/monthlyReport';
import { createInitialRegion, toRenderRouteCoordinates } from '../../../features/map/routeMapper';
import { DailyLogSummary, LocationPoint } from '../../../types/gps';
import type { AppTheme } from '../../../theme/theme';
import { MonthlyReportAnimatedCard } from './MonthlyReportAnimatedCard';
import { MonthlyReportMetricValue } from './MonthlyReportMetricValue';
import { MonthlyReportScrollIndicator } from './MonthlyReportScrollIndicator';
import { NewRecordPill } from './NewRecordPill';
import { ShareBranding } from '../ShareBranding';
import { ShareButton } from '../ShareButton';
import { reportStyles } from './reportStyles';

/** 月次レポート画面のprops。 */
export type MonthlyReportScreenProps = {
  /** 日別ログ一覧。 */
  dailyLogs: DailyLogSummary[];
  /** GPSポイント一覧。 */
  points: LocationPoint[];
  /** 実績一覧。 */
  achievements: AchievementListItem[];
  /** 月次行政区域サマリー。 */
  monthlyAreaReport: MonthlyAreaReport | null;
  /** アプリ全体で解決済みのテーマ。 */
  theme: AppTheme;
  /** 地図画面へ戻る処理。 */
  onBackToMap: () => void;
};

type MonthlyDistanceSummary = {
  isMonthlyDistanceRecord: boolean;
  lifetimeDistanceMeters: number;
  longestDay: DailyLogSummary | null;
  isLongestDayRecord: boolean;
};

const rankingLabels = ['1st', '2nd', '3rd'] as const;

/** メートルをkm表記の数値へ変換する。 */
function kilometers(valueMeters: number, fractionDigits = 2): string {
  return (valueMeters / 1000).toFixed(fractionDigits);
}

/** 月ごとの移動距離を日別ログから集計する。 */
function createMonthlyDistanceMap(dailyLogs: DailyLogSummary[]): Map<string, number> {
  return dailyLogs.reduce((distanceMap, log) => {
    const monthKey = log.localDate.slice(0, 7);
    distanceMap.set(monthKey, (distanceMap.get(monthKey) ?? 0) + (log.distanceMeters ?? 0));
    return distanceMap;
  }, new Map<string, number>());
}

/** 月の日別ログから通算・最長日・月間記録を集計する。 */
function createMonthlyDistanceSummary(dailyLogs: DailyLogSummary[], report: MonthlyReport): MonthlyDistanceSummary {
  const monthlyDistanceMap = createMonthlyDistanceMap(dailyLogs);
  const previousBestMonthlyDistance = Array.from(monthlyDistanceMap.entries())
    .filter(([monthKey]) => monthKey < report.label)
    .reduce((best, [, distance]) => Math.max(best, distance), 0);
  const lifetimeDistanceMeters = dailyLogs
    .filter((log) => log.localDate.slice(0, 7) <= report.label)
    .reduce((total, log) => total + (log.distanceMeters ?? 0), 0);
  const longestDay = dailyLogs
    .filter((log) => log.localDate.startsWith(report.label))
    .reduce<DailyLogSummary | null>((longest, log) => ((log.distanceMeters ?? 0) > (longest?.distanceMeters ?? 0) ? log : longest), null);
  const previousLongestDistance = dailyLogs
    .filter((log) => !log.localDate.startsWith(report.label))
    .reduce((longest, log) => Math.max(longest, log.distanceMeters ?? 0), 0);

  return {
    isMonthlyDistanceRecord: previousBestMonthlyDistance > 0 && report.totalDistanceMeters > previousBestMonthlyDistance,
    lifetimeDistanceMeters,
    longestDay,
    isLongestDayRecord: previousLongestDistance > 0 && (longestDay?.distanceMeters ?? 0) > previousLongestDistance,
  };
}

/** React Nativeの描画反映を1フレーム待つ。 */
function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/** スクロール型の月次レポート画面。 */
export function MonthlyReportScreen({ dailyLogs, points, achievements, monthlyAreaReport, theme, onBackToMap }: MonthlyReportScreenProps) {
  const { height } = useWindowDimensions();
  const scrollY = useRef(new Animated.Value(0)).current;
  const reportCaptureRef = useRef<View | null>(null);
  const [isSharingReport, setIsSharingReport] = useState(false);
  const report = useMemo(() => createMonthlyReport(dailyLogs, points, getPreviousReportMonth()), [dailyLogs, points]);
  const summary = useMemo(() => createMonthlyDistanceSummary(dailyLogs, report), [dailyLogs, report]);
  const reportRouteCoordinates = useMemo(() => toRenderRouteCoordinates(report.routePoints), [report.routePoints]);
  const reportMapRegion = useMemo(() => createInitialRegion(report.routePoints), [report.routePoints]);
  const monthlyAchievements = achievements.filter((item) => item.unlockedAt?.startsWith(report.label)).slice(0, 6);
  const hasReportData = hasMonthlyReportData(report);
  const prefectureRanking = rankingLabels.map((rank, index) => ({
    rank,
    item: monthlyAreaReport?.prefectureRanking[index] ?? null,
  }));
  const surfaceColor = theme.name === 'dark' ? '#2b2b2b' : '#d1d1d1';
  const textColor = theme.name === 'dark' ? '#f7f2ea' : '#333333';
  const mutedTextColor = theme.name === 'dark' ? '#c9c1b6' : '#4d4d4d';
  const backgroundColor = theme.name === 'dark' ? '#111111' : '#ffffff';
  const shareButtonBackgroundColor = theme.name === 'dark' ? '#f7f2ea' : '#333333';
  const shareButtonTextColor = theme.name === 'dark' ? '#111111' : '#ffffff';

  /** レポートのスクロール本文全体をPNG化して共有する。 */
  async function shareReportImage(): Promise<void> {
    if (!reportCaptureRef.current || isSharingReport) {
      return;
    }

    setIsSharingReport(true);

    try {
      await waitForNextFrame();

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('共有できません', 'この環境では共有シートを利用できません。');
        return;
      }

      const uri = await captureRef(reportCaptureRef.current, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      await Sharing.shareAsync(uri, {
        dialogTitle: `すとろりあ 月次レポート ${report.label}`,
        mimeType: 'image/png',
        UTI: 'public.png',
      });
    } catch (error: unknown) {
      Alert.alert('共有失敗', error instanceof Error ? error.message : 'レポート画像を共有できませんでした。');
    } finally {
      setIsSharingReport(false);
    }
  }

  return (
    <View style={[reportStyles.monthlyContainer, { backgroundColor }]}>
      <Animated.ScrollView
        contentContainerStyle={reportStyles.monthlyContent}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View ref={reportCaptureRef} collapsable={false} style={[reportStyles.monthlyCaptureContent, { backgroundColor }]}>
          <View style={reportStyles.monthlyHero}>
            <SafeAreaView style={reportStyles.monthlyTopSafeArea}>
              <View style={reportStyles.monthlyTopSpacer} />
            </SafeAreaView>
            <View style={reportStyles.monthlyTitleRow}>
              <View style={[reportStyles.monthlyIconFrame, { backgroundColor: theme.name === 'dark' ? '#f7f2ea' : '#ffffff' }]}>
                <Image source={require('../../../../assets/icon.png')} style={reportStyles.monthlyIcon} resizeMode="contain" />
              </View>
              <View style={reportStyles.monthlyTitleTextBlock}>
                <Text style={[reportStyles.monthlyAppName, { color: textColor }]}>すとろりあ</Text>
                <Text style={[reportStyles.monthlySubtitle, { color: mutedTextColor }]}>月次レポート{report.label}</Text>
              </View>
            </View>
            <MonthlyReportScrollIndicator color={textColor} />
          </View>

          <Text style={[reportStyles.monthlySectionTitle, { color: textColor }]}>移動距離</Text>
          <MonthlyReportAnimatedCard
            scrollY={scrollY}
            viewportHeight={height}
            forceVisible={isSharingReport}
            style={[reportStyles.monthlyStackCard, { backgroundColor: surfaceColor }]}
          >
            <View style={reportStyles.monthlyMetricRow}>
              <Text style={[reportStyles.monthlyCardLabel, { color: textColor }]}>月間移動距離</Text>
              {hasReportData ? (
                <MonthlyReportMetricValue value={kilometers(report.totalDistanceMeters)} unit="km" color={textColor} />
              ) : (
                <Text style={[reportStyles.monthlyNoDataText, { color: mutedTextColor }]}>データなし</Text>
              )}
            </View>
            <NewRecordPill visible={summary.isMonthlyDistanceRecord} />
          </MonthlyReportAnimatedCard>
          <MonthlyReportAnimatedCard
            scrollY={scrollY}
            viewportHeight={height}
            forceVisible={isSharingReport}
            style={{ backgroundColor: surfaceColor }}
          >
            <View>
              <Text style={[reportStyles.monthlyCardLabel, { color: textColor }]}>総移動距離</Text>
              <Text style={[reportStyles.monthlyCardSubLabel, { color: mutedTextColor }]}>先月末時点</Text>
            </View>
            <MonthlyReportMetricValue value={kilometers(summary.lifetimeDistanceMeters)} unit="km" color={textColor} />
          </MonthlyReportAnimatedCard>
          <MonthlyReportAnimatedCard
            scrollY={scrollY}
            viewportHeight={height}
            forceVisible={isSharingReport}
            style={[reportStyles.monthlyStackCard, { backgroundColor: surfaceColor }]}
          >
            <View style={reportStyles.monthlyMetricRow}>
              <View>
                <Text style={[reportStyles.monthlyCardLabel, { color: textColor }]}>1日の最多移動距離</Text>
                <Text style={[reportStyles.monthlyCardSubLabel, { color: mutedTextColor }]}>
                  {summary.longestDay?.localDate ?? `${report.label}---`}
                </Text>
              </View>
              {summary.longestDay ? (
                <MonthlyReportMetricValue value={kilometers(summary.longestDay.distanceMeters ?? 0)} unit="km" color={textColor} />
              ) : (
                <Text style={[reportStyles.monthlyNoDataText, { color: mutedTextColor }]}>データなし</Text>
              )}
            </View>
            <NewRecordPill visible={summary.isLongestDayRecord} />
          </MonthlyReportAnimatedCard>

          <Text style={[reportStyles.monthlySectionTitle, { color: textColor }]}>移動マップ</Text>
          <MonthlyReportAnimatedCard
            scrollY={scrollY}
            viewportHeight={height}
            forceVisible={isSharingReport}
            style={[reportStyles.monthlyMapCard, { backgroundColor: surfaceColor }]}
          >
            {reportRouteCoordinates.length > 1 ? (
              <MapView
                initialRegion={reportMapRegion}
                mapType={theme.name === 'dark' ? 'mutedStandard' : 'standard'}
                pitchEnabled={false}
                rotateEnabled={false}
                scrollEnabled={false}
                style={reportStyles.monthlyMapView}
                toolbarEnabled={false}
                zoomEnabled={false}
              >
                <Polyline coordinates={reportRouteCoordinates} strokeColor={theme.colors.mapLine} strokeWidth={5} />
              </MapView>
            ) : (
              <View style={reportStyles.monthlyMapNoData}>
                <Text style={[reportStyles.monthlyNoDataText, { color: mutedTextColor }]}>データなし</Text>
              </View>
            )}
          </MonthlyReportAnimatedCard>
          <MonthlyReportAnimatedCard
            scrollY={scrollY}
            viewportHeight={height}
            forceVisible={isSharingReport}
            style={{ backgroundColor: surfaceColor }}
          >
            <Text style={[reportStyles.monthlyCardLabel, { color: textColor }]}>1番よくいた市町村</Text>
            <Text style={[reportStyles.monthlyPlaceText, { color: textColor }]}>
              {monthlyAreaReport?.topMunicipalityName ?? 'データなし'}
            </Text>
          </MonthlyReportAnimatedCard>

          <Text style={[reportStyles.monthlySectionTitle, { color: textColor }]}>月間取得した実績</Text>
          <MonthlyReportAnimatedCard
            scrollY={scrollY}
            viewportHeight={height}
            forceVisible={isSharingReport}
            style={[reportStyles.monthlyAchievementsCard, { backgroundColor: 'transparent' }]}
          >
            {monthlyAchievements.length === 0 ? (
              <Text style={[reportStyles.monthlyEmptyText, { color: mutedTextColor }]}>この月はまだ実績達成なし</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={reportStyles.monthlyAchievementList}>
                {monthlyAchievements.map((item) => (
                  <View key={item.definition.id} style={reportStyles.monthlyAchievementItem}>
                    <Image source={item.definition.trophyImage} style={reportStyles.monthlyAchievementImage} resizeMode="contain" />
                    <Text numberOfLines={1} style={[reportStyles.monthlyAchievementTitle, { color: textColor }]}>
                      {item.definition.title}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </MonthlyReportAnimatedCard>

          <Text style={[reportStyles.monthlySectionTitle, { color: textColor }]}>よくいた都道府県</Text>
          {prefectureRanking.map(({ rank, item }) => (
            <MonthlyReportAnimatedCard
              key={rank}
              scrollY={scrollY}
              viewportHeight={height}
              forceVisible={isSharingReport}
              style={{ backgroundColor: surfaceColor }}
            >
              <Text style={[reportStyles.monthlyRankText, { color: textColor }]}>{rank}</Text>
              <Text style={[reportStyles.monthlyRankingName, { color: textColor }]}>{item?.name ?? '---'}</Text>
              <Text style={[reportStyles.monthlyRankingDays, { color: mutedTextColor }]}>{item ? `${item.count}pt` : ''}</Text>
            </MonthlyReportAnimatedCard>
          ))}

          <Text style={[reportStyles.monthlySectionTitle, { color: textColor }]}>すとろりあ</Text>
          <MonthlyReportAnimatedCard
            scrollY={scrollY}
            viewportHeight={height}
            forceVisible={isSharingReport}
            style={{ backgroundColor: surfaceColor }}
          >
            <Text style={[reportStyles.monthlyCardLabel, { color: textColor }]}>起動日数</Text>
            {hasReportData ? (
              <MonthlyReportMetricValue value={String(report.activeDays)} unit="日 / 30日" color={textColor} />
            ) : (
              <Text style={[reportStyles.monthlyNoDataText, { color: mutedTextColor }]}>データなし</Text>
            )}
          </MonthlyReportAnimatedCard>
          <MonthlyReportAnimatedCard
            scrollY={scrollY}
            viewportHeight={height}
            forceVisible={isSharingReport}
            style={[reportStyles.monthlyStackCard, { backgroundColor: surfaceColor }]}
          >
            <View style={reportStyles.monthlyMetricRow}>
              <Text style={[reportStyles.monthlyCardLabel, { color: textColor }]}>最長連続起動日数</Text>
              <MonthlyReportMetricValue value={String(Math.max(report.activeDays - 3, 0))} unit="日" color={textColor} />
            </View>
          </MonthlyReportAnimatedCard>
          <View style={reportStyles.monthlyReportEndSpacer} />
          {/* 通常フローで内容の末尾に置き、画像内の要素と重ならないようにする（端に余白を付ける）。 */}
          <ShareBranding style={reportStyles.monthlyShareBranding} />
        </View>
        <ShareButton
          accessibilityLabel="レポートを共有"
          disabled={isSharingReport}
          iconColor={shareButtonTextColor}
          iconSize={24}
          label="レポートを共有"
          style={[
            reportStyles.monthlyInlineShareButton,
            { backgroundColor: shareButtonBackgroundColor, opacity: isSharingReport ? 0.64 : 1 },
          ]}
          textStyle={[reportStyles.monthlyInlineShareText, { color: shareButtonTextColor }]}
          variant="wide"
          onPress={shareReportImage}
        />
        <SafeAreaView style={reportStyles.monthlyBottomSafeArea}>
          <View style={reportStyles.monthlyBottomSpacer} />
        </SafeAreaView>
      </Animated.ScrollView>

      <SafeAreaView pointerEvents="box-none" style={reportStyles.monthlyCloseSafeArea}>
        <Pressable
          accessibilityLabel="レポートを閉じる"
          accessibilityRole="button"
          onPress={onBackToMap}
          style={reportStyles.monthlyCloseButton}
        >
          <Feather name="x" size={26} color="#777777" />
        </Pressable>
      </SafeAreaView>
    </View>
  );
}
