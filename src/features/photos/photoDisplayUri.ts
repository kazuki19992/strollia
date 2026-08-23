import { Asset } from 'expo-media-library';

/**
 * iOSのフォトライブラリURIの接頭辞。
 *
 * `photo_assets` にはこの形式(`ph://<localIdentifier>`)の**安定した**URIを保存している。
 * 安定している代わりに、このURIは `<Image>` では描画できない(理由は `resolvePhotoDisplayUri` を参照)。
 */
const PHOTO_LIBRARY_URI_SCHEME = 'ph://';

/**
 * アセットID → 表示用URI のメモリキャッシュ。
 *
 * **永続化してはいけない。** ここに入るのは `requestContentEditingInput` が返す一時ファイルのパスで、
 * アプリ再起動をまたいで有効である保証がない(親設計書 §4.2)。DBへ保存すると、次回起動時に
 * 存在しないパスを `<Image>` へ渡して再び白紙になる。セッション内に閉じたキャッシュにとどめることで、
 * 「安定した識別子はDBへ、揮発する表示用パスはメモリへ」という役割分担を保つ。
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
 * **なぜ新API(`Asset` クラス)なのか**: 旧APIの `getAssetInfoAsync` は `requestContentEditingInput` に
 * 加えて `CIImage(contentsOf:)` でフル解像度デコードを行い、これが App Hang の原因だった。
 * 新APIの `getUri()` は `UriExtractor` 経由で `requestContentEditingInput` の `fullSizeImageURL` を
 * 読むだけで、デコードは行わない(デコードを伴うのは `getExif()` のみ)。
 *
 * `ph://` 以外のURI(Androidの `file://`)はそのまま `<Image>` で描画できるうえ、Androidの新API
 * `Asset` は `contentUri` を前提とするため、**問い合わせずにそのまま返す**。
 *
 * 失敗は握りつぶさず reject する。呼び出し側が「その写真だけ表示しない」と判断できるようにするためで、
 * 失敗はキャッシュしないので次回の読み込みで再試行される(写真の一時的な取り込み中などから復帰できる)。
 *
 * @param assetId - 写真ライブラリ上のアセットID。キャッシュのキーに使う。
 * @param storedUri - `photo_assets` に保存した安定URI。
 * @returns `<Image>` へ渡せる表示用URI。
 */
export async function resolvePhotoDisplayUri(assetId: string, storedUri: string): Promise<string> {
  if (!storedUri.startsWith(PHOTO_LIBRARY_URI_SCHEME)) {
    return storedUri;
  }

  const cached = displayUriCache.get(assetId);
  if (cached !== undefined) {
    return cached;
  }

  const resolvedUri = await new Asset(storedUri).getUri();
  displayUriCache.set(assetId, resolvedUri);

  return resolvedUri;
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
