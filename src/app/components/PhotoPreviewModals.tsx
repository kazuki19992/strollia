import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { MapPhotoCluster } from '@/features/photos/photoClusters';
import { MapPhoto } from '@/features/photos/photoLibrary';
import { AppStyles } from '@/app/appStyles';

/** 写真プレビュー系モーダルのprops。 */
export type PhotoPreviewModalsProps = {
  /** 選択中の写真クラスタ。 */
  selectedPhotoCluster: MapPhotoCluster | null;
  /** 写真クラスタをページ分割した一覧。 */
  selectedPhotoClusterPages: MapPhoto[][];
  /** 選択中の単体写真。 */
  selectedPhoto: MapPhoto | null;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 写真クラスタ選択を変更する処理。 */
  onSelectPhotoCluster: (cluster: MapPhotoCluster | null) => void;
  /** 単体写真選択を変更する処理。 */
  onSelectPhoto: (photo: MapPhoto | null) => void;
};

/** 写真クラスタの吹き出しと全画面写真プレビューを描画する。 */
export function PhotoPreviewModals({
  selectedPhotoCluster,
  selectedPhotoClusterPages,
  selectedPhoto,
  styles,
  onSelectPhotoCluster,
  onSelectPhoto,
}: PhotoPreviewModalsProps) {
  return (
    <>
      <Modal visible={selectedPhotoCluster != null} transparent animationType="fade" onRequestClose={() => onSelectPhotoCluster(null)}>
        <Pressable onPress={() => onSelectPhotoCluster(null)} style={styles.photoClusterOverlay}>
          <Pressable onPress={() => undefined} style={styles.photoClusterCallout}>
            <Text style={styles.photoClusterTitle}>この場所の写真</Text>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={selectedPhotoClusterPages.length > 1}
              style={styles.photoClusterPager}
            >
              {selectedPhotoClusterPages.map((pagePhotos, pageIndex) => (
                <View key={`photo-cluster-page-${pageIndex}`} style={styles.photoClusterPage}>
                  {pagePhotos.map((photo) => (
                    <Pressable
                      key={photo.id}
                      onPress={() => {
                        onSelectPhotoCluster(null);
                        onSelectPhoto(photo);
                      }}
                      style={styles.photoClusterGridItem}
                    >
                      <Image source={{ uri: photo.uri }} style={styles.photoClusterGridImage} />
                    </Pressable>
                  ))}
                </View>
              ))}
            </ScrollView>
            {selectedPhotoClusterPages.length > 1 && <Text style={styles.photoClusterMoreText}>横にスワイプして他の写真を見る</Text>}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={selectedPhoto != null} transparent animationType="fade" onRequestClose={() => onSelectPhoto(null)}>
        <View style={styles.photoPreviewBackdrop}>
          <Pressable onPress={() => onSelectPhoto(null)} style={styles.photoPreviewCloseArea}>
            {selectedPhoto && <Image source={{ uri: selectedPhoto.uri }} style={styles.photoPreviewImage} resizeMode="contain" />}
            <Text style={styles.photoPreviewHint}>タップして閉じる</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}
