import { MonthlyReportScreen } from '@/ui/components/reports/MonthlyReportScreen';
import { useAppState } from '@/ui/state/AppStateProvider';

/**
 * 月次レポートルート(/monthly-report)。
 *
 * Plusゲートは AppStateProvider の openMonthlyReport 側で適用済み。
 * ルートとしてアクセスされた場合は常に MonthlyReportScreen を描画する。
 */
export default function MonthlyReportRoute(): React.ReactElement {
  const s = useAppState();

  return (
    <MonthlyReportScreen
      dailyLogs={s.dailyLogs}
      points={s.points}
      achievements={s.achievementItems}
      monthlyAreaReport={s.monthlyAreaReport}
      theme={s.theme}
      onBackToMap={() => s.openMap()}
    />
  );
}
