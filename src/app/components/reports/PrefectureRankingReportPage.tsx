import { Text, View } from 'react-native';

import { MonthlyReport } from '../../../features/reports/monthlyReport';
import { reportStyles } from './reportStyles';
import { ReportFrame } from './ReportFrame';

const prototypeRanking = [
  { rank: '1st', name: '福島県', count: 50 },
  { rank: '2nd', name: '茨城県', count: 24 },
  { rank: '3rd', name: '千葉県', count: 10 },
];

/** よく行った都道府県ランキングページのprops。 */
export type PrefectureRankingReportPageProps = {
  report: MonthlyReport;
  pageCount: number;
  pageIndex: number;
  onShare: () => void;
  /** 表示する都道府県ランキング。未指定時のみプロトタイプ値を表示する。 */
  ranking?: { rank: string; name: string; count: number }[];
};

/** よく行った都道府県ランキングのプロトタイプページ。 */
export function PrefectureRankingReportPage({ report, pageCount, pageIndex, onShare, ranking }: PrefectureRankingReportPageProps) {
  const displayRanking = ranking && ranking.length > 0 ? ranking : prototypeRanking;

  return (
    <ReportFrame title="よく行った都道府県" label={report.label} pageCount={pageCount} pageIndex={pageIndex} onShare={onShare}>
      <View style={reportStyles.pageBody}>
        <View style={reportStyles.rankingList}>
          {displayRanking.map((item) => (
            <View key={item.rank} style={reportStyles.rankingRow}>
              <Text style={reportStyles.rankingRank}>{item.rank}</Text>
              <Text style={reportStyles.rankingName}>{item.name}</Text>
              <Text style={reportStyles.rankingVisits}>{item.count}pt</Text>
            </View>
          ))}
        </View>
      </View>
    </ReportFrame>
  );
}
