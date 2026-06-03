import { Feather } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { formatDailyLogListDateLabel, formatDistanceKm, formatRouteSummary, resolveDailyLogDistance } from '../dailyLogDisplay';
import type { DailyLogSummary } from '../../types/gps';
import type { AppStyles } from '../appStyles';
import type { AppTheme } from '../../theme/theme';

export type DailyLogListItemProps = {
  /** 表示対象の日別サマリー。 */
  log: DailyLogSummary;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 行を開く処理。 */
  onPress: (log: DailyLogSummary) => void;
};

/** 日ごとの記録一覧で使う、軽量なリスト行。 */
export function DailyLogListItem({ log, styles, theme, onPress }: DailyLogListItemProps) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${formatDailyLogListDateLabel(log.localDate)}の記録を開く`} onPress={() => onPress(log)}>
      <View style={styles.dailyLogListItem}>
        <View style={styles.dailyLogListTextColumn}>
          <Text style={styles.dailyLogListDate}>{formatDailyLogListDateLabel(log.localDate)}</Text>
          <Text style={styles.dailyLogListMeta}>{formatRouteSummary()}</Text>
          <Text style={styles.dailyLogListDistance}>{formatDistanceKm(resolveDailyLogDistance(log))}</Text>
        </View>
        <Feather name="chevron-right" size={36} color={theme.colors.mutedText} />
      </View>
    </Pressable>
  );
}
