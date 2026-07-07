import { Redirect } from 'expo-router';

import { MonthlyReportScreen } from '@/ui/components/reports/MonthlyReportScreen';
import { useAppState } from '@/ui/state/AppStateProvider';

/**
 * 月次レポートルート(/monthly-report)。
 *
 * アプリ内ボタン経由の遷移は AppStateProvider の openMonthlyReport が
 * Plusゲート(ペイウォール表示)を適用するが、scheme 追加により
 * ディープリンク等でこの route へ直接到達できるため、route 側でも
 * Plus 判定を行い未加入時は地図へリダイレクトしてゲートの bypass を防ぐ。
 */
export default function MonthlyReportRoute(): React.ReactElement {
  const s = useAppState();

  if (!s.premiumAccessState.isPlusActive) {
    return <Redirect href="/" />;
  }

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
