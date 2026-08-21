import * as MediaLibrary from 'expo-media-library/legacy';

import { reportPhotoMapDiagnostics } from '@/config/sentry';
import { getPhotoAssetsInBounds, savePhotoAssets, type PhotoAssetRecord } from '@/features/photos/photoAssetRepository';
import { createPhotoAssetReconciliation } from '@/features/photos/photoScanWindow';
import type { PhotoViewportBounds } from '@/features/photos/photoViewportBounds';
import { mapWithConcurrency } from '@/utils/concurrency';

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
 * getAssetInfoAsync の同時実行数。
 *
 * ネイティブ実装(iOS)は完了ブロック内でフル解像度画像をメインキュー上でデコードするため、
 * 一斉並列で発行するとメインスレッドが長時間ブロックされ App Hang を引き起こす
 * (2026-08-08 Sentry 観測: 200並列でメインスレッドが2秒以上停止)。
 * 同時実行数を絞ることでメインキューへ一度に積まれるデコード量を抑える。
 */
export const PHOTO_INFO_CONCURRENCY = 4;

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
 * MediaLibrary由来の座標値を有限な数値へ正規化する。
 *
 * expo-media-library の型定義(`Location`)は緯度経度を `number` と宣言しているが、**iOSのネイティブ
 * 実装は文字列を返す**。`ios/MediaLibraryUtilities.swift` の `exportLocation` が
 * `["latitude": "\(...)"]` という `[String: String]` を返し、JS側(`build/legacy/MediaLibrary.js` の
 * `getAssetInfoAsync`)にも正規化が無いため、実行時は `latitude: "35.6812"` になる。
 * Androidは `putDouble` で数値を返すため、OSによって実際の型が食い違う。
 *
 * 文字列のまま `<Marker coordinate>` まで到達すると、クラスタリング計算(乗除算のみ)は暗黙の数値変換で
 * 動いてしまう一方、New Architecture の codegen が Double を期待するため座標を解決できず、
 * 例外もエラーも出さずにマーカーだけが描画されない(issue #160)。
 * このため境界であるこの関数で数値へ寄せ、アプリ内部は数値のみを扱う。
 *
 * 実行時の型がライブラリ型定義と一致しない前提の関数なので、引数は `unknown` で受けて
 * null / undefined / オブジェクトなど想定外の値も安全側(null)へ倒す。
 *
 * @param value - ネイティブ由来の緯度または経度。実行時はnumberまたはstring。
 * @returns 有限な数値へ変換できた場合はその値、できない場合はnull。
 */
function toFiniteCoordinate(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    // Number('') は 0 になり赤道上の座標として通ってしまうため、空文字は先に弾く
    const trimmed = value.trim();
    if (trimmed === '') {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

/**
 * MediaLibraryの詳細アセットを地図表示用写真へ変換する。
 *
 * 緯度経度はここで数値へ変換する(理由は `toFiniteCoordinate` のJSDocを参照)。
 * 数値として解釈できない座標の写真は地図に置けないため、ジオタグなしと同様に除外する。
 *
 * @param asset - MediaLibrary.getAssetInfoAsyncで取得した詳細アセット。
 * @returns 有効なジオタグがある写真の場合はMapPhoto、ない場合はnull。
 */
export function toMapPhoto(asset: MediaLibrary.AssetInfo): MapPhoto | null {
  if (!asset.location) {
    return null;
  }

  const latitude = toFiniteCoordinate(asset.location.latitude);
  const longitude = toFiniteCoordinate(asset.location.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return {
    id: asset.id,
    uri: asset.localUri ?? asset.uri,
    latitude,
    longitude,
    creationTime: asset.creationTime,
    width: asset.width,
    height: asset.height,
  };
}

/**
 * MediaLibraryの詳細アセットを `photo_assets` の保存レコードへ変換する。
 *
 * `MapPhoto.uri` が `localUri ?? uri` を採るのに対し、**保存するのは `asset.uri` だけ**である。
 * `localUri` は `requestContentEditingInput` が返す一時パスで、アプリ再起動をまたいで
 * 有効である保証がないため永続化してはいけない(親設計書 §4.2)。
 *
 * @param asset - MediaLibrary.getAssetInfoAsyncで取得した詳細アセット。
 * @returns 有効なジオタグがある写真の場合は保存レコード、ない場合はnull。
 */
export function toPhotoAssetRecord(asset: MediaLibrary.AssetInfo): PhotoAssetRecord | null {
  if (!asset.location) {
    return null;
  }

  const latitude = toFiniteCoordinate(asset.location.latitude);
  const longitude = toFiniteCoordinate(asset.location.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return {
    assetId: asset.id,
    latitude,
    longitude,
    // iOSの PHAsset.creationDate は optional で、取得できないアセットが存在する。
    // 0 や不正値をエポック時刻として保存しないよう null へ倒す
    takenAt: Number.isFinite(asset.creationTime) && asset.creationTime > 0 ? new Date(asset.creationTime).toISOString() : null,
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
  };
}

/**
 * `photo_assets` に保存済みのメタデータを地図表示用写真へ変換する。
 *
 * **保存済みデータから `MapPhoto` を組み立てる箇所はここ1つに閉じている。**
 * 表示に使うURIの決め方(現状は保存した安定URIをそのまま使う)を変えるときは、必ずこの関数だけを
 * 直す。親設計書 §9-2 のとおり「`uri` 単独でサムネイル表示できるか」は実機未検証であり、
 * 描画できなかった場合は表示直前に `getAssetInfoAsync` で `localUri` を解決する方式へ
 * 切り替える必要がある。その手戻りをこの関数の内側だけに閉じ込めるため、
 * 呼び出し側でURIを組み立て直してはいけない。
 *
 * @param record - `photo_assets` から取得したメタデータ。
 * @returns 地図表示用の写真。
 */
export function toMapPhotoFromPhotoAsset(record: PhotoAssetRecord): MapPhoto {
  const creationTime = record.takenAt === null ? Number.NaN : Date.parse(record.takenAt);

  return {
    id: record.assetId,
    uri: record.uri,
    latitude: record.latitude,
    longitude: record.longitude,
    // 撮影日時を持たないアセットは iOS に実在する。表示順の基準として 0(最古扱い)へ倒す
    creationTime: Number.isNaN(creationTime) ? 0 : creationTime,
    width: record.width,
    height: record.height,
  };
}

/**
 * 表示範囲に含まれるジオタグ付き写真を `photo_assets` から読み込む。
 *
 * 写真ライブラリの走査(重いデコードを伴う)は行わず、保存済みメタデータだけを参照する。
 *
 * @param bounds - 検索対象の緯度経度境界。
 * @returns 範囲内の地図表示用写真。
 */
export async function loadGeotaggedPhotosInBounds(bounds: PhotoViewportBounds): Promise<MapPhoto[]> {
  const records = await getPhotoAssetsInBounds(bounds);

  return records.map(toMapPhotoFromPhotoAsset);
}

/**
 * 写真ライブラリからジオタグ付き写真だけを読み込む。
 *
 * 読み込んだメタデータは `photo_assets` へ保存し、ビューポート検索の対象にする。
 * 保存は表示の付随処理であり、失敗しても写真表示そのものは継続させる(ログのみ残す)。
 *
 * あわせて、走査済みの時間窓に限って保存済みの行と突き合わせる。窓の中にありながら今回の走査で
 * 確認できなかった行は、写真ライブラリから削除されたかジオタグを失ったものなので削除する
 * (残すと画像を読めず地図上に空のバブルが出る)。判定条件は `createPhotoAssetReconciliation` を参照。
 *
 * 実機でのみ再現する「写真が表示されない」不具合の切り分けのため、末尾で件数の診断を
 * Sentryへ送る(調査用の一時的な計装。詳細は `docs/photo-geotag.md`)。
 *
 * @param limit - 走査する最新写真の最大件数。初期表示の重さを抑えるため上限を持つ。
 * @returns 地図上に表示可能なジオタグ付き写真一覧。
 */
export async function loadGeotaggedPhotos(limit = DEFAULT_PHOTO_SCAN_LIMIT): Promise<MapPhoto[]> {
  const startedAtMs = Date.now();

  const page = await MediaLibrary.getAssetsAsync({
    first: limit,
    mediaType: MediaLibrary.MediaType.photo,
    sortBy: [[MediaLibrary.SortBy.creationTime, false]],
  });

  const details = await mapWithConcurrency(page.assets, PHOTO_INFO_CONCURRENCY, (asset) =>
    MediaLibrary.getAssetInfoAsync(asset, { shouldDownloadFromNetwork: false }),
  );

  const photos = details.flatMap((result) => {
    if (result.status !== 'fulfilled') {
      return [];
    }

    const photo = toMapPhoto(result.value);
    return photo ? [photo] : [];
  });

  const assetRecords = details.flatMap((result) => {
    if (result.status !== 'fulfilled') {
      return [];
    }

    const record = toPhotoAssetRecord(result.value);
    return record ? [record] : [];
  });

  // 走査済み時間窓との突き合わせ用に、ページ内アセットごとの結果を組み立てる。
  // `mapWithConcurrency` は入力順を保つため、`details[index]` は `page.assets[index]` の結果である。
  const savedAssetIds = new Set(assetRecords.map((record) => record.assetId));
  const outcomes = page.assets.map((asset, index) => ({
    assetId: asset.id,
    isInfoResolved: details[index].status === 'fulfilled',
    isSaved: savedAssetIds.has(asset.id),
  }));
  const reconciliation = createPhotoAssetReconciliation({ assets: page.assets, outcomes, hasNextPage: page.hasNextPage });

  await savePhotoAssets(assetRecords, reconciliation).catch((error: unknown) => {
    console.warn('Failed to save photo assets:', error);
  });

  const assetInfoFulfilledCount = details.filter((result) => result.status === 'fulfilled').length;

  reportPhotoMapDiagnostics('load', {
    requestedLimit: limit,
    scannedAssetCount: page.assets.length,
    hasNextPage: page.hasNextPage,
    assetInfoFulfilledCount,
    assetInfoRejectedCount: details.length - assetInfoFulfilledCount,
    geotaggedPhotoCount: photos.length,
    durationMs: Date.now() - startedAtMs,
  });

  return photos;
}
