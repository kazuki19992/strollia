import { Text, View } from 'react-native';

import { AchievementListItem } from '@/features/achievements/achievementRepository';
import { MonthlyReport } from '@/features/reports/monthlyReport';
import { reportStyles } from './reportStyles';
import { ReportFrame } from './ReportFrame';

/** 実績ハイライトページのprops。 */
export type AchievementHighlightReportPageProps = {
  report: MonthlyReport;
  achievements: AchievementListItem[];
  pageCount: number;
  pageIndex: number;
  onShare: () => void;
};

/** 今月達成した実績を表示するレポートページ。 */
export function AchievementHighlightReportPage({
  report,
  achievements,
  pageCount,
  pageIndex,
  onShare,
}: AchievementHighlightReportPageProps) {
  const monthlyAchievements = achievements.filter((item) => item.unlockedAt?.startsWith(report.label)).slice(0, 3);

  return (
    <ReportFrame title="今月達成した実績" label={report.label} pageCount={pageCount} pageIndex={pageIndex} onShare={onShare}>
      <View style={reportStyles.pageBody}>
        {monthlyAchievements.length === 0 ? (
          <View style={reportStyles.centerContent}>
            <Text style={reportStyles.achievementEmptyText}>今月はまだ実績達成なし</Text>
          </View>
        ) : (
          <View style={reportStyles.rankingList}>
            {monthlyAchievements.map((item) => (
              <View key={item.definition.id} style={reportStyles.achievementRow}>
                <Text style={reportStyles.achievementTrophy}>🏆</Text>
                <Text style={reportStyles.achievementText}>{item.definition.title}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ReportFrame>
  );
}
