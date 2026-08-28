import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { MapPhotoCluster } from '@/features/photos/photoClusters';
import { MapPhoto } from '@/features/photos/photoLibrary';
import { AppStyles } from '@/ui/appStyles';

/** 写真プレビュー系モーダルのprops。 */
export type PhotoPreviewModalsProps = {
  /** 選択中の写真クラスタ。 */
  selectedPhotoCluster: MapPhotoCluster | null;
  /** 写真クラスタをページ分割した一覧。 */
  selectedPhotoClusterPages: MapPhoto[][];
  /** 選択中の単体写真。 */
  selectedPhoto: MapPhoto | null;
  /**
   * 拡大表示に使うURI。高解像度を取得できるまでは `selectedPhoto.uri`(サムネイル)と同じ値になる。
   *
   * 解決は端末APIを叩くため、コンポーネント内では行わずここへ渡してもらう。
   */
  selectedPhotoPreviewUri: string | null;
  /** 高解像度の取得中かどうか。iCloudからのダウンロードは数秒かかりうるため待機表示を出す。 */
  isSelectedPhotoPreviewLoading: boolean;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 写真クラスタ選択を変更する処理。 */
  onSelectPhotoCluster: (cluster: MapPhotoCluster | null) => void;
  /** 単体写真選択を変更する処理。 */
  onSelectPhoto: (photo: MapPhoto | null) => void;
};

/**
 * 写真クラスタの吹き出しと全画面写真プレビューを描画する。
 *
 * サムネイルを取得できなかった写真(`uri` がnull)は、白紙のマスや真っ黒な画面にせず
 * プレースホルダを描画する。地図側で除外せず表示している以上、開いた先でも
 * 「画像は出せないが写真は存在する」と分かる必要があるため(設計書 §5.2)。
 *
 * 拡大表示はサムネイルではなく `selectedPhotoPreviewUri`(高解像度)を使う。高解像度が
 * 届くまではサムネイルが渡ってくるので、開いた瞬間から何かが見えている状態を保てる。
 */
export function PhotoPreviewModals({
  selectedPhotoCluster,
  selectedPhotoClusterPages,
  selectedPhoto,
  selectedPhotoPreviewUri,
  isSelectedPhotoPreviewLoading,
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
                      accessibilityLabel={photo.uri === null ? '画像を表示できない写真を開く' : '写真を開く'}
                      accessibilityRole="button"
                      onPress={() => {
                        onSelectPhotoCluster(null);
                        onSelectPhoto(photo);
                      }}
                      style={styles.photoClusterGridItem}
                    >
                      {photo.uri === null ? (
                        <View style={styles.photoClusterGridPlaceholder}>
                          <MaterialCommunityIcons name="image-off-outline" size={20} color={styles.photoMarkerPlaceholderIcon.color} />
                        </View>
                      ) : (
                        <Image source={{ uri: photo.uri }} style={styles.photoClusterGridImage} />
                      )}
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
            {selectedPhoto &&
              (selectedPhotoPreviewUri === null ? (
                <View style={styles.photoPreviewPlaceholder}>
                  <MaterialCommunityIcons name="image-off-outline" size={48} color={styles.photoPreviewPlaceholderText.color} />
                  <Text style={styles.photoPreviewPlaceholderText}>この写真の画像を表示できません</Text>
                </View>
              ) : (
                <Image source={{ uri: selectedPhotoPreviewUri }} style={styles.photoPreviewImage} resizeMode="contain" />
              ))}
            {isSelectedPhotoPreviewLoading && (
              <ActivityIndicator
                accessibilityLabel="高解像度の写真を読み込み中"
                accessibilityRole="progressbar"
                color={styles.photoPreviewLoadingIndicator.color}
                style={styles.photoPreviewLoading}
              />
            )}
            <Text style={styles.photoPreviewHint}>タップして閉じる</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}
