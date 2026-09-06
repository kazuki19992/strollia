import { useState } from 'react';
import { Image, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { getStayPlaceEmoji } from '@/features/stayPlaces/stayPlaceEmojiCatalog';
import type { StayPlace } from '@/features/stayPlaces/stayPlaceTypes';
import type { AppStyles } from '@/ui/appStyles';

/** 地図上の滞在場所マーカーのprops。 */
export type StayPlaceMapMarkerProps = {
  /** 表示する有効な滞在場所。 */
  place: StayPlace;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** マーカーをタップしたときに場所の詳細を開く。 */
  onPress: (place: StayPlace) => void;
};

/**
 * 地図上にTwemoji入りの吹き出し型マーカーを表示する。
 *
 * Twemojiのロード完了後はtracksViewChangesを止め、地図の追従更新でネイティブ側の
 * マーカースナップショットを再生成し続けないようにする。
 */
export function StayPlaceMapMarker({ place, styles, onPress }: StayPlaceMapMarkerProps): React.ReactElement | null {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const emoji = getStayPlaceEmoji(place.iconHexcode);

  if (!emoji) {
    return null;
  }

  return (
    <Marker
      accessibilityLabel={`${place.name}を開く`}
      anchor={{ x: 0.5, y: 1 }}
      coordinate={{ latitude: place.latitude, longitude: place.longitude }}
      identifier={`stay-place-${place.id}`}
      tracksViewChanges={tracksViewChanges}
      zIndex={3}
      onPress={() => onPress(place)}
    >
      <View collapsable={false} style={styles.stayPlaceMapMarkerContainer}>
        <View collapsable={false} style={styles.stayPlaceMapMarkerBubble} testID="stay-place-map-marker-bubble">
          <Image
            accessibilityLabel={`${emoji.label}のTwemojiアイコン`}
            source={emoji.asset}
            style={styles.stayPlaceMapMarkerImage}
            onLoadEnd={() => setTracksViewChanges(false)}
          />
        </View>
      </View>
    </Marker>
  );
}
