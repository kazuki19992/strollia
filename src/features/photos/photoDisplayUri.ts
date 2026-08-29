import { getPhotoThumbnailAsync } from '@modules/photo-thumbnail';

import { PHOTO_INFO_CONCURRENCY } from '@/features/photos/photoScanConcurrency';
import { mapWithConcurrency } from '@/utils/concurrency';
import type { MapPhoto } from '@/features/photos/photoLibrary';

/**
 * iOSのフォトライブラリURIの接頭辞。
 *
 * `photo_assets` にはこの形式(`ph://<localIdentifier>`)の**安定した**URIを保存している。
 * 安定している代わりに、このURIは `<Image>` では描画できない(理由は `resolvePhotoDisplayUri` を参照)。
 */
const PHOTO_LIBRARY_URI_SCHEME = 'ph://';

/**
 * 要求するサムネイルの一辺のピクセル数。
 *
 * 用途は地図上のマーカー(最大52pt)と、タップしたときの拡大表示である。マーカーだけなら
 * 数百pxで足り、大きくするほど書き出しコストとキャッシュ容量が増える。一方で小さすぎると
 * 拡大表示が粗くなるため、その中間としてこの値を採る。
 */
export const PHOTO_THUMBNAIL_SIZE = 512;

/**
 * アセットID → 表示用URI のメモリキャッシュ。
 *
 * **永続化してはいけない。** ここに入るのはキャッシュディレクトリ上のサムネイルのパスで、
 * OSは容量が逼迫したときにこのディレクトリを消してよいことになっている。DBへ保存すると、
 * 次回起動時に存在しないパスを `<Image>` へ渡して再び白紙になる。セッション内に閉じた
 * キャッシュにとどめることで、「安定した識別子はDBへ、揮発する表示用パスはメモリへ」という
 * 役割分担を保つ。
 *
 * 地図のパン・ズームのたびにビューポート検索が走るため、同じ写真の解決を繰り返さないことが目的。
 */
const displayUriCache = new Map<string, string>();

/**
 * 保存済みURIから、`<Image>` で実際に描画できる表示用URIを解決する。
 *
 * **なぜ解決が要るのか**: React Native 0.86 には `RCTPhotoLibraryImageLoader` が存在せず
 * (`RCTImageLoader.mm` のコメント内で言及されているだけ)、`<Image source={{ uri: 'ph://…' }} />` は
 * 何も描画しない。マーカーの位置とクラスタ数は正しいのに画像だけが白紙になる不具合の原因がこれである。
 *
 * **なぜサムネイル取得なのか**: `expo-media-library` の `Asset.getUri()` も `expo-file-system` の
 * `ph://` コピーも、内部では**オリジナル本体**を要求する。「iPhoneのストレージを最適化」で
 * オリジナルが iCloud へ退避された写真ではこれらが軒並み失敗し、地図上の写真が1枚も出なくなる。
 * `PHImageManager.requestImage` はオリジナルが端末に無くてもローカルのサムネイルを返せるため、
 * ローカルモジュール `@modules/photo-thumbnail` 経由でそちらを使う(設計書 §2)。
 *
 * `ph://` 以外のURI(Androidの `file://`)はそのまま `<Image>` で描画できるため、
 * **問い合わせずにそのまま返す**。
 *
 * **取得できない場合は例外を投げずnullを返す。** 呼び出し側はその写真を除外せず「画像なしの
 * マーカー」として扱う(設計書 §5.2)。解決失敗を除外に倒すと、全件失敗する環境で地図から
 * 写真マーカーが丸ごと消えてしまうためである。失敗はキャッシュしないので、次回の読み込みで再試行される。
 *
 * @param assetId - 写真ライブラリ上のアセットID。キャッシュのキーに使う。
 * @param storedUri - `photo_assets` に保存した安定URI。
 * @returns `<Image>` へ渡せる表示用URI。取得できない場合はnull。
 */
export async function resolvePhotoDisplayUri(assetId: string, storedUri: string): Promise<string | null> {
  if (!storedUri.startsWith(PHOTO_LIBRARY_URI_SCHEME)) {
    return storedUri;
  }

  const cached = displayUriCache.get(assetId);
  if (cached !== undefined) {
    return cached;
  }

  const thumbnailUri = await getPhotoThumbnailAsync(storedUri, PHOTO_THUMBNAIL_SIZE);
  if (thumbnailUri === null) {
    return null;
  }

  displayUriCache.set(assetId, thumbnailUri);

  return thumbnailUri;
}

/**
 * 表示用URIのメモリキャッシュを空にする。
 *
 * 解決結果はセッション内でのみ有効な一時パスなので、写真ライブラリを取り直す場面
 * (テストのケース間分離や、将来の手動再スキャン導線)ではここから捨てる。
 *
 * @returns なし。
 */
export function clearPhotoDisplayUriCache(): void {
  displayUriCache.clear();
}

/**
 * 保存済みの安定URI(`storedUri`)から、`<Image>` で描画できる表示用URIを解決する。
 *
 * **呼び出し側は「地図に実際に出る写真」だけを渡すこと。** 解決1件につきネイティブ側でサムネイルの
 * デコードとJPEGの書き出しが走る。地図に見えるのはクラスタの代表1枚だけなので、`+187` のクラスタで
 * 188枚ぶん解決するのは丸ごと無駄になる(設計書 §4.8)。
 *
 * **解決できなかった写真もキーは残し、値を `null` にして返す。** かつては除外していたが、
 * 「iPhoneのストレージを最適化」が有効な端末では解決が全件失敗し、地図から写真マーカーが
 * 丸ごと消えるという最悪の症状になった。画像が無いだけのマーカーとして描画すれば、
 * 少なくとも「そこに写真がある」ことは伝わる(設計書 §5.2)。失敗はキャッシュされないため、
 * 次回の読み込みで画像つきへ復帰できる。
 *
 * 解決を一斉並列で発行しないよう、写真ライブラリへの他の問い合わせと同じ上限で絞る。
 *
 * @param photos - 解決対象の写真。`uri` が解決済みの写真は問い合わせない。
 * @returns アセットID → 表示用URI の対応。解決できなかった写真の値はnull。
 */
export async function resolvePhotoDisplayUriMap(photos: readonly MapPhoto[]): Promise<Map<string, string | null>> {
  // 解決済みの写真をもう一度書き出させない。同じ写真が複数回要求されても1回に畳む
  const pendingPhotos = [...new Map(photos.filter((photo) => photo.uri === null).map((photo) => [photo.id, photo])).values()];
  const resolvedUris = await mapWithConcurrency(pendingPhotos, PHOTO_INFO_CONCURRENCY, (photo) =>
    resolvePhotoDisplayUri(photo.id, photo.storedUri),
  );

  return new Map(
    pendingPhotos.map((photo, index) => {
      const result = resolvedUris[index];

      // 解決処理は本来nullを返して失敗を伝えるが、想定外の例外でも写真を落とさないよう
      // rejected も「画像なし」として扱う
      return [photo.id, result.status === 'fulfilled' ? result.value : null];
    }),
  );
}

/**
 * 解決済みの表示用URIを写真へ反映する。
 *
 * 対応が無い写真は入力のまま残す(未解決なら未解決のまま)。解決結果が空のときは**入力配列の参照を
 * そのまま返す**。地図のクラスタは参照の同一性でメモ化しているため、内容が変わらないのに新しい配列を
 * 作ると不要な再クラスタリング・再描画を招く。
 *
 * @param photos - 反映対象の写真。
 * @param resolvedUris - アセットID → 表示用URI の対応。
 * @returns 表示用URIを反映した写真。反映する対応が無い場合は入力そのもの。
 */
export function applyResolvedPhotoUris(photos: readonly MapPhoto[], resolvedUris: ReadonlyMap<string, string | null>): MapPhoto[] {
  if (resolvedUris.size === 0) {
    return photos as MapPhoto[];
  }

  return photos.map((photo) => (resolvedUris.has(photo.id) ? { ...photo, uri: resolvedUris.get(photo.id) ?? null } : photo));
}
