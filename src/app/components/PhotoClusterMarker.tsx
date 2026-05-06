import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { MapPhotoCluster } from '../../features/photos/photoClusters';
import { createStyles } from '../appStyles';

/** 写真クラスタマーカーに必要なStyleSheet型。 */
type AppStyles = ReturnType<typeof createStyles>;

export type PhotoClusterMarkerProps = {
  /** 描画対象の写真クラスタ。 */
  cluster: MapPhotoCluster;
  /** App全体で共有しているスタイル。 */
  styles: AppStyles;
  /** 写真クラスタが押されたときの処理。 */
  onPress: (cluster: MapPhotoCluster) => void;
};

/**
 * 地図上に表示する写真クラスタマーカー。
 *
 * @param props - 写真クラスタ、スタイル、押下時コールバック。
 * @returns 写真クラスタMarker。写真が空の場合はnull。
 */
export function PhotoClusterMarker({ cluster, styles, onPress }: PhotoClusterMarkerProps) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const representativePhoto = cluster.photos[0];
  const badgeLabel = getPhotoClusterBadgeLabel(cluster);
  const isCluster = cluster.photos.length > 1;

  if (!representativePhoto) {
    return null;
  }

  return (
    <Marker
      coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
      anchor={{ x: 0.5, y: 1 }}
      identifier={cluster.id}
      tracksViewChanges={tracksViewChanges}
      zIndex={cluster.photos.length}
      onPress={() => onPress(cluster)}
    >
      <View collapsable={false} style={isCluster ? styles.photoClusterMarkerContainer : styles.photoMarkerContainer}>
        <View collapsable={false} style={isCluster ? styles.photoClusterMarkerBubble : styles.photoMarkerBubble}>
          <Image source={{ uri: representativePhoto.uri }} style={styles.photoMarkerImage} onLoadEnd={() => setTracksViewChanges(false)} />
        </View>
        {badgeLabel ? (
          <View style={styles.photoClusterBadge}>
            <Text style={styles.photoClusterBadgeText}>{badgeLabel}</Text>
          </View>
        ) : null}
      </View>
    </Marker>
  );
}

/**
 * 写真クラスタ内の写真枚数を示すバッジ文言を作る。
 *
 * @param cluster - 対象の写真クラスタ。
 * @returns 追加写真枚数。単体写真の場合はnull。
 */
function getPhotoClusterBadgeLabel(cluster: MapPhotoCluster): string | null {
  const hiddenPhotoCount = cluster.photos.length - 1;

  if (hiddenPhotoCount <= 0) {
    return null;
  }

  return `+${hiddenPhotoCount}`;
}
