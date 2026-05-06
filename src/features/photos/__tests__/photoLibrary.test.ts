import * as MediaLibrary from 'expo-media-library';

import { hasFullPhotoAccess, toMapPhoto } from '../photoLibrary';

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
    expect(
      toMapPhoto({
        id: 'asset-1',
        uri: 'ph://asset-1',
        localUri: 'file:///asset-1.jpg',
        mediaType: 'photo',
        width: 100,
        height: 80,
        creationTime: 1,
        modificationTime: 2,
        duration: 0,
        location: { latitude: 35, longitude: 139 },
        filename: 'asset-1.jpg',
      }),
    ).toEqual({
      id: 'asset-1',
      uri: 'file:///asset-1.jpg',
      latitude: 35,
      longitude: 139,
      creationTime: 1,
      width: 100,
      height: 80,
    });
  });

  it('ジオタグがない写真はnullを返す', () => {
    expect(
      toMapPhoto({
        id: 'asset-1',
        uri: 'ph://asset-1',
        mediaType: 'photo',
        width: 100,
        height: 80,
        creationTime: 1,
        modificationTime: 2,
        duration: 0,
        filename: 'asset-1.jpg',
      }),
    ).toBeNull();
  });
});
