import { Redirect } from 'expo-router';

import { MonthlyReportScreen } from '@/ui/components/reports/MonthlyReportScreen';
import { useAppState } from '@/ui/state/AppStateProvider';

/**
 * Renders the monthly report for users with active Plus access.
 *
 * Redirects users without Plus access to the map.
 */
export default function MonthlyReportRoute(): React.ReactElement {
  const s = useAppState();

  if (!s.premiumAccessState.isPlusActive) {
    return <Redirect href="/" />;
  }

  return (
    <MonthlyReportScreen
      dailyLogs={s.dailyLogs}
      points={s.monthlyReportPoints}
      activeStayPlaces={s.activeStayPlaces}
      stayPlacesStatus={s.stayPlacesStatus}
      achievements={s.achievementItems}
      monthlyAreaReport={s.monthlyAreaReport}
      theme={s.theme}
      onBackToMap={() => s.openMap()}
    />
  );
}
