import { SafeAreaView, ScrollView, Text, View } from 'react-native';

import { AppTheme } from '../../theme/theme';
import { DailyLogSummary } from '../../types/gps';
import { AppStyles } from '../appStyles';
import { DailyLogCard } from './DailyLogCard';
import { AppScreenHeader } from './AppScreenHeader';

/** 日別ログ一覧画面のprops。 */
export type DailyLogsScreenProps = {
  /** 日別ログのサマリー一覧。 */
  dailyLogs: DailyLogSummary[];
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** Plusが有効かどうか。 */
  isPlusActive: boolean;
  /** Plus未加入時にPaywallを表示する処理。 */
  onPresentPremiumPaywall: () => void;
  /** 地図画面へ戻る処理。 */
  onBackToMap: () => void;
};

/** 日別ログ一覧画面を描画する。 */
export function DailyLogsScreen({ dailyLogs, styles, theme, isPlusActive, onPresentPremiumPaywall, onBackToMap }: DailyLogsScreenProps) {
  return (
    <SafeAreaView style={styles.appScreen}>
      <AppScreenHeader backLabel="地図" styles={styles} theme={theme} title="日ごとの記録" onBack={onBackToMap} />

      {dailyLogs.length === 0 ? (
        <View style={styles.dailyEmptyCard}>
          <Text style={styles.emptyTitle}>日別ログはまだありません</Text>
          <Text style={styles.emptyText}>GPSログが保存されると、この画面に日ごとの記録が並びます。</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.dailyList}>
          {dailyLogs.map((log) => (
            <DailyLogCard
              key={log.localDate}
              log={log}
              styles={styles}
              theme={theme}
              isPlusActive={isPlusActive}
              onPresentPremiumPaywall={onPresentPremiumPaywall}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
