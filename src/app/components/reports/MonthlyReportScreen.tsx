import { useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, View } from 'react-native';

import { AchievementListItem } from '../../../features/achievements/achievementRepository';
import { createMonthlyReport, getReportMonth } from '../../../features/reports/monthlyReport';
import { DailyLogSummary, LocationPoint } from '../../../types/gps';
import { AppStyles } from '../../appStyles';
import { AchievementHighlightReportPage } from './AchievementHighlightReportPage';
import { MonthlyDistanceReportPage } from './MonthlyDistanceReportPage';
import { MonthlyMapReportPage } from './MonthlyMapReportPage';
import { PrefectureRankingReportPage } from './PrefectureRankingReportPage';
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

/** 月次レポートのページID。 */
type ReportPageId = 'distance' | 'map' | 'prefectureRanking' | 'achievements';

const reportPages: ReportPageId[] = ['distance', 'map', 'prefectureRanking', 'achievements'];

/** ストーリー形式の月次レポート画面。 */
export function MonthlyReportScreen({ dailyLogs, points, achievements, styles, onBackToMap }: MonthlyReportScreenProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const report = useMemo(() => createMonthlyReport(dailyLogs, points, getReportMonth()), [dailyLogs, points]);
  const currentPage = reportPages[pageIndex];

  /** 共有プロトタイプの案内を表示する。 */
  function shareReportPrototype(): void {
    Alert.alert('共有は準備中です', 'まずはアプリ内で見られる月次レポートのプロトタイプを作成しています。');
  }

  /** 次のページへ進む。最終ページの次操作では地図へ戻る。 */
  function goNext(): void {
    if (pageIndex >= reportPages.length - 1) {
      onBackToMap();
      return;
    }

    setPageIndex(pageIndex + 1);
  }

  /** 前のページへ戻る。 */
  function goPrevious(): void {
    setPageIndex((index) => Math.max(index - 1, 0));
  }

  return (
    <SafeAreaView style={reportStyles.storyContainer}>
      <View style={reportStyles.storyContainer}>
        {currentPage === 'distance' && <MonthlyDistanceReportPage report={report} pageCount={reportPages.length} pageIndex={pageIndex} onShare={shareReportPrototype} />}
        {currentPage === 'map' && <MonthlyMapReportPage report={report} pageCount={reportPages.length} pageIndex={pageIndex} onShare={shareReportPrototype} />}
        {currentPage === 'prefectureRanking' && <PrefectureRankingReportPage report={report} pageCount={reportPages.length} pageIndex={pageIndex} onShare={shareReportPrototype} />}
        {currentPage === 'achievements' && (
          <AchievementHighlightReportPage report={report} achievements={achievements} pageCount={reportPages.length} pageIndex={pageIndex} onShare={shareReportPrototype} />
        )}
        <View style={styles.reportNavigationOverlay} pointerEvents="box-none">
          <Pressable accessibilityLabel="前のレポートページ" onPress={goPrevious} style={styles.reportPreviousZone} />
          <Pressable accessibilityLabel="次のレポートページ" onPress={goNext} style={styles.reportNextZone} />
        </View>
      </View>
    </SafeAreaView>
  );
}
