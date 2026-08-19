import { useRouter } from 'expo-router';

import { StayPlaceEditorScreen } from '@/ui/components/StayPlaceEditorScreen';
import { useAppState } from '@/ui/state/AppStateProvider';

/**
 * Renders the route for creating a new stay place.
 */
export default function NewStayPlaceRoute(): React.ReactElement {
  const s = useAppState();
  const router = useRouter();

  return (
    <StayPlaceEditorScreen
      initialCoordinate={s.userCoordinate}
      place={null}
      styles={s.styles}
      theme={s.theme}
      onBack={() => router.back()}
      onSave={async (input) => {
        // Deep linkなどで読込中に到達しても、無料版の作成制限を回避させない。
        // Provider側にも同じガードを置き、ここではペイウォールを開いたままにする。
        if (!s.premiumAccessState.isPlusActive && (s.stayPlacesStatus !== 'ready' || s.stayPlaces.length >= 1)) {
          s.openPremiumPaywall();
          return;
        }
        await s.createStayPlace(input);
        router.back();
      }}
    />
  );
}
