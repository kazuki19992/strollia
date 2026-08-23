// expo-media-library のルート(SDK 57のクラスベース新API)は、ネイティブモジュールが公開するクラスを
// `class Asset extends ExpoMediaLibraryNext.Asset` の形で継承している。jest 環境ではネイティブモジュールが
// 読み込めず継承元が undefined になり、import しただけで `Super expression must either be null or a function`
// で落ちる。写真の表示用URI解決(photoDisplayUri.ts)が透過的に import されるだけのテストでも巻き込まれるため、
// ルートに手動モックを置いて既定のスタブとする(node_modules のパッケージは jest.mock 呼び出し不要で適用される)。
//
// 解決結果そのものを検証するテストは、各テストファイルで jest.mock('expo-media-library', ...) により上書きする。

/** `Asset` クラスの最小スタブ。表示用URIとしてIDをそのまま返す。 */
class Asset {
  /**
   * @param {string} id - `ph://<localIdentifier>` 形式のアセットID。
   */
  constructor(id) {
    this.id = id;
  }

  /**
   * @returns {Promise<string>} 表示用URI。スタブではIDをそのまま返す。
   */
  async getUri() {
    return this.id;
  }
}

module.exports = {
  Asset,
};
