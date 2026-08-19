import { useLocalSearchParams, useRouter } from 'expo-router';

import { DailyLogDetailScreen } from '@/ui/components/DailyLogDetailScreen';
import { useAppState } from '@/ui/state/AppStateProvider';

/**
 * Renders the daily log detail screen for the date specified in the route.
 *
 * @returns The matching daily log detail screen, or `null` when no log exists for the requested date.
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
      activeStayPlaces={s.activeStayPlaces}
      stayPlacesStatus={s.stayPlacesStatus}
      onBackToDailyLogs={() => router.back()}
      onOpenPremiumPaywall={s.openPremiumPaywall}
    />
  );
}
