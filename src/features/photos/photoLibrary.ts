import * as MediaLibrary from 'expo-media-library';

/** 地図上に表示するジオタグ付き写真。 */
export type MapPhoto = {
  /** 写真ライブラリ内のアセットID。 */
  id: string;
  /** サムネイルや全画面表示に使うURI。 */
  uri: string;
  /** 写真の緯度。 */
  latitude: number;
  /** 写真の経度。 */
  longitude: number;
  /** 撮影日時のUnixミリ秒。 */
  creationTime: number;
  /** 写真の横幅。 */
  width: number;
  /** 写真の高さ。 */
  height: number;
};

const DEFAULT_PHOTO_SCAN_LIMIT = 200;

/**
 * 写真ライブラリ権限がフルアクセスかどうかを判定する。
 *
 * @param permission - expo-media-libraryの権限レスポンス。
 * @returns フルアクセスで読み取り可能な場合はtrue。
 */
export function hasFullPhotoAccess(permission: MediaLibrary.PermissionResponse): boolean {
  return permission.granted && permission.accessPrivileges !== 'limited' && permission.accessPrivileges !== 'none';
}

/**
 * MediaLibraryの詳細アセットを地図表示用写真へ変換する。
 *
 * @param asset - MediaLibrary.getAssetInfoAsyncで取得した詳細アセット。
 * @returns ジオタグがある写真の場合はMapPhoto、ない場合はnull。
 */
export function toMapPhoto(asset: MediaLibrary.AssetInfo): MapPhoto | null {
  if (!asset.location) {
    return null;
  }

  return {
    id: asset.id,
    uri: asset.localUri ?? asset.uri,
    latitude: asset.location.latitude,
    longitude: asset.location.longitude,
    creationTime: asset.creationTime,
    width: asset.width,
    height: asset.height,
  };
}

/**
 * 写真ライブラリからジオタグ付き写真だけを読み込む。
 *
 * @param limit - 走査する最新写真の最大件数。初期表示の重さを抑えるため上限を持つ。
 * @returns 地図上に表示可能なジオタグ付き写真一覧。
 */
export async function loadGeotaggedPhotos(limit = DEFAULT_PHOTO_SCAN_LIMIT): Promise<MapPhoto[]> {
  const page = await MediaLibrary.getAssetsAsync({
    first: limit,
    mediaType: MediaLibrary.MediaType.photo,
    sortBy: [[MediaLibrary.SortBy.creationTime, false]],
  });

  const details = await Promise.allSettled(
    page.assets.map((asset) => MediaLibrary.getAssetInfoAsync(asset, { shouldDownloadFromNetwork: false })),
  );

  return details.flatMap((result) => {
    if (result.status !== 'fulfilled') {
      return [];
    }

    const photo = toMapPhoto(result.value);
    return photo ? [photo] : [];
  });
}
