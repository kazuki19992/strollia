import { fireEvent, render, screen } from '@testing-library/react-native';
import { Image } from 'react-native';

import type { MapPhoto } from '@/features/photos/photoLibrary';
import { lightTheme } from '@/theme/theme';
import { createStyles } from '@/ui/appStyles';
import { PhotoPreviewModals, PhotoPreviewModalsProps } from '@/ui/components/PhotoPreviewModals';

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: require('react-native').Text, // eslint-disable-line @typescript-eslint/no-require-imports
}));

/**
 * テスト用の地図写真を作る。
 *
 * @param id - アセットID。
 * @param uri - 表示用URI。サムネイルを取得できなかった写真を再現する場合はnull。
 * @returns 地図表示用写真。
 */
function createPhoto(id: string, uri: string | null): MapPhoto {
  return { id, uri, latitude: 35, longitude: 139, creationTime: 0, width: 100, height: 80 };
}

const styles = createStyles(lightTheme);

/**
 * 既定のpropsに差分を当てて描画する。
 *
 * @param overrides - 上書きしたいprops。
 * @returns render の戻り値。
 */
function renderModals(overrides: Partial<PhotoPreviewModalsProps>) {
  const props: PhotoPreviewModalsProps = {
    selectedPhotoCluster: null,
    selectedPhotoClusterPages: [],
    selectedPhoto: null,
    selectedPhotoPreviewUri: null,
    isSelectedPhotoPreviewLoading: false,
    styles,
    onSelectPhotoCluster: jest.fn(),
    onSelectPhoto: jest.fn(),
    ...overrides,
  };

  return render(<PhotoPreviewModals {...props} />);
}

describe('写真プレビュー PhotoPreviewModals', () => {
  test('クラスタ一覧で画像が無い写真はプレースホルダにし、押せば拡大表示へ進める', () => {
    const photoWithoutImage = createPhoto('asset-1', null);
    const onSelectPhoto = jest.fn();
    renderModals({
      selectedPhotoCluster: { id: 'cluster-1', latitude: 35, longitude: 139, photos: [photoWithoutImage] },
      selectedPhotoClusterPages: [[photoWithoutImage]],
      onSelectPhoto,
    });

    expect(screen.UNSAFE_queryByType(Image)).toBeNull();

    fireEvent.press(screen.getByLabelText('画像を表示できない写真を開く'));

    expect(onSelectPhoto).toHaveBeenCalledWith(photoWithoutImage);
  });

  test('クラスタ一覧で画像がある写真はその画像を表示する', () => {
    const photo = createPhoto('asset-1', 'file:///tmp/asset-1.jpg');
    renderModals({
      selectedPhotoCluster: { id: 'cluster-1', latitude: 35, longitude: 139, photos: [photo] },
      selectedPhotoClusterPages: [[photo]],
    });

    // Imageのsourceは利用者に見えない実装詳細のため、ここだけ型検索でURIを確認する
    expect(screen.UNSAFE_getByType(Image).props.source).toEqual({ uri: 'file:///tmp/asset-1.jpg' });
  });

  test('拡大表示で画像が無い場合は白紙にせず、取得できない旨を表示する', () => {
    renderModals({ selectedPhoto: createPhoto('asset-1', null), selectedPhotoPreviewUri: null });

    expect(screen.UNSAFE_queryByType(Image)).toBeNull();
    expect(screen.getByText('この写真の画像を表示できません')).toBeTruthy();
  });

  test('拡大表示は渡された拡大表示用URIを使う(高解像度へ差し替わる)', () => {
    renderModals({
      selectedPhoto: createPhoto('asset-1', 'file:///caches/asset-1-512.jpg'),
      selectedPhotoPreviewUri: 'file:///caches/asset-1-preview.jpg',
    });

    expect(screen.UNSAFE_getByType(Image).props.source).toEqual({ uri: 'file:///caches/asset-1-preview.jpg' });
  });

  test('高解像度の取得中はサムネイルを表示したままローディングを出す', () => {
    renderModals({
      selectedPhoto: createPhoto('asset-1', 'file:///caches/asset-1-512.jpg'),
      selectedPhotoPreviewUri: 'file:///caches/asset-1-512.jpg',
      isSelectedPhotoPreviewLoading: true,
    });

    expect(screen.UNSAFE_getByType(Image).props.source).toEqual({ uri: 'file:///caches/asset-1-512.jpg' });
    expect(screen.getByLabelText('高解像度の写真を読み込み中')).toBeTruthy();
  });

  test('取得が終わればローディングは消える', () => {
    renderModals({
      selectedPhoto: createPhoto('asset-1', 'file:///caches/asset-1-512.jpg'),
      selectedPhotoPreviewUri: 'file:///caches/asset-1-preview.jpg',
      isSelectedPhotoPreviewLoading: false,
    });

    expect(screen.queryByLabelText('高解像度の写真を読み込み中')).toBeNull();
  });
});
