import { fireEvent, render, screen } from '@testing-library/react-native';
import { Image } from 'react-native';

import type { MapPhotoCluster } from '@/features/photos/photoClusters';
import type { MapPhoto } from '@/features/photos/photoLibrary';
import { lightTheme } from '@/theme/theme';
import { createStyles } from '@/ui/appStyles';
import { PhotoClusterMarker } from '@/ui/components/PhotoClusterMarker';

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: require('react-native').Text, // eslint-disable-line @typescript-eslint/no-require-imports
}));

jest.mock('react-native-maps', () => {
  const { Pressable } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports

  return {
    Marker: ({ accessibilityLabel, children, onPress }: { accessibilityLabel: string; children: React.ReactNode; onPress: () => void }) => (
      <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" onPress={onPress}>
        {children}
      </Pressable>
    ),
  };
});

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

/**
 * テスト用の写真クラスタを作る。
 *
 * @param photos - クラスタに含まれる写真。
 * @returns 写真クラスタ。
 */
function createCluster(photos: MapPhoto[]): MapPhotoCluster {
  return { id: 'cluster-1', latitude: 35, longitude: 139, photos };
}

const styles = createStyles(lightTheme);

describe('写真クラスタマーカー PhotoClusterMarker', () => {
  test('代表写真の画像がある場合はその画像を表示する', () => {
    render(
      <PhotoClusterMarker
        cluster={createCluster([createPhoto('asset-1', 'file:///tmp/asset-1.jpg')])}
        styles={styles}
        onPress={jest.fn()}
      />,
    );

    // Imageのsourceは利用者に見えない実装詳細のため、ここだけ型検索でURIを確認する
    expect(screen.UNSAFE_getByType(Image).props.source).toEqual({ uri: 'file:///tmp/asset-1.jpg' });
    expect(screen.queryByLabelText('画像を表示できない写真')).toBeNull();
  });

  test('代表写真の画像が無い場合は白紙にせず、プレースホルダを表示する', () => {
    render(<PhotoClusterMarker cluster={createCluster([createPhoto('asset-1', null)])} styles={styles} onPress={jest.fn()} />);

    expect(screen.getByLabelText('画像を表示できない写真')).toBeTruthy();
    expect(screen.UNSAFE_queryByType(Image)).toBeNull();
  });

  test('画像の有無にかかわらず枚数バッジを表示する', () => {
    const photosWithImage = [createPhoto('asset-1', 'file:///tmp/asset-1.jpg'), createPhoto('asset-2', 'file:///tmp/asset-2.jpg')];
    const { unmount } = render(<PhotoClusterMarker cluster={createCluster(photosWithImage)} styles={styles} onPress={jest.fn()} />);

    expect(screen.getByText('+1')).toBeTruthy();
    unmount();

    render(
      <PhotoClusterMarker
        cluster={createCluster([createPhoto('asset-1', null), createPhoto('asset-2', null)])}
        styles={styles}
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByText('+1')).toBeTruthy();
  });

  test('画像の有無でアクセシビリティラベルが変わり、押すとクラスタを通知する', () => {
    const onPress = jest.fn();
    const cluster = createCluster([createPhoto('asset-1', 'file:///tmp/asset-1.jpg'), createPhoto('asset-2', null)]);
    const { unmount } = render(<PhotoClusterMarker cluster={cluster} styles={styles} onPress={onPress} />);

    fireEvent.press(screen.getByLabelText('写真2枚を開く'));

    expect(onPress).toHaveBeenCalledWith(cluster);
    unmount();

    render(<PhotoClusterMarker cluster={createCluster([createPhoto('asset-1', null)])} styles={styles} onPress={onPress} />);

    expect(screen.getByLabelText('写真1枚を開く（画像を表示できません）')).toBeTruthy();
  });

  test('写真が空のクラスタは何も描画しない', () => {
    render(<PhotoClusterMarker cluster={createCluster([])} styles={styles} onPress={jest.fn()} />);

    expect(screen.toJSON()).toBeNull();
  });
});
