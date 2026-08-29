import { requireOptionalNativeModule } from 'expo';

jest.mock('expo', () => ({
  requireOptionalNativeModule: jest.fn(),
}));

/**
 * ネイティブモジュールの解決結果を差し替えたうえで、公開APIを読み込み直す。
 *
 * `requireOptionalNativeModule` はモジュールの読み込み時に1度だけ評価されるため、
 * 解決できる場合とできない場合を作り分けるにはモジュールキャッシュごと捨てる必要がある。
 *
 * @param nativeModule - `requireOptionalNativeModule` が返す値。未解決を再現する場合はnull。
 * @returns 読み込み直した `@modules/photo-thumbnail` の公開API。
 */
function loadModule(nativeModule: unknown): typeof import('@modules/photo-thumbnail') {
  (requireOptionalNativeModule as jest.Mock).mockReturnValue(nativeModule);

  let loaded: typeof import('@modules/photo-thumbnail') | null = null;
  jest.isolateModules(() => {
    loaded = require('@modules/photo-thumbnail') as typeof import('@modules/photo-thumbnail');
  });

  if (loaded === null) {
    throw new Error('failed to load @modules/photo-thumbnail');
  }

  return loaded;
}

describe('写真サムネイル取得モジュール photo-thumbnail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ネイティブモジュールが返したサムネイルのパスをそのまま返す', async () => {
    const nativeGetPhotoThumbnailAsync = jest.fn().mockResolvedValue('file:///caches/asset-1-512.jpg');
    const { getPhotoThumbnailAsync } = loadModule({ getPhotoThumbnailAsync: nativeGetPhotoThumbnailAsync });

    await expect(getPhotoThumbnailAsync('ph://asset-1', 512)).resolves.toBe('file:///caches/asset-1-512.jpg');
    expect(nativeGetPhotoThumbnailAsync).toHaveBeenCalledWith('ph://asset-1', 512);
  });

  it('サムネイルを取得できなかった場合はnullを返す', async () => {
    const { getPhotoThumbnailAsync } = loadModule({ getPhotoThumbnailAsync: jest.fn().mockResolvedValue(null) });

    await expect(getPhotoThumbnailAsync('ph://asset-1', 512)).resolves.toBeNull();
  });

  it('モジュールが解決できない環境(Expo Go・テスト・ビルド不整合)でも落ちずにnullを返す', async () => {
    const { getPhotoThumbnailAsync } = loadModule(null);

    await expect(getPhotoThumbnailAsync('ph://asset-1', 512)).resolves.toBeNull();
    expect(requireOptionalNativeModule).toHaveBeenCalledWith('PhotoThumbnail');
  });

  it('ネイティブ呼び出しが例外を投げても、呼び出し側へ伝播させずnullを返す', async () => {
    // 失敗時の console.warn はテスト出力を汚すだけなので握りつぶす
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { getPhotoThumbnailAsync } = loadModule({
      getPhotoThumbnailAsync: jest.fn().mockRejectedValue(new Error('asset not found')),
    });

    await expect(getPhotoThumbnailAsync('ph://asset-1', 512)).resolves.toBeNull();
  });
});

describe('高解像度写真取得 getPhotoPreviewAsync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ネイティブモジュールが返した高解像度画像のパスをそのまま返す', async () => {
    const nativeGetPhotoPreviewAsync = jest.fn().mockResolvedValue('file:///caches/asset-1-2796.jpg');
    const { getPhotoPreviewAsync } = loadModule({ getPhotoPreviewAsync: nativeGetPhotoPreviewAsync });

    await expect(getPhotoPreviewAsync('ph://asset-1', 2796)).resolves.toBe('file:///caches/asset-1-2796.jpg');
    expect(nativeGetPhotoPreviewAsync).toHaveBeenCalledWith('ph://asset-1', 2796);
  });

  it('取得できなかった場合(オフラインでiCloudから落とせない等)はnullを返す', async () => {
    const { getPhotoPreviewAsync } = loadModule({ getPhotoPreviewAsync: jest.fn().mockResolvedValue(null) });

    await expect(getPhotoPreviewAsync('ph://asset-1', 2796)).resolves.toBeNull();
  });

  it('モジュールが解決できない環境(Expo Go・テスト・Android)でも落ちずにnullを返す', async () => {
    const { getPhotoPreviewAsync } = loadModule(null);

    await expect(getPhotoPreviewAsync('ph://asset-1', 2796)).resolves.toBeNull();
  });

  it('ネイティブ呼び出しが例外を投げても、呼び出し側へ伝播させずnullを返す', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { getPhotoPreviewAsync } = loadModule({
      getPhotoPreviewAsync: jest.fn().mockRejectedValue(new Error('download failed')),
    });

    await expect(getPhotoPreviewAsync('ph://asset-1', 2796)).resolves.toBeNull();
  });
});

describe('アセット存在確認 isPhotoAssetAvailableAsync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ライブラリに存在する場合はtrueを返す', async () => {
    const nativeIsPhotoAssetAvailableAsync = jest.fn().mockResolvedValue(true);
    const { isPhotoAssetAvailableAsync } = loadModule({ isPhotoAssetAvailableAsync: nativeIsPhotoAssetAvailableAsync });

    await expect(isPhotoAssetAvailableAsync('ph://asset-1')).resolves.toBe(true);
    expect(nativeIsPhotoAssetAvailableAsync).toHaveBeenCalledWith('ph://asset-1');
  });

  it('ライブラリから削除されている場合はfalseを返す', async () => {
    const { isPhotoAssetAvailableAsync } = loadModule({ isPhotoAssetAvailableAsync: jest.fn().mockResolvedValue(false) });

    await expect(isPhotoAssetAvailableAsync('ph://asset-1')).resolves.toBe(false);
  });

  it('モジュールが解決できない環境(Expo Go・テスト・Android)では存在する扱い(true)にする', async () => {
    const { isPhotoAssetAvailableAsync } = loadModule(null);

    // 確認できないことを「削除された」と誤判定すると、オフラインのユーザーへ誤情報を出してしまう
    await expect(isPhotoAssetAvailableAsync('ph://asset-1')).resolves.toBe(true);
  });

  it('ネイティブ呼び出しが例外を投げた場合も存在する扱い(true)にする', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { isPhotoAssetAvailableAsync } = loadModule({
      isPhotoAssetAvailableAsync: jest.fn().mockRejectedValue(new Error('photo library unavailable')),
    });

    await expect(isPhotoAssetAvailableAsync('ph://asset-1')).resolves.toBe(true);
  });

  it('関数を持たない旧ビルドのネイティブモジュールでも落ちずに存在する扱い(true)にする', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { isPhotoAssetAvailableAsync } = loadModule({ getPhotoThumbnailAsync: jest.fn() });

    await expect(isPhotoAssetAvailableAsync('ph://asset-1')).resolves.toBe(true);
  });

  it('真偽値以外が返ってきた場合も存在する扱い(true)にする', async () => {
    const { isPhotoAssetAvailableAsync } = loadModule({ isPhotoAssetAvailableAsync: jest.fn().mockResolvedValue(undefined) });

    // ネイティブとJSの型宣言が食い違いうる前提(issue #160)で、falseと言い切れない値は存在扱いにする
    await expect(isPhotoAssetAvailableAsync('ph://asset-1')).resolves.toBe(true);
  });
});
