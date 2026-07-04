import * as MediaLibrary from 'expo-media-library';

import { hasFullPhotoAccess, loadGeotaggedPhotos, toMapPhoto } from '@/features/photos/photoLibrary';

jest.mock('expo-media-library', () => ({
  getAssetsAsync: jest.fn(),
  getAssetInfoAsync: jest.fn(),
  MediaType: { photo: 'photo' },
  SortBy: { creationTime: 'creationTime' },
}));

/**
 * テスト用の写真アセット詳細を作る。
 *
 * @param id - アセットID。
 * @param location - 写真の位置情報。
 * @returns MediaLibrary.AssetInfo相当のテストデータ。
 */
function createAssetInfo(id: string, location?: { latitude: number; longitude: number }): MediaLibrary.AssetInfo {
  return {
    id,
    uri: `ph://${id}`,
    localUri: `file:///${id}.jpg`,
    mediaType: 'photo',
    width: 100,
    height: 80,
    creationTime: 1,
    modificationTime: 2,
    duration: 0,
    filename: `${id}.jpg`,
    location,
  } as MediaLibrary.AssetInfo;
}

describe('写真ライブラリ権限 hasFullPhotoAccess', () => {
  it('フルアクセスが許可されている場合はtrueを返す', () => {
    expect(hasFullPhotoAccess({ granted: true, accessPrivileges: 'all' } as MediaLibrary.PermissionResponse)).toBe(true);
  });

  it('限定アクセスや拒否状態の場合はfalseを返す', () => {
    expect(hasFullPhotoAccess({ granted: true, accessPrivileges: 'limited' } as MediaLibrary.PermissionResponse)).toBe(false);
    expect(hasFullPhotoAccess({ granted: false, accessPrivileges: 'none' } as MediaLibrary.PermissionResponse)).toBe(false);
  });
});

describe('地図写真変換 toMapPhoto', () => {
  it('ジオタグがある写真を地図表示用データへ変換する', () => {
    expect(toMapPhoto(createAssetInfo('asset-1', { latitude: 35, longitude: 139 }))).toEqual({
      id: 'asset-1',
      uri: 'file:///asset-1.jpg',
      latitude: 35,
      longitude: 139,
      creationTime: 1,
      width: 100,
      height: 80,
    });
  });

  it('localUriがない場合はasset.uriを使用する', () => {
    const asset = createAssetInfo('asset-1', { latitude: 35, longitude: 139 });
    delete asset.localUri;

    expect(toMapPhoto(asset)?.uri).toBe('ph://asset-1');
  });

  it('ジオタグがない写真はnullを返す', () => {
    expect(toMapPhoto(createAssetInfo('asset-1'))).toBeNull();
  });
});

describe('ジオタグ付き写真読み込み loadGeotaggedPhotos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ジオタグ付き写真だけを返す', async () => {
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({
      assets: [{ id: 'asset-1' }, { id: 'asset-2' }],
    });
    (MediaLibrary.getAssetInfoAsync as jest.Mock)
      .mockResolvedValueOnce(createAssetInfo('asset-1', { latitude: 35, longitude: 139 }))
      .mockResolvedValueOnce(createAssetInfo('asset-2'));

    await expect(loadGeotaggedPhotos()).resolves.toEqual([
      {
        id: 'asset-1',
        uri: 'file:///asset-1.jpg',
        latitude: 35,
        longitude: 139,
        creationTime: 1,
        width: 100,
        height: 80,
      },
    ]);
    expect(MediaLibrary.getAssetsAsync).toHaveBeenCalledWith(expect.objectContaining({ mediaType: MediaLibrary.MediaType.photo }));
  });

  it('写真ライブラリが空の場合は空配列を返す', async () => {
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({ assets: [] });

    await expect(loadGeotaggedPhotos()).resolves.toEqual([]);
    expect(MediaLibrary.getAssetInfoAsync).not.toHaveBeenCalled();
  });

  it('一部の詳細取得に失敗しても成功したジオタグ付き写真だけを返す', async () => {
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({
      assets: [{ id: 'asset-1' }, { id: 'asset-2' }],
    });
    (MediaLibrary.getAssetInfoAsync as jest.Mock)
      .mockResolvedValueOnce(createAssetInfo('asset-1', { latitude: 35, longitude: 139 }))
      .mockRejectedValueOnce(new Error('broken asset'));

    await expect(loadGeotaggedPhotos()).resolves.toHaveLength(1);
  });
});
