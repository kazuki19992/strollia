import { formatDailyLogListDateLabel, formatDistanceKm, formatRouteSummary, resolveDailyLogDistance } from '../dailyLogDisplay';
import type { DailyLogSummary } from '../../types/gps';
import type { AppStyles } from '../appStyles';
import type { AppTheme } from '../../theme/theme';
import { AppListItem } from './AppListItem';

export type DailyLogListItemProps = {
  /** 表示対象の日別サマリー。 */
  log: DailyLogSummary;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 行を開く処理。 */
  onPress: (log: DailyLogSummary) => void;
  /** 開始地点名。 */
  startAreaName?: string;
  /** 終了地点名。 */
  endAreaName?: string;
};

/** 日ごとの記録一覧で使う、軽量なリスト行。 */
export function DailyLogListItem({ log, styles, theme, startAreaName, endAreaName, onPress }: DailyLogListItemProps) {
  const title = formatDailyLogListDateLabel(log.localDate);

  return (
    <AppListItem
      accessibilityLabel={`${title}の記録を開く`}
      detail={formatDistanceKm(resolveDailyLogDistance(log))}
      styles={styles}
      subtitle={formatRouteSummary(startAreaName, endAreaName)}
      theme={theme}
      title={title}
      prominent
      onPress={() => onPress(log)}
    />
  );
}
