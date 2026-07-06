import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import { useEffect, useState } from 'react';

import { groupDailyLogsByMonth } from '@/app/dailyLogDisplay';
import { fetchAreaNamesByPointIds } from '@/features/logs/dailyLogsService';
import { AppTheme } from '@/theme/theme';
import { DailyLogSummary } from '@/types/gps';
import { AppStyles } from '@/app/appStyles';
import { DailyLogListItem } from './DailyLogListItem';
import { AppScreenHeader } from './AppScreenHeader';
import { SectionTitle } from './SectionTitle';

/** 日別ログ一覧画面のprops。 */
export type DailyLogsScreenProps = {
  /** 日別ログのサマリー一覧。 */
  dailyLogs: DailyLogSummary[];
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 地図画面へ戻る処理。 */
  onBackToMap: () => void;
  /** 対象日の詳細画面を開く処理。 */
  onOpenDailyLogDetail: (log: DailyLogSummary) => void;
};

/** 日別ログ一覧画面を描画する。 */
export function DailyLogsScreen({ dailyLogs, styles, theme, onBackToMap, onOpenDailyLogDetail }: DailyLogsScreenProps) {
  const monthGroups = groupDailyLogsByMonth(dailyLogs);
  const [areaNameByPointId, setAreaNameByPointId] = useState(new Map<number, string>());

  useEffect(() => {
    const locationPointIds = dailyLogs
      .flatMap((log) => [log.startLocationPointId, log.endLocationPointId])
      .filter((id): id is number => id !== null);
    let isCancelled = false;

    fetchAreaNamesByPointIds(locationPointIds)
      .then((nextAreaNameByPointId) => {
        if (!isCancelled) {
          setAreaNameByPointId(nextAreaNameByPointId);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setAreaNameByPointId(new Map());
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [dailyLogs]);

  return (
    <SafeAreaView style={styles.appScreen}>
      <AppScreenHeader backLabel="地図" styles={styles} theme={theme} title="日ごとの記録" onBack={onBackToMap} />

      {dailyLogs.length === 0 ? (
        <View style={styles.dailyEmptyCard}>
          <Text style={styles.emptyTitle}>日別ログはまだありません</Text>
          <Text style={styles.emptyText}>GPSログが保存されると、この画面に日ごとの記録が並びます。</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.dailyLogList}>
          {monthGroups.map((group) => (
            <View key={group.monthKey} style={styles.dailyLogMonthSection}>
              <SectionTitle styles={styles}>{group.label}</SectionTitle>
              <View style={styles.dailyLogListGroup}>
                {group.logs.map((log) => (
                  <DailyLogListItem
                    key={log.localDate}
                    log={log}
                    styles={styles}
                    theme={theme}
                    startAreaName={log.startLocationPointId ? areaNameByPointId.get(log.startLocationPointId) : undefined}
                    endAreaName={log.endLocationPointId ? areaNameByPointId.get(log.endLocationPointId) : undefined}
                    onPress={onOpenDailyLogDetail}
                  />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
