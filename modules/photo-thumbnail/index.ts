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
  /**
   * 拡大表示用の高解像度画像を書き出してそのパスを返す。取得できない場合はnull。
   *
   * @param assetId - `ph://<localIdentifier>` 形式のアセットURI。
   * @param size - 要求する画像の一辺のピクセル数。
   */
  getPhotoPreviewAsync: (assetId: string, size: number) => Promise<string | null>;
  /**
   * 写真ライブラリにアセットが存在するかを返す。
   *
   * **旧ビルドのネイティブモジュールには存在しない**ため optional で宣言する。
   * ネイティブとJSの更新タイミングがずれても、呼び出し側が縮退できるようにするため。
   *
   * @param assetId - `ph://<localIdentifier>` 形式のアセットURI。
   */
  isPhotoAssetAvailableAsync?: (assetId: string) => Promise<boolean>;
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

/**
 * 拡大表示用の高解像度画像を取得し、キャッシュディレクトリ上のパスを返す。
 *
 * **この関数だけ iCloud からのダウンロードを許可する**(`isNetworkAccessAllowed = true`)。
 * マーカー用の `getPhotoThumbnailAsync` は従来どおり通信を行わない。地図描画中に通信が走ると
 * 通信量と App Hang の問題が再発するため、ネットワークアクセスは「ユーザーが写真を明示的に
 * タップして拡大表示した」ときだけに限る、というのがこの2関数を分けている理由である。
 *
 * ダウンロードには数秒かかりうるので、呼び出し側は取得を待つ間もサムネイルを表示し続け、
 * 取得できたときにだけ差し替える。
 *
 * **失敗しても例外を投げずnullを返す。** 機内モードや圏外では取得できないのが正常な結果であり、
 * その場合は呼び出し側がサムネイル表示のままにできる。
 *
 * @param assetId - `ph://<localIdentifier>` 形式のアセットURI、またはその `localIdentifier`。
 * @param size - 要求する画像の一辺のピクセル数。
 * @returns 書き出した画像の `file://` パス。取得できない場合はnull。
 */
export async function getPhotoPreviewAsync(assetId: string, size: number): Promise<string | null> {
  if (photoThumbnailModule === null) {
    return null;
  }

  try {
    return await photoThumbnailModule.getPhotoPreviewAsync(assetId, size);
  } catch (error: unknown) {
    console.warn('Failed to get photo preview:', error);

    return null;
  }
}

/**
 * 写真ライブラリにアセットが存在するかを返す。
 *
 * 画像を取得できない原因が「写真ライブラリから削除された」のか「iCloudにあり端末に本体が無い」のかを
 * 区別するために使う。区別せずに「削除されています」と案内すると、オフラインのユーザーへ誤情報を出す
 * ことになる(設計書 §4.5)。iOS 側は `PHAsset.fetchAssets(withLocalIdentifiers:)` の結果が空かどうかを
 * 見るだけで、画像のI/Oもデコードも行わない。
 *
 * **判定できない場合は必ず `true`(存在する)を返す。** モジュールが解決できない環境(Expo Go・jest・
 * Android・旧ビルド)や呼び出しが失敗した場合に「削除された」と誤判定してユーザーへ誤情報を出すより、
 * 案内を出さないほうが安全なためである。
 *
 * @param assetId - `ph://<localIdentifier>` 形式のアセットURI。
 * @returns 存在が確認できた場合と判定できない場合はtrue、削除が確認できた場合のみfalse。
 */
export async function isPhotoAssetAvailableAsync(assetId: string): Promise<boolean> {
  const isAvailableAsync = photoThumbnailModule?.isPhotoAssetAvailableAsync;

  if (isAvailableAsync === undefined) {
    return true;
  }

  try {
    // ネイティブの戻り値が真偽値と限らない前提(issue #160)で、falseと言い切れる場合だけfalseにする
    return (await isAvailableAsync(assetId)) === false ? false : true;
  } catch (error: unknown) {
    console.warn('Failed to check photo asset availability:', error);

    return true;
  }
}
