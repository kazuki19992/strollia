import {
  Asset,
  AssetField,
  getPermissionsAsync,
  MediaType,
  Query,
  type AssetMetadata,
  type Location,
  type PermissionResponse,
} from 'expo-media-library';

import { getPhotoScanLimitOverride } from '@/config/developmentFlags';
import { reportPhotoMapDiagnostics } from '@/config/sentry';
import { getPhotoAssetsInBounds, savePhotoAssets, type PhotoAssetRecord } from '@/features/photos/photoAssetRepository';
import { applyResolvedPhotoUris, resolvePhotoDisplayUriMap } from '@/features/photos/photoDisplayUri';
import { PHOTO_INFO_CONCURRENCY } from '@/features/photos/photoScanConcurrency';
import type { PhotoScanMetrics } from '@/features/photos/photoScanMetrics';
import { getPhotoScanBaselineMs, resolveNextPhotoScanBaselineMs, savePhotoScanBaselineMs } from '@/features/photos/photoScanState';
import { createPhotoAssetReconciliation } from '@/features/photos/photoScanWindow';
import type { PhotoViewportBounds } from '@/features/photos/photoViewportBounds';
import { mapWithConcurrency } from '@/utils/concurrency';

/** 地図上に表示するジオタグ付き写真。 */
export type MapPhoto = {
  /** 写真ライブラリ内のアセットID。 */
  id: string;
  /**
   * サムネイルや全画面表示に使う表示用URI。**未解決または解決できなかった場合はnull。**
   *
   * nullを許す理由は2つある。
   *
   * 1. iCloudにしか本体が無いなど**サムネイルを取得できない写真が実在する**。かつてはそうした
   *    写真を結果から除外していたが、全件失敗する環境(「iPhoneのストレージを最適化」)で地図から
   *    写真マーカーが丸ごと消えてしまった。写真がそこにあるという情報自体に地図上の価値が
   *    あるため、画像なしのマーカーとして描画する(設計書 §5.2)
   * 2. 表示用URIの解決は**地図に実際に出るクラスタの代表写真だけ**へ絞っている(設計書 §4.8)。
   *    ビューポート検索の直後は全件が未解決(null)で、代表になった写真とクラスタを開いた写真だけが
   *    あとから解決される
   *
   * どちらも「画像なしのプレースホルダを描く」という同じ扱いで済むため、状態を分けていない。
   */
  uri: string | null;
  /**
   * `photo_assets` に保存した安定URI(iOS: `ph://…`)。表示用URIの解決元。
   *
   * **`id` と同じとは限らない。** PR #167 より前に保存された行は `assetId` に `localIdentifier`、
   * `uri` に `ph://<localIdentifier>` が入っており、両者が食い違う。解決には保存された値の方が
   * 要るため、`id` とは別に持つ。
   *
   * この値は `<Image>` では描画できない(親設計書 §9-2 は検証の結果「できない」で確定した)。
   * 描画できる形への変換は `resolvePhotoDisplayUriMap` が担う。
   */
  storedUri: string;
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
  /**
   * 走査で得られたジオタグ付き写真。
   *
   * **`isCacheSaved` が false のときだけ、表示用URIを解決済みでそのまま描画に使える。**
   * true のときはビューポート検索を使うのが正しく、この配列は参照されない前提なので、
   * `uri` は未解決(null)のままにしてサムネイル書き出しのコストを避ける。
   */
  photos: MapPhoto[];
  /** 走査結果を `photo_assets` へ保存できたかどうか。falseの場合キャッシュは最新化されていない。 */
  isCacheSaved: boolean;
  /**
   * 走査の内訳(件数・所要時間)。
   *
   * 走査上限の撤廃(Phase 2-c)を実測で設計するための計測値。**フラグに関係なく常に計測する**
   * (`Date.now()` の差分なのでコストは無視できる)。表示するかどうかだけを
   * `createPhotoScanMetricsLines` がフラグで切り替える。
   */
  metrics: PhotoScanMetrics;
  /**
   * 実際に走った走査モード。
   *
   * 差分走査を要求しても基準時刻が無ければ全件走査へフォールバックするため、**要求したモードと
   * 一致するとは限らない**。呼び出し側が「今回は全件を見た」と判断できるよう結果として返す。
   */
  mode: PhotoScanMode;
};

/**
 * 写真ライブラリの走査モード。
 *
 * 実測(設計書 §2)では全ライブラリ18,000枚の走査が24秒かかり、しかも走査中に地図を操作すると
 * 1.6倍まで悪化する。自動で走る走査を差分に絞り、重い全件走査はユーザーの明示操作にだけ限ることで、
 * 通常利用で走査コストが見えないようにする。
 */
export type PhotoScanMode =
  /** 前回の基準時刻以降の写真を対象にする。起動時・写真表示ON時に自動で走る軽量な走査。 */
  | 'incremental'
  /** ライブラリ全体を対象にする。ユーザーが「ライブラリを再読み込み」を選んだときだけ走る。 */
  | 'full';

/**
 * 走査の進捗。
 *
 * 総数は `Query.exeForMetadata()` を終えて初めて分かる。それ以前は「何件あるのか」を答えられないため、
 * 呼び出し側は最初の通知が届くまで不定形の表示にする(設計書 §4.4)。
 */
export type PhotoScanProgress = {
  /** 走査対象のアセット総数。 */
  totalAssetCount: number;
  /** 位置情報の取得を終えたアセット数。取得に失敗したアセットも数える。 */
  processedAssetCount: number;
};

/** `loadGeotaggedPhotos` の実行条件。 */
export type PhotoScanOptions = {
  /** 走査モード。省略時は全件走査。 */
  mode?: PhotoScanMode;
  /**
   * 走査する最新写真の上限。nullは上限なし。
   *
   * 省略時は `resolvePhotoScanLimit()`(計測フラグが無ければ上限なし)を使う。
   */
  limit?: number | null;
  /**
   * 走査の進捗通知。
   *
   * **1件処理するごとに呼ばれる。** 全件走査は数万件に達しうるので、そのままUIの状態更新へ繋ぐと
   * 再レンダーで走査自体が遅くなる。間引きは呼び出し側(`usePhotoLibrarySync`)の責務とする。
   */
  onProgress?: (progress: PhotoScanProgress) => void;
};

/**
 * 今回の走査で使う上限を決める。
 *
 * **既定は上限なし(null)である。** かつては最新200件に絞っていたが、実測で全件走査のコストが
 * 想定の約1/40であることが分かったため上限を撤廃した(設計書 §2)。
 *
 * 計測用に `EXPO_PUBLIC_PHOTO_SCAN_LIMIT` が設定されている場合だけ、その値を上限にする
 * (**走査コストを実機で測り続けるための仕組み**として残している)。不正値の解釈は
 * `getPhotoScanLimitOverride` 側で吸収済みで、ここへはnullか有効な件数しか来ない。
 *
 * @returns 走査に使う上限件数。上限を掛けない場合はnull。
 */
export function resolvePhotoScanLimit(): number | null {
  return getPhotoScanLimitOverride();
}

/**
 * 写真ライブラリへの問い合わせの同時実行数。
 *
 * 実体は `photoScanConcurrency.ts` にあり、走査と表示用URIの解決で共有する。
 * 既存の import 経路を保つためここから再エクスポートする。
 */
export { PHOTO_INFO_CONCURRENCY };

/**
 * 写真ライブラリ権限がフルアクセスかどうかを判定する。
 *
 * @param permission - expo-media-libraryの権限レスポンス。
 * @returns フルアクセスで読み取り可能な場合はtrue。
 */
export function hasFullPhotoAccess(permission: PermissionResponse): boolean {
  return permission.granted && permission.accessPrivileges !== 'limited' && permission.accessPrivileges !== 'none';
}

/**
 * 走査済み時間窓との突き合わせ(削除)を行ってよい権限状態かを判定する。
 *
 * **限定アクセスでは突き合わせを行ってはいけない。** 限定アクセスの走査はユーザーが選択した写真だけを
 * 返すため、上限に満たない件数で返ってきて「ライブラリ全体を見終えた」と誤認し、選択されていない写真の
 * 行をすべて削除してしまう。
 * 未選択の写真がライブラリに実在するのか削除されたのかは限定アクセスでは**区別できない**ため、
 * `getLocation()` が reject したアセットの行を残すのと同じく「判断できないものは消さない」に倒す。
 *
 * 権限の参照自体に失敗した場合もフルアクセスと言い切れないため、同様に突き合わせを行わない。
 *
 * @returns 突き合わせを行ってよい場合はtrue。
 */
async function canReconcilePhotoAssets(): Promise<boolean> {
  try {
    // 参照のみ。権限の要求(ダイアログ表示)は写真表示をONにする導線の責務なので、ここでは行わない
    const permission = await getPermissionsAsync();

    return hasFullPhotoAccess(permission);
  } catch (error: unknown) {
    console.warn('Failed to read photo library permission:', error);

    return false;
  }
}

/**
 * MediaLibrary由来の座標値を有限な数値へ正規化する。
 *
 * **新APIの `Asset.getLocation()` は `Double` を返すため、本来この変換は不要である。**
 * それでも残しているのは、旧APIで「型定義は `number` なのに iOS のネイティブ実装は文字列を返す」
 * という食い違いが実際に起き、例外もエラーも出さずにマーカーだけが描画されない不具合(issue #160)に
 * なった経緯があるためである。原因は `ios/MediaLibraryUtilities.swift` の `exportLocation` が
 * `["latitude": "\(...)"]` という `[String: String]` を返し、JS側にも正規化が無かったこと。
 * 文字列のまま `<Marker coordinate>` まで到達すると、クラスタリング計算(乗除算のみ)は暗黙の数値変換で
 * 動いてしまう一方、New Architecture の codegen が Double を期待するため座標を解決できない。
 *
 * コストがほぼゼロである一方、「ライブラリの型宣言と実装は食い違いうる」という教訓を
 * テストごと残す価値があるため、新API移行後も境界のこの関数で数値へ寄せる
 * (設計書 `docs/superpowers/specs/2026-08-28-media-library-next-api-design.md` §4.4)。
 *
 * 実行時の型がライブラリ型定義と一致しない前提の関数なので、引数は `unknown` で受けて
 * null / undefined / オブジェクトなど想定外の値も安全側(null)へ倒す。
 *
 * @param value - ネイティブ由来の緯度または経度。型宣言上はnumberだが、実行時はstringでもありうる。
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
 * 走査で得た緯度経度を、地図に置ける数値の組へ正規化する。
 *
 * ジオタグが無い(location が null)場合と、座標として解釈できない場合を同じ「地図に置けない」として
 * まとめる。呼び出し側はこの結果がnullなら写真を除外する。
 *
 * @param location - `Asset.getLocation()` の結果。ジオタグが無い場合はnull。
 * @returns 有効な座標の場合は数値の組、それ以外はnull。
 */
function toMapCoordinate(location: Location | null): { latitude: number; longitude: number } | null {
  if (!location) {
    return null;
  }

  const latitude = toFiniteCoordinate(location.latitude);
  const longitude = toFiniteCoordinate(location.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return { latitude, longitude };
}

/**
 * 走査で得た寸法を数値へ正規化する。
 *
 * `AssetMetadata.width` / `height` は、メディアストアが値を持たない場合(Android)にnullになる。
 * 寸法は地図表示の判断には使っておらず欠けても実害がないため、0へ倒して型を単純に保つ。
 *
 * @param size - メタデータ上の寸法。取得できない場合はnull。
 * @returns 数値の寸法。取得できない場合は0。
 */
function toFiniteSize(size: number | null): number {
  return size !== null && Number.isFinite(size) ? size : 0;
}

/**
 * 走査結果(メタデータ + 位置情報)を地図表示用写真へ変換する。
 *
 * 緯度経度はここで数値へ変換する(理由は `toFiniteCoordinate` のJSDocを参照)。
 * 数値として解釈できない座標の写真は地図に置けないため、ジオタグなしと同様に除外する。
 *
 * **`storedUri` には `AssetMetadata.id`(`ph://<localIdentifier>`)をそのまま使う。**
 * 新APIの `Asset.getUri()` は `requestContentEditingInput` を伴い、iCloudにしか本体が無い写真では
 * 失敗する(PR #165 で対処した不具合の原因)。`id` はI/O無しで得られるうえ `photo_assets.uri` に
 * 保存している値と同一なので、走査ではこちらを安定URIとして使う。
 * ここで入る `ph://` は `<Image>` では描画できず、描画できる形への変換は
 * `resolvePhotoDisplayUriMap` が担う(`toMapPhotoFromPhotoAsset` と同じ扱い)。
 *
 * @param metadata - `Query.exeForMetadata()` が返した軽量メタデータ。
 * @param location - `Asset.getLocation()` の結果。ジオタグが無い場合はnull。
 * @returns 有効なジオタグがある写真の場合はMapPhoto、ない場合はnull。
 */
export function toMapPhoto(metadata: AssetMetadata, location: Location | null): MapPhoto | null {
  const coordinate = toMapCoordinate(location);

  if (coordinate === null) {
    return null;
  }

  return {
    id: metadata.id,
    // 表示用URIの解決はクラスタの代表写真だけへ絞るため、走査の時点では未解決にしておく
    uri: null,
    storedUri: metadata.id,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    // 撮影日時を持たないアセットは iOS に実在する。表示順の基準として 0(最古扱い)へ倒す
    creationTime: metadata.creationTime ?? 0,
    width: toFiniteSize(metadata.width),
    height: toFiniteSize(metadata.height),
  };
}

/**
 * 走査結果(メタデータ + 位置情報)を `photo_assets` の保存レコードへ変換する。
 *
 * `assetId` と `uri` はどちらも `AssetMetadata.id` である。新APIの `id` は
 * `ph://<localIdentifier>` 形式(`ios/next/objects/asset/Asset.swift`)で、識別子としても
 * 表示用URIの解決元としても安定しているため、両者を分ける理由が無くなった。
 *
 * @param metadata - `Query.exeForMetadata()` が返した軽量メタデータ。
 * @param location - `Asset.getLocation()` の結果。ジオタグが無い場合はnull。
 * @returns 有効なジオタグがある写真の場合は保存レコード、ない場合はnull。
 */
export function toPhotoAssetRecord(metadata: AssetMetadata, location: Location | null): PhotoAssetRecord | null {
  const coordinate = toMapCoordinate(location);

  if (coordinate === null) {
    return null;
  }

  const creationTime = metadata.creationTime;

  return {
    assetId: metadata.id,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    // iOSの PHAsset.creationDate は optional で、取得できないアセットが存在する。
    // 0 や不正値をエポック時刻として保存しないよう null へ倒す
    takenAt: creationTime !== null && Number.isFinite(creationTime) && creationTime > 0 ? new Date(creationTime).toISOString() : null,
    uri: metadata.id,
    width: toFiniteSize(metadata.width),
    height: toFiniteSize(metadata.height),
  };
}

/**
 * `photo_assets` に保存済みのメタデータを地図表示用写真へ変換する。
 *
 * **保存済みデータから `MapPhoto` を組み立てる箇所はここ1つに閉じている。**
 * 保存された安定URI(iOS: `ph://…`)は `storedUri` へ移し、`uri`(表示用URI)は未解決の null にする。
 * `ph://` は**そのままでは `<Image>` で描画できない**(親設計書 §9-2 は検証の結果「できない」で確定した)
 * ため、`uri` にそのまま入れると白紙のマーカーになってしまう。描画できる形への変換は
 * `resolvePhotoDisplayUriMap` が担う。
 *
 * @param record - `photo_assets` から取得したメタデータ。
 * @returns 表示用URI未解決(`uri: null`)の地図表示用写真。
 */
export function toMapPhotoFromPhotoAsset(record: PhotoAssetRecord): MapPhoto {
  const creationTime = record.takenAt === null ? Number.NaN : Date.parse(record.takenAt);

  return {
    id: record.assetId,
    // 表示用URIは未解決。解決はクラスタの代表写真とクラスタを開いた写真だけへ絞る(設計書 §4.8)
    uri: null,
    storedUri: record.uri,
    latitude: record.latitude,
    longitude: record.longitude,
    // 撮影日時を持たないアセットは iOS に実在する。表示順の基準として 0(最古扱い)へ倒す
    creationTime: Number.isNaN(creationTime) ? 0 : creationTime,
    width: record.width,
    height: record.height,
  };
}

/**
 * 表示用URIを解決した写真を返す。
 *
 * 走査結果を `photo_assets` へ保存できなかったときのフォールバック表示にだけ使う。通常の表示経路は
 * ビューポート検索 → クラスタリング → 代表写真だけ解決、という順序で `resolvePhotoDisplayUriMap` を使う。
 *
 * @param photos - 表示用URI未解決の写真。
 * @returns 表示用URIを解決した写真。解決できなかった写真は `uri: null` になる。入力順と件数を保つ。
 */
async function resolveMapPhotoDisplayUris(photos: MapPhoto[]): Promise<MapPhoto[]> {
  return applyResolvedPhotoUris(photos, await resolvePhotoDisplayUriMap(photos));
}

/**
 * 次回の差分走査の基準時刻を更新する。
 *
 * 走査したアセットの最新の撮影日時を基準にする。差分走査はこの時刻以降の写真を対象にするため、
 * ここを進めることで次回の走査が数件〜数十件で済むようになる。
 *
 * **保存に失敗しても走査そのものは成功として扱う**(ログのみ)。基準時刻を進め損ねても、
 * 次回の走査が同じ範囲をもう一度見るだけで、データが壊れることはないため。
 *
 * 計測フラグ(`EXPO_PUBLIC_PHOTO_SCAN_LIMIT`)で上限を掛けている場合、走査は最新N件で打ち切られる。
 * それでも「基準時刻より新しい写真はすべて見た」ことに変わりはないため基準時刻は進めてよいが、
 * 打ち切られた古い範囲は差分走査では拾えない(全件走査でのみ回収される)。
 *
 * @param assets - 今回走査したアセット。
 * @param previousBaselineMs - 今回の走査で使った基準時刻。全件走査の場合はnull。
 * @returns なし。
 */
async function updatePhotoScanBaseline(assets: readonly AssetMetadata[], previousBaselineMs: number | null): Promise<void> {
  const nextBaselineMs = resolveNextPhotoScanBaselineMs(assets, previousBaselineMs);

  if (nextBaselineMs === null || nextBaselineMs === previousBaselineMs) {
    return;
  }

  await savePhotoScanBaselineMs(nextBaselineMs).catch((error: unknown) => {
    console.warn('Failed to save photo scan baseline:', error);
  });
}

/**
 * 表示範囲に含まれるジオタグ付き写真を `photo_assets` から読み込む。
 *
 * 写真ライブラリの走査(重いデコードを伴う)は行わず、保存済みメタデータだけを参照する。
 *
 * **表示用URIの解決はここでは行わない。** 保存されている `ph://` URIは `<Image>` で描画できないが、
 * 解決には1枚ごとにサムネイルの書き出しが伴う。地図に見えるのはクラスタの代表1枚だけなので、
 * 検索結果の全件を解決すると大半が無駄になる。クラスタリングを終えたUI層が、代表写真と
 * 開いたクラスタの写真だけを `resolvePhotoDisplayUriMap` で解決する(設計書 §4.8)。
 *
 * 表示上限(「地図に表示する写真」の設定)は呼び出し側から件数として受け取る。設定の読み込みを
 * ここで行うと、地図のパン・ズームのたびに設定読み込みのDBアクセスが増えるため、
 * 設定を保持しているUI層が解決済みの件数を渡す形にしている。
 *
 * @param bounds - 検索対象の緯度経度境界。
 * @param displayLimit - 表示する写真の上限(全体の最新N件)。上限なしの場合はnull。
 * @returns 範囲内の地図表示用写真。表示用URIは未解決(`uri: null`)。
 */
export async function loadGeotaggedPhotosInBounds(bounds: PhotoViewportBounds, displayLimit: number | null = null): Promise<MapPhoto[]> {
  const records = await getPhotoAssetsInBounds(bounds, { displayLimit });

  return records.map(toMapPhotoFromPhotoAsset);
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
 * 走査は SDK 57 のクラスベース新API(`Query` / `Asset`)で行う。軽量メタデータを1回のクエリで
 * まとめて取り、位置情報だけをアセットごとに取得する二段構えである。
 *
 * 走査コストの内訳は常に計測して返す(理由は `GeotaggedPhotoScanResult.metrics` を参照)。
 *
 * @param options - 走査モード・上限・進捗通知。省略時は上限なしの全件走査。
 * @returns ジオタグ付き写真一覧、キャッシュ保存の成否、走査の計測値、実際に走ったモード。表示用URIの解決状態は `GeotaggedPhotoScanResult` を参照。
 */
export async function loadGeotaggedPhotos({
  mode = 'full',
  limit = resolvePhotoScanLimit(),
  onProgress,
}: PhotoScanOptions = {}): Promise<GeotaggedPhotoScanResult> {
  const startedAtMs = Date.now();

  // 差分走査は前回の基準時刻を起点にする。基準時刻が無い(初回・壊れた値・読み込み失敗)場合は、
  // 差分の起点が無いので全件走査へフォールバックする
  const baselineMs = mode === 'incremental' ? await getPhotoScanBaselineMs() : null;
  const scanMode: PhotoScanMode = mode === 'incremental' && baselineMs !== null ? 'incremental' : 'full';

  let query = new Query().eq(AssetField.MEDIA_TYPE, MediaType.IMAGE).orderBy({ key: AssetField.CREATION_TIME, ascending: false });

  if (scanMode === 'incremental' && baselineMs !== null) {
    // **基準時刻ちょうどの写真も含める(gte)。** `creationTime` は一意なカーソルではなく、
    // バースト撮影では同じ撮影日時の写真が複数枚できる。排他(gt)にすると、基準時刻と同じ撮影日時の
    // 新規写真(前回の走査より後にライブラリへ入ったもの)が差分走査から永久に外れてしまう。
    // 境界の写真を毎回1回だけ見直すコストと引き換えに取りこぼしを無くす。保存はUPSERTなので、
    // 同じ写真を再走査しても副作用は無い(`photoScanWindow.ts` の境界の扱いと同じ考え方)
    query = query.gte(AssetField.CREATION_TIME, baselineMs);
  }

  if (limit !== null) {
    // 新APIに `hasNextPage` は無い。上限より1件多く要求し、その1件が返るかどうかで
    // 「さらに古い写真が残っているか」を判定する(設計書 §4.2)。
    // 上限を掛けないときはこのプロービング自体が不要である(常にライブラリを見切る)
    query = query.limit(limit + 1);
  }

  const probedMetadata = await query.exeForMetadata();

  const metadataDurationMs = Date.now() - startedAtMs;
  const hasNextPage = limit !== null && probedMetadata.length > limit;
  // プロービング用の超過分は走査対象に含めない。含めると保存件数も往復回数も上限を超えてしまう
  const scannedMetadata = hasNextPage && limit !== null ? probedMetadata.slice(0, limit) : probedMetadata;

  // 総数が確定するのはここ。以降は「N件中M件」を出せる
  onProgress?.({ totalAssetCount: scannedMetadata.length, processedAssetCount: 0 });

  // 位置情報だけは `exeForMetadata()` に含まれないため、アセットごとに取得する。
  // `getLocation()` は `phAsset.location` を読むだけでデコードもI/Oも伴わない
  const locationStartedAtMs = Date.now();
  let processedAssetCount = 0;
  const locations = await mapWithConcurrency(scannedMetadata, PHOTO_INFO_CONCURRENCY, async (metadata) => {
    try {
      return await new Asset(metadata.id).getLocation();
    } finally {
      // 失敗したアセットも数える。数えないと進捗が総数へ届かず、終わらないように見える
      processedAssetCount += 1;
      onProgress?.({ totalAssetCount: scannedMetadata.length, processedAssetCount });
    }
  });
  const locationDurationMs = Date.now() - locationStartedAtMs;

  const photos = scannedMetadata.flatMap((metadata, index) => {
    const result = locations[index];

    if (result.status !== 'fulfilled') {
      return [];
    }

    const photo = toMapPhoto(metadata, result.value);
    return photo ? [photo] : [];
  });

  const assetRecords = scannedMetadata.flatMap((metadata, index) => {
    const result = locations[index];

    if (result.status !== 'fulfilled') {
      return [];
    }

    const record = toPhotoAssetRecord(metadata, result.value);
    return record ? [record] : [];
  });

  // 保存フェーズの計測はここから。突き合わせ条件の組み立てと権限参照も保存の一部として含める
  // (2-c で「DB保存が効いてくるのは何件からか」を見るには、UPSERT単体ではなく保存経路全体のコストが要る)
  const saveStartedAtMs = Date.now();

  // 走査済み時間窓との突き合わせ用に、走査したアセットごとの結果を組み立てる。
  // `mapWithConcurrency` は入力順を保つため、`locations[index]` は `scannedMetadata[index]` の結果である。
  const savedAssetIds = new Set(assetRecords.map((record) => record.assetId));
  const outcomes = scannedMetadata.map((metadata, index) => ({
    assetId: metadata.id,
    isInfoResolved: locations[index].status === 'fulfilled',
    isSaved: savedAssetIds.has(metadata.id),
  }));
  // **差分走査は「ライブラリを見切った」扱いにしてはいけない。** 基準時刻より古い範囲は走査して
  // いないため、全期間の突き合わせにすると保存済みの古い写真の行をすべて削除してしまう。
  // 走査していない古い範囲が残っている点は次ページがある場合と同じなので、同じ扱いへ寄せることで
  // 突き合わせ対象を「走査したページ内の最古の撮影日時より新しい範囲」だけに閉じる(設計書 §4.3)
  const hasUnscannedOlderAssets = hasNextPage || scanMode === 'incremental';
  // フルアクセスが無いときは走査結果が「ライブラリの実態」を表さないため、突き合わせ(削除)を丸ごと
  // スキップして保存(UPSERT)だけ行う。理由は `canReconcilePhotoAssets` を参照
  const reconciliation = (await canReconcilePhotoAssets())
    ? createPhotoAssetReconciliation({ assets: scannedMetadata, outcomes, hasNextPage: hasUnscannedOlderAssets })
    : null;

  const isCacheSaved = await savePhotoAssets(assetRecords, reconciliation).then(
    () => true,
    (error: unknown) => {
      console.warn('Failed to save photo assets:', error);

      return false;
    },
  );

  const saveDurationMs = Date.now() - saveStartedAtMs;

  // **保存できたときだけ基準時刻を進める。** 保存に失敗した範囲を走査済みにしてしまうと、
  // 次回以降の差分走査がその範囲を二度と拾わなくなる
  if (isCacheSaved) {
    await updatePhotoScanBaseline(scannedMetadata, baselineMs);
  }

  // 保存できた場合、呼び出し側はビューポート検索へ進みこの配列を使わない。使われるのは保存に失敗した
  // フォールバックのときだけなので、そのときだけ表示用URIを解決する。常に解決すると、表示範囲の外にある
  // 写真ぶんまでサムネイルを書き出すことになり走査のたびに無駄なコストがかかる
  const resolvedPhotos = isCacheSaved ? photos : await resolveMapPhotoDisplayUris(photos);

  const assetInfoFulfilledCount = locations.filter((result) => result.status === 'fulfilled').length;
  const locationRejectedCount = locations.length - assetInfoFulfilledCount;
  const totalDurationMs = Date.now() - startedAtMs;

  // 送信キーは旧API時代から変えない。`assetInfo*` の実体は `getAssetInfoAsync` から `getLocation()` へ
  // 移ったが、「アセットごとの詳細取得が何件成功/失敗したか」という意味は同じであり、
  // 移行前後の値を同じグラフで比較できるようにするため
  reportPhotoMapDiagnostics('load', {
    // 上限なしは0で表す。送信キーの構成を変えずに「上限を掛けていない」ことを示せる
    requestedLimit: limit ?? 0,
    scannedAssetCount: scannedMetadata.length,
    hasNextPage,
    isIncrementalScan: scanMode === 'incremental',
    assetInfoFulfilledCount,
    assetInfoRejectedCount: locationRejectedCount,
    geotaggedPhotoCount: photos.length,
    durationMs: totalDurationMs,
  });

  return {
    photos: resolvedPhotos,
    isCacheSaved,
    mode: scanMode,
    metrics: {
      scannedAssetCount: scannedMetadata.length,
      geotaggedPhotoCount: photos.length,
      locationRejectedCount,
      metadataDurationMs,
      locationDurationMs,
      saveDurationMs,
      totalDurationMs,
    },
  };
}
