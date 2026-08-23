import { fireEvent, render, screen } from '@testing-library/react-native';
import { Image } from 'react-native';

import type { MapPhoto } from '@/features/photos/photoLibrary';
import { lightTheme } from '@/theme/theme';
import { createStyles } from '@/ui/appStyles';
import { PhotoPreviewModals } from '@/ui/components/PhotoPreviewModals';

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

describe('写真プレビュー PhotoPreviewModals', () => {
  test('クラスタ一覧で画像が無い写真はプレースホルダにし、押せば拡大表示へ進める', () => {
    const photoWithoutImage = createPhoto('asset-1', null);
    const onSelectPhoto = jest.fn();
    render(
      <PhotoPreviewModals
        selectedPhotoCluster={{ id: 'cluster-1', latitude: 35, longitude: 139, photos: [photoWithoutImage] }}
        selectedPhotoClusterPages={[[photoWithoutImage]]}
        selectedPhoto={null}
        styles={styles}
        onSelectPhotoCluster={jest.fn()}
        onSelectPhoto={onSelectPhoto}
      />,
    );

    expect(screen.UNSAFE_queryByType(Image)).toBeNull();

    fireEvent.press(screen.getByLabelText('画像を表示できない写真を開く'));

    expect(onSelectPhoto).toHaveBeenCalledWith(photoWithoutImage);
  });

  test('クラスタ一覧で画像がある写真はその画像を表示する', () => {
    const photo = createPhoto('asset-1', 'file:///tmp/asset-1.jpg');
    render(
      <PhotoPreviewModals
        selectedPhotoCluster={{ id: 'cluster-1', latitude: 35, longitude: 139, photos: [photo] }}
        selectedPhotoClusterPages={[[photo]]}
        selectedPhoto={null}
        styles={styles}
        onSelectPhotoCluster={jest.fn()}
        onSelectPhoto={jest.fn()}
      />,
    );

    // Imageのsourceは利用者に見えない実装詳細のため、ここだけ型検索でURIを確認する
    expect(screen.UNSAFE_getByType(Image).props.source).toEqual({ uri: 'file:///tmp/asset-1.jpg' });
  });

  test('拡大表示で画像が無い場合は白紙にせず、取得できない旨を表示する', () => {
    render(
      <PhotoPreviewModals
        selectedPhotoCluster={null}
        selectedPhotoClusterPages={[]}
        selectedPhoto={createPhoto('asset-1', null)}
        styles={styles}
        onSelectPhotoCluster={jest.fn()}
        onSelectPhoto={jest.fn()}
      />,
    );

    expect(screen.UNSAFE_queryByType(Image)).toBeNull();
    expect(screen.getByText('この写真の画像を表示できません')).toBeTruthy();
  });
});
