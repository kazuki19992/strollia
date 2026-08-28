import * as MediaLibrary from 'expo-media-library/legacy';

import { reportPhotoMapDiagnostics } from '@/config/sentry';
import { getPhotoAssetsInBounds, savePhotoAssets, type PhotoAssetRecord } from '@/features/photos/photoAssetRepository';
import { resolvePhotoDisplayUri } from '@/features/photos/photoDisplayUri';
import { createPhotoAssetReconciliation } from '@/features/photos/photoScanWindow';
import type { PhotoViewportBounds } from '@/features/photos/photoViewportBounds';
import { mapWithConcurrency } from '@/utils/concurrency';

/** 地図上に表示するジオタグ付き写真。 */
export type MapPhoto = {
  /** 写真ライブラリ内のアセットID。 */
  id: string;
  /**
   * サムネイルや全画面表示に使うURI。表示できる画像を用意できなかった場合はnull。
   *
   * nullを許すのは、iCloudにしか本体が無いなど**サムネイルを取得できない写真が実在する**ため。
   * かつてはそうした写真を結果から除外していたが、全件失敗する環境(「iPhoneのストレージを最適化」)で
   * 地図から写真マーカーが丸ごと消えてしまった。写真がそこにあるという情報自体に地図上の価値が
   * あるため、画像なしのマーカーとして描画する(設計書 §5.2)。
   */
  uri: string | null;
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

/**
 * 写真ライブラリ走査の結果。
 *
 * 走査できた写真と、その結果を `photo_assets` へ保存できたかを**分けて**返す。
 * 保存に失敗すると `photo_assets` は空のままなので、呼び出し側がビューポート検索に切り替えると
 * 「走査はできているのに1枚も表示されない」状態になってしまう。保存の成否を伝えることで、
 * 呼び出し側が走査結果をそのまま表示するフォールバックへ倒せるようにしている。
 */
export type GeotaggedPhotoScanResult = {
  /** 走査で得られたジオタグ付き写真。 */
  photos: MapPhoto[];
  /** 走査結果を `photo_assets` へ保存できたかどうか。falseの場合キャッシュは最新化されていない。 */
  isCacheSaved: boolean;
};

const DEFAULT_PHOTO_SCAN_LIMIT = 200;

/**
 * 写真ライブラリへの問い合わせ(`getAssetInfoAsync` / 表示用URIの解決)の同時実行数。
 *
 * `getAssetInfoAsync` のネイティブ実装(iOS)は完了ブロック内でフル解像度画像をメインキュー上で
 * デコードするため、一斉並列で発行するとメインスレッドが長時間ブロックされ App Hang を引き起こす
 * (2026-08-08 Sentry 観測: 200並列でメインスレッドが2秒以上停止)。
 * 同時実行数を絞ることでメインキューへ一度に積まれるデコード量を抑える。
 *
 * 表示用URIの解決(`resolvePhotoDisplayUri`)はフル解像度デコードを伴わないが、
 * `PHImageManager.requestImage` はサムネイルのデコードとJPEGの書き出しを行う。
 * ビューポート内の写真ぶんが一斉に走ると同じ轍を踏みうるため、別の値を持つ理由もなく同じ上限を共有する。
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
 * 走査済み時間窓との突き合わせ(削除)を行ってよい権限状態かを判定する。
 *
 * **限定アクセスでは突き合わせを行ってはいけない。** 限定アクセスの `getAssetsAsync` は
 * ユーザーが選択した写真だけを、しかも `hasNextPage: false` で返す。その結果を素直に突き合わせると
 * 「ライブラリ全体を見終えた」と誤認し、選択されていない写真の行をすべて削除してしまう。
 * 未選択の写真がライブラリに実在するのか削除されたのかは限定アクセスでは**区別できない**ため、
 * `getAssetInfoAsync` が reject したアセットの行を残すのと同じく「判断できないものは消さない」に倒す。
 *
 * 権限の参照自体に失敗した場合もフルアクセスと言い切れないため、同様に突き合わせを行わない。
 *
 * @returns 突き合わせを行ってよい場合はtrue。
 */
async function canReconcilePhotoAssets(): Promise<boolean> {
  try {
    // 参照のみ。権限の要求(ダイアログ表示)は写真表示をONにする導線の責務なので、ここでは行わない
    const permission = await MediaLibrary.getPermissionsAsync();

    return hasFullPhotoAccess(permission);
  } catch (error: unknown) {
    console.warn('Failed to read photo library permission:', error);

    return false;
  }
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
 * **表示用URIには `localUri` だけを使い、`asset.uri`(iOS: `ph://…`)へフォールバックしない。**
 * `ph://` は `<Image>` で描画できず白紙のマーカーになるだけで、表示用の値としては
 * 「無い」のと変わらない。iCloudに本体がある写真では `localUri` が得られないため、
 * ここでnullへ倒してプレースホルダ描画へ回す(設計書 §5.2)。
 * DBへ保存する安定した識別子は `toPhotoAssetRecord` が別途 `asset.uri` から作る。
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
    uri: asset.localUri ?? null,
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
 * `MapPhoto.uri` が表示できる `localUri` だけを採るのに対し、**保存するのは `asset.uri` だけ**である。
 * `localUri` は `requestContentEditingInput` が返す一時パスで、アプリ再起動をまたいで
 * 有効である保証がないため永続化してはいけない(親設計書 §4.2)。
 * 逆に `asset.uri`(`ph://…`)は表示には使えないが識別子としては安定しているので、
 * 表示用の値と保存用の値はここで意図的に分かれる。
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
 * ここで入る `uri` は保存した安定URI(iOS: `ph://…`)であり、**そのままでは `<Image>` で描画できない**
 * (親設計書 §9-2 は検証の結果「できない」で確定した)。描画できる形への変換は
 * `resolveMapPhotoDisplayUris` が担うため、この関数の結果を直接表示へ流してはいけない。
 *
 * @param record - `photo_assets` から取得したメタデータ。
 * @returns 表示用URI未解決の地図表示用写真。
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
 * 保存済みの安定URIを、`<Image>` で描画できる表示用URIへ置き換える。
 *
 * **解決できなかった写真も除外せず、`uri: null` のまま返す。** かつては除外していたが、
 * 「iPhoneのストレージを最適化」が有効な端末では解決が全件失敗し、地図から写真マーカーが
 * 丸ごと消えるという最悪の症状になった。画像が無いだけのマーカーとして描画すれば、
 * 少なくとも「そこに写真がある」ことは伝わる(設計書 §5.2)。失敗はキャッシュされないため、
 * 次回の読み込みで画像つきへ復帰できる。
 *
 * 解決を一斉並列で発行しないよう、写真ライブラリへの他の問い合わせと同じ上限で絞る。
 *
 * @param photos - 表示用URI未解決の写真。
 * @returns 表示用URIを解決した写真。解決できなかった写真は `uri: null` になる。入力順と件数を保つ。
 */
async function resolveMapPhotoDisplayUris(photos: MapPhoto[]): Promise<MapPhoto[]> {
  const resolvedUris = await mapWithConcurrency(photos, PHOTO_INFO_CONCURRENCY, (photo) =>
    photo.uri === null ? Promise.resolve(null) : resolvePhotoDisplayUri(photo.id, photo.uri),
  );

  return photos.map((photo, index) => {
    const result = resolvedUris[index];

    // 解決処理は本来nullを返して失敗を伝えるが、想定外の例外でも写真を落とさないよう
    // rejected も「画像なし」として扱う
    return { ...photo, uri: result.status === 'fulfilled' ? result.value : null };
  });
}

/**
 * 表示範囲に含まれるジオタグ付き写真を `photo_assets` から読み込む。
 *
 * 写真ライブラリの走査(重いデコードを伴う)は行わず、保存済みメタデータだけを参照する。
 * ただし保存されている `ph://` URIは `<Image>` で描画できないため、表示用URIだけは都度解決する
 * (理由は `resolvePhotoDisplayUri` を参照)。解決結果はセッション内のメモリキャッシュに載るため、
 * パンやズームを繰り返しても同じ写真の解決は1回で済む。
 *
 * @param bounds - 検索対象の緯度経度境界。
 * @returns 範囲内の地図表示用写真。表示用URIを解決できなかった写真も `uri: null` で含む。
 */
export async function loadGeotaggedPhotosInBounds(bounds: PhotoViewportBounds): Promise<MapPhoto[]> {
  const records = await getPhotoAssetsInBounds(bounds);

  return resolveMapPhotoDisplayUris(records.map(toMapPhotoFromPhotoAsset));
}

/**
 * 写真ライブラリからジオタグ付き写真だけを読み込む。
 *
 * 読み込んだメタデータは `photo_assets` へ保存し、ビューポート検索の対象にする。
 * 保存は表示の付随処理であり、失敗しても写真表示そのものは継続させる(ログのみ残す)。
 * ただし保存の成否は `isCacheSaved` として返す。保存できていないままビューポート検索へ進むと
 * 空のキャッシュを引いてしまうため、呼び出し側が走査結果を直接表示できるようにするためである。
 *
 * あわせて、走査済みの時間窓に限って保存済みの行と突き合わせる。窓の中にありながら今回の走査で
 * 確認できなかった行は、写真ライブラリから削除されたかジオタグを失ったものなので削除する
 * (残すと画像を読めず地図上に空のバブルが出る)。判定条件は `createPhotoAssetReconciliation` を参照。
 *
 * 実機でのみ再現する「写真が表示されない」不具合の切り分けのため、末尾で件数の診断を
 * Sentryへ送る(調査用の一時的な計装。詳細は `docs/photo-geotag.md`)。
 *
 * @param limit - 走査する最新写真の最大件数。初期表示の重さを抑えるため上限を持つ。
 * @returns 地図上に表示可能なジオタグ付き写真一覧と、キャッシュ保存の成否。
 */
export async function loadGeotaggedPhotos(limit = DEFAULT_PHOTO_SCAN_LIMIT): Promise<GeotaggedPhotoScanResult> {
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
  // フルアクセスが無いときは走査結果が「ライブラリの実態」を表さないため、突き合わせ(削除)を丸ごと
  // スキップして保存(UPSERT)だけ行う。理由は `canReconcilePhotoAssets` を参照
  const reconciliation = (await canReconcilePhotoAssets())
    ? createPhotoAssetReconciliation({ assets: page.assets, outcomes, hasNextPage: page.hasNextPage })
    : null;

  const isCacheSaved = await savePhotoAssets(assetRecords, reconciliation).then(
    () => true,
    (error: unknown) => {
      console.warn('Failed to save photo assets:', error);

      return false;
    },
  );

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

  return { photos, isCacheSaved };
}
