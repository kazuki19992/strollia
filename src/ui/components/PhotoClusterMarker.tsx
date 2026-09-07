import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { MapPhotoCluster } from '@/features/photos/photoClusters';
import { createStyles } from '@/ui/appStyles';

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
 * 代表写真の画像を取得できなかった場合(iCloudにしか本体が無いなど)は、マーカーを消さず
 * プレースホルダを描画する。写真がそこにあるという情報自体に地図上の価値があるためで、
 * 画像が無い写真を除外すると地図から写真マーカーが丸ごと消えてしまう(設計書 §5.2)。
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

  const representativeUri = representativePhoto.uri;

  return (
    <Marker
      accessibilityLabel={getPhotoClusterAccessibilityLabel(cluster.photos.length, representativeUri !== null)}
      coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
      anchor={{ x: 0.5, y: 1 }}
      identifier={cluster.id}
      tracksViewChanges={tracksViewChanges}
      zIndex={cluster.photos.length}
      onPress={() => onPress(cluster)}
    >
      <View collapsable={false} style={isCluster ? styles.photoClusterMarkerContainer : styles.photoMarkerContainer}>
        <View collapsable={false} style={isCluster ? styles.photoClusterMarkerBubble : styles.photoMarkerBubble}>
          {representativeUri !== null ? (
            <Image source={{ uri: representativeUri }} style={styles.photoMarkerImage} onLoadEnd={() => setTracksViewChanges(false)} />
          ) : (
            // 画像が無い場合は onLoadEnd が来ない。レイアウト完了をもって
            // tracksViewChanges を止め、地図の更新のたびにスナップショットを作り直させない
            <View
              accessibilityLabel="画像を表示できない写真"
              style={styles.photoMarkerPlaceholder}
              onLayout={() => setTracksViewChanges(false)}
            >
              <MaterialCommunityIcons name="image-off-outline" size={20} color={styles.photoMarkerPlaceholderIcon.color} />
            </View>
          )}
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
 * 写真クラスタマーカーの読み上げ文言を作る。
 *
 * 画像を表示できない場合はその旨を含める。見た目上もプレースホルダになるため、
 * 読み上げでも「写真はあるが画像が出せない」状態が伝わるようにしている。
 *
 * @param photoCount - クラスタ内の写真枚数。
 * @param hasImage - 代表写真の画像を表示できるかどうか。
 * @returns 読み上げ文言。
 */
function getPhotoClusterAccessibilityLabel(photoCount: number, hasImage: boolean): string {
  return hasImage ? `写真${photoCount}枚を開く` : `写真${photoCount}枚を開く（画像を表示できません）`;
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
