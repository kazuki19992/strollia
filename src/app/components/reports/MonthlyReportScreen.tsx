import { Feather } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { useMemo, useRef, useState } from 'react';
import { Alert, Animated, Image, Pressable, SafeAreaView, ScrollView, Text, useColorScheme, useWindowDimensions, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { AchievementListItem } from '../../../features/achievements/achievementRepository';
import { createMonthlyReport, getPreviousReportMonth, MonthlyReport } from '../../../features/reports/monthlyReport';
import { DailyLogSummary, LocationPoint } from '../../../types/gps';
import { darkTheme, lightTheme } from '../../../theme/theme';
import { AppStyles } from '../../appStyles';
import { MonthlyReportAnimatedCard } from './MonthlyReportAnimatedCard';
import { MonthlyReportMetricValue } from './MonthlyReportMetricValue';
import { MonthlyReportScrollIndicator } from './MonthlyReportScrollIndicator';
import { NewRecordPill } from './NewRecordPill';
import { reportStyles } from './reportStyles';

/** 月次レポート画面のprops。 */
export type MonthlyReportScreenProps = {
  /** 日別ログ一覧。 */
  dailyLogs: DailyLogSummary[];
  /** GPSポイント一覧。 */
  points: LocationPoint[];
  /** 実績一覧。 */
  achievements: AchievementListItem[];
  /** 共通スタイル。 */
  styles: AppStyles;
  /** 地図画面へ戻る処理。 */
  onBackToMap: () => void;
};

type MonthlyDistanceSummary = {
  isMonthlyDistanceRecord: boolean;
  lifetimeDistanceMeters: number;
  longestDay: DailyLogSummary | null;
  isLongestDayRecord: boolean;
};

const prototypePrefectureRanking = [
  { rank: '1st', name: '千葉県', days: 24 },
  { rank: '2nd', name: '東京都', days: 12 },
  { rank: '3rd', name: '---', days: null },
];

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
  const lifetimeDistanceMeters = dailyLogs.filter((log) => log.localDate.slice(0, 7) <= report.label).reduce((total, log) => total + (log.distanceMeters ?? 0), 0);
  const longestDay = dailyLogs
    .filter((log) => log.localDate.startsWith(report.label))
    .reduce<DailyLogSummary | null>((longest, log) => ((log.distanceMeters ?? 0) > (longest?.distanceMeters ?? 0) ? log : longest), null);
  const previousLongestDistance = dailyLogs
    .filter((log) => !log.localDate.startsWith(report.label))
    .reduce((longest, log) => Math.max(longest, log.distanceMeters ?? 0), 0);

  return {
    isMonthlyDistanceRecord: report.totalDistanceMeters >= previousBestMonthlyDistance && report.totalDistanceMeters >= 0,
    lifetimeDistanceMeters,
    longestDay,
    isLongestDayRecord: (longestDay?.distanceMeters ?? 0) > previousLongestDistance && (longestDay?.distanceMeters ?? 0) > 0,
  };
}

/** スクロール型の月次レポート画面。 */
export function MonthlyReportScreen({ dailyLogs, points, achievements, onBackToMap }: MonthlyReportScreenProps) {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;
  const { height } = useWindowDimensions();
  const scrollY = useRef(new Animated.Value(0)).current;
  const reportScrollRef = useRef<ScrollView | null>(null);
  const [isSharingReport, setIsSharingReport] = useState(false);
  const report = useMemo(() => createMonthlyReport(dailyLogs, points, getPreviousReportMonth()), [dailyLogs, points]);
  const summary = useMemo(() => createMonthlyDistanceSummary(dailyLogs, report), [dailyLogs, report]);
  const monthlyAchievements = achievements.filter((item) => item.unlockedAt?.startsWith(report.label)).slice(0, 6);
  const activeDayRecord = report.activeDays >= 25;
  const surfaceColor = theme.name === 'dark' ? '#2b2b2b' : '#d1d1d1';
  const textColor = theme.name === 'dark' ? '#f7f2ea' : '#333333';
  const mutedTextColor = theme.name === 'dark' ? '#c9c1b6' : '#4d4d4d';
  const backgroundColor = theme.name === 'dark' ? '#111111' : '#ffffff';

  /** レポートのスクロール本文全体をPNG化して共有する。 */
  async function shareReportImage(): Promise<void> {
    if (!reportScrollRef.current || isSharingReport) {
      return;
    }

    setIsSharingReport(true);

    try {
      const uri = await captureRef(reportScrollRef.current, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        snapshotContentContainer: true,
      });

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('共有できません', 'この環境では共有シートを利用できません。');
        return;
      }

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
        ref={reportScrollRef}
        contentContainerStyle={reportStyles.monthlyContent}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View style={reportStyles.monthlyHero}>
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
        <MonthlyReportAnimatedCard scrollY={scrollY} viewportHeight={height} style={[reportStyles.monthlyStackCard, { backgroundColor: surfaceColor }]}>
          <View style={reportStyles.monthlyMetricRow}>
            <Text style={[reportStyles.monthlyCardLabel, { color: textColor }]}>月間移動距離</Text>
            <MonthlyReportMetricValue value={kilometers(report.totalDistanceMeters)} unit="km" color={textColor} />
          </View>
          <NewRecordPill visible={summary.isMonthlyDistanceRecord} />
        </MonthlyReportAnimatedCard>
        <MonthlyReportAnimatedCard scrollY={scrollY} viewportHeight={height} style={{ backgroundColor: surfaceColor }}>
          <View>
            <Text style={[reportStyles.monthlyCardLabel, { color: textColor }]}>総移動距離</Text>
            <Text style={[reportStyles.monthlyCardSubLabel, { color: mutedTextColor }]}>先月末時点</Text>
          </View>
          <MonthlyReportMetricValue value={kilometers(summary.lifetimeDistanceMeters)} unit="km" color={textColor} />
        </MonthlyReportAnimatedCard>
        <MonthlyReportAnimatedCard scrollY={scrollY} viewportHeight={height} style={[reportStyles.monthlyStackCard, { backgroundColor: surfaceColor }]}>
          <View style={reportStyles.monthlyMetricRow}>
            <View>
              <Text style={[reportStyles.monthlyCardLabel, { color: textColor }]}>1日の最多移動距離</Text>
              <Text style={[reportStyles.monthlyCardSubLabel, { color: mutedTextColor }]}>{summary.longestDay?.localDate ?? `${report.label}---`}</Text>
            </View>
            <MonthlyReportMetricValue value={kilometers(summary.longestDay?.distanceMeters ?? 0)} unit="km" color={textColor} />
          </View>
          <NewRecordPill visible={summary.isLongestDayRecord} />
        </MonthlyReportAnimatedCard>

        <Text style={[reportStyles.monthlySectionTitle, { color: textColor }]}>移動マップ</Text>
        <MonthlyReportAnimatedCard scrollY={scrollY} viewportHeight={height} style={[reportStyles.monthlyMapCard, { backgroundColor: surfaceColor }]}>
          <View style={reportStyles.monthlyMapPreview}>
            {Array.from({ length: 8 }).map((_, index) => (
              <View key={index} style={[reportStyles.monthlyMapGridLine, { top: 26 + index * 32 }]} />
            ))}
            <View style={reportStyles.monthlyMapRouteHalo} />
            <View style={reportStyles.monthlyMapRoute} />
          </View>
        </MonthlyReportAnimatedCard>
        <MonthlyReportAnimatedCard scrollY={scrollY} viewportHeight={height} style={{ backgroundColor: surfaceColor }}>
          <Text style={[reportStyles.monthlyCardLabel, { color: textColor }]}>1番よくいた市町村</Text>
          <Text style={[reportStyles.monthlyPlaceText, { color: textColor }]}>集計準備中</Text>
        </MonthlyReportAnimatedCard>

        <Text style={[reportStyles.monthlySectionTitle, { color: textColor }]}>月間取得した実績</Text>
        <MonthlyReportAnimatedCard scrollY={scrollY} viewportHeight={height} style={[reportStyles.monthlyAchievementsCard, { backgroundColor: 'transparent' }]}>
          {monthlyAchievements.length === 0 ? (
            <Text style={[reportStyles.monthlyEmptyText, { color: mutedTextColor }]}>この月はまだ実績達成なし</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={reportStyles.monthlyAchievementList}>
              {monthlyAchievements.map((item) => (
                <View key={item.definition.id} style={reportStyles.monthlyAchievementItem}>
                  <Image source={item.definition.trophyImage} style={reportStyles.monthlyAchievementImage} resizeMode="contain" />
                  <Text numberOfLines={1} style={[reportStyles.monthlyAchievementTitle, { color: textColor }]}>{item.definition.title}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </MonthlyReportAnimatedCard>

        <Text style={[reportStyles.monthlySectionTitle, { color: textColor }]}>よくいた都道府県</Text>
        {prototypePrefectureRanking.map((item) => (
          <MonthlyReportAnimatedCard key={item.rank} scrollY={scrollY} viewportHeight={height} style={{ backgroundColor: surfaceColor }}>
            <Text style={[reportStyles.monthlyRankText, { color: textColor }]}>{item.rank}</Text>
            <Text style={[reportStyles.monthlyRankingName, { color: textColor }]}>{item.name}</Text>
            <Text style={[reportStyles.monthlyRankingDays, { color: mutedTextColor }]}>{item.days == null ? '' : `(${item.days}日)`}</Text>
          </MonthlyReportAnimatedCard>
        ))}

        <Text style={[reportStyles.monthlySectionTitle, { color: textColor }]}>すとろりあ</Text>
        <MonthlyReportAnimatedCard scrollY={scrollY} viewportHeight={height} style={{ backgroundColor: surfaceColor }}>
          <Text style={[reportStyles.monthlyCardLabel, { color: textColor }]}>起動日数</Text>
          <MonthlyReportMetricValue value={String(report.activeDays)} unit="日 / 30日" color={textColor} />
        </MonthlyReportAnimatedCard>
        <MonthlyReportAnimatedCard scrollY={scrollY} viewportHeight={height} style={[reportStyles.monthlyStackCard, { backgroundColor: surfaceColor }]}>
          <View style={reportStyles.monthlyMetricRow}>
            <Text style={[reportStyles.monthlyCardLabel, { color: textColor }]}>最長連続起動日数</Text>
            <MonthlyReportMetricValue value={String(Math.max(report.activeDays - 3, 0))} unit="日" color={textColor} />
          </View>
          <NewRecordPill visible={activeDayRecord} />
        </MonthlyReportAnimatedCard>
      </Animated.ScrollView>

      <SafeAreaView pointerEvents="box-none" style={reportStyles.monthlyCloseSafeArea}>
        <Pressable accessibilityLabel="レポートを閉じる" accessibilityRole="button" onPress={onBackToMap} style={reportStyles.monthlyCloseButton}>
          <Feather name="x" size={26} color="#777777" />
        </Pressable>
      </SafeAreaView>
      <SafeAreaView pointerEvents="box-none" style={reportStyles.monthlyShareSafeArea}>
        <Pressable accessibilityLabel="レポートを共有" accessibilityRole="button" disabled={isSharingReport} onPress={shareReportImage} style={reportStyles.monthlyFloatingShareButton}>
          <Feather name="share-2" size={28} color="#777777" />
        </Pressable>
      </SafeAreaView>
    </View>
  );
}
