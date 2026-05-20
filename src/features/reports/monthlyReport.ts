import { DailyLogSummary, LocationPoint } from '../../types/gps';
import { totalDistanceMeters } from '../../utils/distance';

/** 月次レポートで扱う年月。 */
export type ReportMonth = {
  /** 年。 */
  year: number;
  /** 1始まりの月。 */
  month: number;
};

/** 月次レポートに表示する集計データ。 */
export type MonthlyReport = {
  /** 対象年月。 */
  month: ReportMonth;
  /** `YYYY-MM` 形式の表示用キー。 */
  label: string;
  /** 対象月の総移動距離。単位はメートル。 */
  totalDistanceMeters: number;
  /** 対象月のGPSポイント。 */
  routePoints: LocationPoint[];
  /** 記録がある日数。 */
  activeDays: number;
};

/** Dateから月次レポート対象年月を作る。 */
export function getReportMonth(date = new Date()): ReportMonth {
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

/** Dateから直前月の月次レポート対象年月を作る。 */
export function getPreviousReportMonth(date = new Date()): ReportMonth {
  return getReportMonth(new Date(date.getFullYear(), date.getMonth() - 1, 1));
}

/** 月次レポート対象年月を`YYYY-MM`形式にする。 */
export function formatReportMonth(month: ReportMonth): string {
  return `${month.year}-${String(month.month).padStart(2, '0')}`;
}

/** 指定された月に含まれるかを判定する。 */
export function isInReportMonth(localDate: string, month: ReportMonth): boolean {
  return localDate.startsWith(formatReportMonth(month));
}

/** 月次レポートを生成する。 */
export function createMonthlyReport(dailyLogs: DailyLogSummary[], points: LocationPoint[], month = getReportMonth()): MonthlyReport {
  const monthlyLogs = dailyLogs.filter((log) => isInReportMonth(log.localDate, month));
  const monthlyPoints = points.filter((point) => isInReportMonth(point.localDate, month));
  // monthlyLogsに距離欠落が1件でもある場合は、canUseStoredDistanceをfalseにしてmonthlyPointsからtotalDistanceMetersで再計算する。
  const canUseStoredDistance = monthlyLogs.length > 0 && monthlyLogs.every((log) => log.distanceMeters != null);
  const totalDistance = canUseStoredDistance
    ? monthlyLogs.reduce((total, log) => total + (log.distanceMeters ?? 0), 0)
    : totalDistanceMeters(monthlyPoints);

  return {
    month,
    label: formatReportMonth(month),
    totalDistanceMeters: totalDistance,
    routePoints: monthlyPoints,
    activeDays: monthlyLogs.filter((log) => log.pointCount > 0).length,
  };
}
