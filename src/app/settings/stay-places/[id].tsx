import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { StayPlaceEditorScreen } from '@/ui/components/StayPlaceEditorScreen';
import { useAppState } from '@/ui/state/AppStateProvider';

/** 滞在場所の編集ルート(/settings/stay-places/[id])。 */
export default function EditStayPlaceRoute(): React.ReactElement {
  const s = useAppState();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const place = s.stayPlaces.find((stayPlace) => stayPlace.id === Number(id));

  if (!place) {
    return <Redirect href="/settings/stay-places" />;
  }

  return (
    <StayPlaceEditorScreen
      initialCoordinate={{ latitude: place.latitude, longitude: place.longitude }}
      place={place}
      styles={s.styles}
      theme={s.theme}
      onBack={() => router.back()}
      onDelete={async () => {
        await s.deleteStayPlace(place.id);
        router.back();
      }}
      onSave={async (input) => {
        await s.updateStayPlace(place.id, input);
        router.back();
      }}
    />
  );
}
