import { useRouter } from 'expo-router';

import { DailyLogsScreen } from '@/ui/components/DailyLogsScreen';
import { useAppState } from '@/ui/state/AppStateProvider';

/**
 * 日別記録一覧ルート(/daily-logs)。
 *
 * AppStateProvider から dailyLogs と操作を取得し DailyLogsScreen を描画する。
 * 戻る操作は openMap() で地図ルートへ戻る。openMap() は navigator 経由で router.back() を呼ぶ。
 */
export default function DailyLogsRoute(): React.ReactElement {
  const s = useAppState();
  const router = useRouter();

  return (
    <DailyLogsScreen
      dailyLogs={s.dailyLogs}
      styles={s.styles}
      theme={s.theme}
      onBackToMap={() => s.openMap()}
      onOpenDailyLogDetail={(log) => router.push({ pathname: '/daily-logs/[date]', params: { date: log.localDate } })}
    />
  );
}
