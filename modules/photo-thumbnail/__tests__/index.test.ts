import { requireOptionalNativeModule } from 'expo';

import type { getPhotoThumbnailAsync as GetPhotoThumbnailAsync } from '@modules/photo-thumbnail';

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
 * @returns 読み込み直した `getPhotoThumbnailAsync`。
 */
function loadModule(nativeModule: unknown): typeof GetPhotoThumbnailAsync {
  (requireOptionalNativeModule as jest.Mock).mockReturnValue(nativeModule);

  let loaded: typeof GetPhotoThumbnailAsync | null = null;
  jest.isolateModules(() => {
    loaded = (require('@modules/photo-thumbnail') as typeof import('@modules/photo-thumbnail')).getPhotoThumbnailAsync;
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
    const getPhotoThumbnailAsync = loadModule({ getPhotoThumbnailAsync: nativeGetPhotoThumbnailAsync });

    await expect(getPhotoThumbnailAsync('ph://asset-1', 512)).resolves.toBe('file:///caches/asset-1-512.jpg');
    expect(nativeGetPhotoThumbnailAsync).toHaveBeenCalledWith('ph://asset-1', 512);
  });

  it('サムネイルを取得できなかった場合はnullを返す', async () => {
    const getPhotoThumbnailAsync = loadModule({ getPhotoThumbnailAsync: jest.fn().mockResolvedValue(null) });

    await expect(getPhotoThumbnailAsync('ph://asset-1', 512)).resolves.toBeNull();
  });

  it('モジュールが解決できない環境(Expo Go・テスト・ビルド不整合)でも落ちずにnullを返す', async () => {
    const getPhotoThumbnailAsync = loadModule(null);

    await expect(getPhotoThumbnailAsync('ph://asset-1', 512)).resolves.toBeNull();
    expect(requireOptionalNativeModule).toHaveBeenCalledWith('PhotoThumbnail');
  });

  it('ネイティブ呼び出しが例外を投げても、呼び出し側へ伝播させずnullを返す', async () => {
    // 失敗時の console.warn はテスト出力を汚すだけなので握りつぶす
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const getPhotoThumbnailAsync = loadModule({
      getPhotoThumbnailAsync: jest.fn().mockRejectedValue(new Error('asset not found')),
    });

    await expect(getPhotoThumbnailAsync('ph://asset-1', 512)).resolves.toBeNull();
  });
});
