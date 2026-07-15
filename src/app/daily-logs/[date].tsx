import { useLocalSearchParams, useRouter } from 'expo-router';

import { DailyLogDetailScreen } from '@/ui/components/DailyLogDetailScreen';
import { useAppState } from '@/ui/state/AppStateProvider';

/**
 * 日別記録詳細ルート(/daily-logs/[date])。
 *
 * URL パラメータの date 文字列から AppStateProvider の dailyLogs を検索し
 * DailyLogDetailScreen を描画する。
 *
 * 設計上の注意:
 * - ナビゲーションパラメータは文字列のみ許容するため、DailyLogSummary オブジェクトは
 *   渡さず date 文字列で検索する。
 * - ログが見つからない場合は何も描画しない(異常系)。
 */
export default function DailyLogDetailRoute(): React.ReactElement | null {
  const { date } = useLocalSearchParams<{ date: string }>();
  const s = useAppState();
  const router = useRouter();

  const log = s.dailyLogs.find((l) => l.localDate === date);

  if (!log) {
    return null;
  }

  return (
    <DailyLogDetailScreen
      log={log}
      styles={s.styles}
      theme={s.theme}
      premiumAccessState={s.premiumAccessState}
      onBackToDailyLogs={() => router.back()}
      onOpenPremiumPaywall={s.openPremiumPaywall}
    />
  );
}
