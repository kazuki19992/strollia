// expo-media-library のルート(SDK 57のクラスベース新API)は、ネイティブモジュールが公開するクラスを
// `class Asset extends ExpoMediaLibraryNext.Asset` の形で継承している。jest 環境ではネイティブモジュールが
// 読み込めず継承元が undefined になり、import しただけで `Super expression must either be null or a function`
// で落ちる。写真ライブラリの走査(photoLibrary.ts)が透過的に import されるだけのテストでも巻き込まれるため、
// ルートに手動モックを置いて既定のスタブとする(node_modules のパッケージは jest.mock 呼び出し不要で適用される)。
//
// 既定スタブは「写真ライブラリが空」「権限なし」を返す。走査結果や権限そのものを検証するテストは、
// 各テストファイルで jest.mock('expo-media-library', ...) により上書きする。

/** `Asset` クラスの最小スタブ。 */
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

  /**
   * @returns {Promise<{ latitude: number, longitude: number } | null>} 撮影位置。既定ではジオタグなし。
   */
  async getLocation() {
    return null;
  }
}

/**
 * `Query` のビルダー最小スタブ。
 *
 * 実装(`src/types/Query.ts`)と同じく、絞り込み・並び順・件数指定はいずれも同期でチェーン可能な
 * メソッドとして自分自身を返す。実行系(`exe` / `exeForMetadata`)だけが非同期になる。
 */
class Query {
  /** @returns {Query} チェーン用に自分自身。 */
  eq() {
    return this;
  }

  /** @returns {Query} チェーン用に自分自身。 */
  within() {
    return this;
  }

  /** @returns {Query} チェーン用に自分自身。 */
  gt() {
    return this;
  }

  /** @returns {Query} チェーン用に自分自身。 */
  gte() {
    return this;
  }

  /** @returns {Query} チェーン用に自分自身。 */
  lt() {
    return this;
  }

  /** @returns {Query} チェーン用に自分自身。 */
  lte() {
    return this;
  }

  /** @returns {Query} チェーン用に自分自身。 */
  limit() {
    return this;
  }

  /** @returns {Query} チェーン用に自分自身。 */
  offset() {
    return this;
  }

  /** @returns {Query} チェーン用に自分自身。 */
  album() {
    return this;
  }

  /** @returns {Query} チェーン用に自分自身。 */
  orderBy() {
    return this;
  }

  /** @returns {Promise<Asset[]>} 既定では空のライブラリ。 */
  async exe() {
    return [];
  }

  /** @returns {Promise<object[]>} 既定では空のライブラリ。 */
  async exeForMetadata() {
    return [];
  }
}

/** `AssetField` 列挙。実装(`src/types/AssetField.ts`)と同じ実値にする。 */
const AssetField = {
  CREATION_TIME: 'creationTime',
  MODIFICATION_TIME: 'modificationTime',
  MEDIA_TYPE: 'mediaType',
  WIDTH: 'width',
  HEIGHT: 'height',
  DURATION: 'duration',
  IS_FAVORITE: 'isFavorite',
};

/** `MediaType` 列挙。実装(`src/types/MediaType.ts`)と同じ実値にする。 */
const MediaType = {
  UNKNOWN: 'unknown',
  IMAGE: 'image',
  AUDIO: 'audio',
  VIDEO: 'video',
};

/** 権限が未許可の既定レスポンス。安全側(走査済み窓の突き合わせを行わない側)に倒している。 */
const deniedPermission = {
  granted: false,
  accessPrivileges: 'none',
  canAskAgain: true,
  expires: 'never',
  status: 'undetermined',
};

/**
 * @returns {Promise<typeof deniedPermission>} 既定では未許可。
 */
async function getPermissionsAsync() {
  return deniedPermission;
}

/**
 * @returns {Promise<typeof deniedPermission>} 既定では未許可。
 */
async function requestPermissionsAsync() {
  return deniedPermission;
}

module.exports = {
  Asset,
  AssetField,
  MediaType,
  Query,
  getPermissionsAsync,
  requestPermissionsAsync,
};
