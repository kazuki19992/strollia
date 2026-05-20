import { View } from 'react-native';

import { MonthlyReport } from '../../../features/reports/monthlyReport';
import { reportStyles } from './reportStyles';
import { ReportFrame } from './ReportFrame';

/** 月間移動マップページのprops。 */
export type MonthlyMapReportPageProps = {
  report: MonthlyReport;
  pageCount: number;
  pageIndex: number;
  onShare: () => void;
};

/** 月間移動マップのプロトタイプページ。 */
export function MonthlyMapReportPage({ report, pageCount, pageIndex, onShare }: MonthlyMapReportPageProps) {
  return (
    <ReportFrame title="今月の移動マップ" label={report.label} pageCount={pageCount} pageIndex={pageIndex} onShare={onShare}>
      <View testID="monthly-map-background" style={reportStyles.mapBackground}>
        {Array.from({ length: 12 }).map((_, index) => (
          <View key={index} testID="monthly-map-grid-line" style={[reportStyles.mapGridLine, { top: 80 + index * 70 }]} />
        ))}
        <View testID="monthly-map-route-halo" style={reportStyles.mapRouteHalo} />
        <View testID="monthly-map-route" style={reportStyles.mapRoute} />
        <View testID="monthly-map-overlay" style={reportStyles.mapOverlay} />
      </View>
    </ReportFrame>
  );
}
