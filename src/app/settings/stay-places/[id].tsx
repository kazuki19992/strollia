import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { StayPlaceEditorScreen } from '@/ui/components/StayPlaceEditorScreen';
import { useAppState } from '@/ui/state/AppStateProvider';

/** 滞在場所の編集ルート(/settings/stay-places/[id])。 */
export default function EditStayPlaceRoute(): React.ReactElement {
  const s = useAppState();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const place = s.stayPlaces.find((stayPlace) => stayPlace.id === Number(id));

  // Cold startのDB読込中は空配列を「未登録」と扱わず、対象が解決するまで待機する。
  if (s.stayPlacesStatus === 'loading') {
    return (
      <View accessibilityLabel="滞在場所を読み込んでいます" style={s.styles.loadingContainer}>
        <ActivityIndicator color={s.theme.colors.primary} />
      </View>
    );
  }

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
