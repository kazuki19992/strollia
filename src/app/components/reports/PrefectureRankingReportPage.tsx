import { Text, View } from 'react-native';

import { MonthlyReport } from '../../../features/reports/monthlyReport';
import { reportStyles } from './reportStyles';
import { ReportFrame } from './ReportFrame';

const prototypeRanking = [
  { rank: '1st', name: '福島県', visits: 50 },
  { rank: '2nd', name: '茨城県', visits: 24 },
  { rank: '3rd', name: '千葉県', visits: 10 },
];

/** よく行った都道府県ランキングページのprops。 */
export type PrefectureRankingReportPageProps = {
  report: MonthlyReport;
  pageCount: number;
  pageIndex: number;
  onShare: () => void;
};

/** よく行った都道府県ランキングのプロトタイプページ。 */
export function PrefectureRankingReportPage({ report, pageCount, pageIndex, onShare }: PrefectureRankingReportPageProps) {
  return (
    <ReportFrame title="よく行った都道府県" label={report.label} pageCount={pageCount} pageIndex={pageIndex} onShare={onShare}>
      <View style={reportStyles.pageBody}>
        <View style={reportStyles.rankingList}>
          {prototypeRanking.map((item) => (
            <View key={item.rank} style={reportStyles.rankingRow}>
              <Text style={reportStyles.rankingRank}>{item.rank}</Text>
              <Text style={reportStyles.rankingName}>{item.name}</Text>
              <Text style={reportStyles.rankingVisits}>{item.visits}回</Text>
            </View>
          ))}
        </View>
      </View>
    </ReportFrame>
  );
}
