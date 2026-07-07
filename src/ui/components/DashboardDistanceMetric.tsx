import { Text, View } from 'react-native';

import type { AppStyles } from '@/ui/appStyles';
import { DASHBOARD_BASE_TEXT, FIXED_MAP_UI_TEXT_PROPS, getScaledTextStyle, scaleNumber } from './dashboardScaling';

export type DashboardDistanceMetricProps = {
  /** ラベル文字列。ODOまたはTODAY。 */
  label: string;
  /** 整数部と小数部に分割した距離文字列。 */
  parts: string[];
  /** ダッシュボードの縮小倍率。 */
  scale: number;
  /** 画面共通スタイル。 */
  styles: AppStyles;
};

/** 下部ダッシュボードの距離数値を描画する。 */
export function DashboardDistanceMetric({ label, parts, scale, styles }: DashboardDistanceMetricProps) {
  return (
    <View style={[styles.dashboardDistanceMetric, label === 'ODO' ? styles.dashboardOdometerMetric : styles.dashboardTodayMetric]}>
      <Text {...FIXED_MAP_UI_TEXT_PROPS} style={[styles.dashboardMetricLabel, getScaledTextStyle(DASHBOARD_BASE_TEXT.metricLabel, scale)]}>
        {label}
      </Text>
      <View style={styles.speedometerDistanceValueRow}>
        <Text
          {...FIXED_MAP_UI_TEXT_PROPS}
          numberOfLines={1}
          style={[styles.dashboardDistanceValueInteger, getScaledTextStyle(DASHBOARD_BASE_TEXT.distanceInteger, scale)]}
        >
          {parts[0]}
        </Text>
        <Text
          {...FIXED_MAP_UI_TEXT_PROPS}
          style={[styles.dashboardDistanceValueDot, getScaledTextStyle(DASHBOARD_BASE_TEXT.distanceInteger, scale)]}
        >
          .
        </Text>
        <Text
          {...FIXED_MAP_UI_TEXT_PROPS}
          style={[styles.dashboardDistanceValueDecimal, getScaledTextStyle(DASHBOARD_BASE_TEXT.distanceDecimal, scale)]}
        >
          {parts[1]}
        </Text>
        <Text
          {...FIXED_MAP_UI_TEXT_PROPS}
          style={[
            styles.dashboardDistanceUnit,
            getScaledTextStyle(DASHBOARD_BASE_TEXT.distanceUnit, scale),
            { marginBottom: scaleNumber(3, scale), marginLeft: scaleNumber(1, scale) },
          ]}
        >
          km
        </Text>
      </View>
    </View>
  );
}
