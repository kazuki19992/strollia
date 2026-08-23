import { requireOptionalNativeModule } from 'expo';

/** ネイティブ側(`PhotoThumbnailModule.swift`)が公開する関数の形。 */
type PhotoThumbnailNativeModule = {
  /**
   * サムネイルを書き出してそのパスを返す。取得できない場合はnull。
   *
   * @param assetId - `ph://<localIdentifier>` 形式のアセットURI。
   * @param size - 要求するサムネイルの一辺のピクセル数。
   */
  getPhotoThumbnailAsync: (assetId: string, size: number) => Promise<string | null>;
};

/**
 * ネイティブモジュール本体。解決できない場合はnullになる。
 *
 * **`requireNativeModule` ではなく `requireOptionalNativeModule` を使う。**
 * Expo Go・jest・万一のビルド不整合などモジュールが組み込まれていない環境では前者が
 * import 時に例外を投げ、写真機能どころかアプリ全体が起動できなくなる。
 * 本モジュールは「サムネイルが取れなければ画像なしで表示する」という縮退が
 * 成立している(設計書 §5.2)ため、解決できないことを致命的な失敗として扱わない。
 */
const photoThumbnailModule = requireOptionalNativeModule<PhotoThumbnailNativeModule>('PhotoThumbnail');

/**
 * 写真ライブラリのアセットからサムネイルを取得し、キャッシュディレクトリ上のパスを返す。
 *
 * iOS の `PHImageManager.requestImage` を使う。**iCloud へのネットワークアクセスは行わない**ため、
 * 「iPhoneのストレージを最適化」でオリジナルが端末から退避された写真でも、ローカルに残っている
 * サムネイルを返せる(オリジナル本体を要求する `getUri()` 等はこの状況で失敗する)。
 *
 * **失敗しても例外を投げずnullを返す。** 呼び出し側は「その写真は画像なしで扱う」と判断でき、
 * 1枚の解決失敗が写真表示全体を巻き込まない。
 *
 * Android向けの実装は持たない。Android の `photo_assets` には `file://` が入っており
 * `<Image>` でそのまま描画できるため、呼び出し側が `ph://` 以外を素通しする(設計書 §3.1)。
 *
 * @param assetId - `ph://<localIdentifier>` 形式のアセットURI。
 * @param size - 要求するサムネイルの一辺のピクセル数。
 * @returns 生成したサムネイルの `file://` パス。取得できない場合はnull。
 */
export async function getPhotoThumbnailAsync(assetId: string, size: number): Promise<string | null> {
  if (photoThumbnailModule === null) {
    return null;
  }

  try {
    return await photoThumbnailModule.getPhotoThumbnailAsync(assetId, size);
  } catch (error: unknown) {
    console.warn('Failed to get photo thumbnail:', error);

    return null;
  }
}
