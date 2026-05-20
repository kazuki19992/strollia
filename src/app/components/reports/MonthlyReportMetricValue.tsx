import { Text, View } from 'react-native';

import { reportStyles } from './reportStyles';

/** 月次レポートの数値表示props。 */
export type MonthlyReportMetricValueProps = {
  /** 整数部と小数部を含む表示値。 */
  value: string;
  /** 単位。 */
  unit: string;
  /** 文字色。 */
  color: string;
};

/** DSEGの整数部、小さめの小数部、通常フォントの単位を下揃えで表示する。 */
export function MonthlyReportMetricValue({ value, unit, color }: MonthlyReportMetricValueProps) {
  const [integerPart, decimalPart] = value.split('.');

  return (
    <View style={reportStyles.monthlyMetricValueRow}>
      <Text style={[reportStyles.monthlyCardNumberInteger, { color }]}>{integerPart}</Text>
      {decimalPart != null && <Text style={[reportStyles.monthlyCardNumberDecimal, { color }]}>{`.${decimalPart}`}</Text>}
      <Text style={[reportStyles.monthlyCardUnit, { color }]}>{unit}</Text>
    </View>
  );
}
