import { useRouter } from 'expo-router';

import { StayPlacesScreen } from '@/ui/components/StayPlacesScreen';
import { useAppState } from '@/ui/state/AppStateProvider';

/**
 * Renders the stay places settings route.
 *
 * @returns The stay places settings screen.
 */
export default function StayPlacesRoute(): React.ReactElement {
  const s = useAppState();
  const router = useRouter();

  return (
    <StayPlacesScreen
      isPlusActive={s.premiumAccessState.isPlusActive}
      stayPlaces={s.stayPlaces}
      styles={s.styles}
      theme={s.theme}
      onBackToSettings={() => router.back()}
      onOpenEditor={(id) => router.push(`/settings/stay-places/${id}`)}
      onOpenNew={() => router.push('/settings/stay-places/new')}
      onOpenPremiumPaywall={s.openPremiumPaywall}
    />
  );
}
