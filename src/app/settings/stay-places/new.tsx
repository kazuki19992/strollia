import { useRouter } from 'expo-router';

import { StayPlaceEditorScreen } from '@/ui/components/StayPlaceEditorScreen';
import { useAppState } from '@/ui/state/AppStateProvider';

const DEFAULT_STAY_PLACE_COORDINATE = { latitude: 35.681236, longitude: 139.767125 };

/** 滞在場所の新規作成ルート(/settings/stay-places/new)。 */
export default function NewStayPlaceRoute(): React.ReactElement {
  const s = useAppState();
  const router = useRouter();

  return (
    <StayPlaceEditorScreen
      initialCoordinate={s.userCoordinate ?? DEFAULT_STAY_PLACE_COORDINATE}
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
