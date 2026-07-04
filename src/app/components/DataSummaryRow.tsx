import { Text, View } from 'react-native';

import type { AppStyles } from '@/app/appStyles';

export type DataSummaryRowProps = {
  /** 左側の項目名。 */
  label: string;
  /** 右側の値。 */
  value: string;
  /** 画面共通スタイル。 */
  styles: AppStyles;
};

/** ラベルと値を罫線付きで並べる汎用データ行。 */
export function DataSummaryRow({ label, value, styles }: DataSummaryRowProps) {
  return (
    <View style={styles.dataSummaryRow}>
      <Text style={styles.dataSummaryLabel}>{label}</Text>
      <Text style={styles.dataSummaryValue}>{value}</Text>
    </View>
  );
}
