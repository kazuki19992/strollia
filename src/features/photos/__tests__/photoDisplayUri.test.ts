import { Asset } from 'expo-media-library';

import { clearPhotoDisplayUriCache, resolvePhotoDisplayUri } from '@/features/photos/photoDisplayUri';

// 新API(クラスベース)のモック。`new Asset(uri)` で生成したインスタンスが `getUri()` を持つ形にする。
// 実装は `clearMocks: true` でテストごとに消えるため、各テストの beforeEach で入れ直す。
jest.mock('expo-media-library', () => ({
  Asset: jest.fn(),
}));

/** `new Asset(uri).getUri()` の呼び出し引数を記録しながら、解決結果を返すモックを設定する。 */
function mockAssetUri(resolver: (uri: string) => Promise<string>): void {
  (Asset as unknown as jest.Mock).mockImplementation((uri: string) => ({
    id: uri,
    getUri: () => resolver(uri),
  }));
}

describe('写真の表示用URI解決 photoDisplayUri', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearPhotoDisplayUriCache();
  });

  it('ph://のURIは<Image>で描画できないため、file://の表示用URIへ解決する', async () => {
    mockAssetUri(async () => 'file:///tmp/asset-1.jpg');

    await expect(resolvePhotoDisplayUri('asset-1', 'ph://asset-1')).resolves.toBe('file:///tmp/asset-1.jpg');
    expect(Asset).toHaveBeenCalledWith('ph://asset-1');
  });

  it('同じ写真を2回解決してもネイティブ問い合わせは1回で済む', async () => {
    mockAssetUri(async () => 'file:///tmp/asset-1.jpg');

    await resolvePhotoDisplayUri('asset-1', 'ph://asset-1');
    await resolvePhotoDisplayUri('asset-1', 'ph://asset-1');

    expect(Asset).toHaveBeenCalledTimes(1);
  });

  it('ph://以外のURI(Androidのfile://など)はそのまま返し、ネイティブへ問い合わせない', async () => {
    mockAssetUri(async () => 'file:///resolved.jpg');

    await expect(resolvePhotoDisplayUri('asset-1', 'file:///storage/emulated/0/DCIM/asset-1.jpg')).resolves.toBe(
      'file:///storage/emulated/0/DCIM/asset-1.jpg',
    );
    expect(Asset).not.toHaveBeenCalled();
  });

  it('解決に失敗した場合はrejectし、失敗をキャッシュしないので次回は再試行する', async () => {
    mockAssetUri(async () => {
      throw new Error('asset not found');
    });

    await expect(resolvePhotoDisplayUri('asset-1', 'ph://asset-1')).rejects.toThrow('asset not found');

    mockAssetUri(async () => 'file:///tmp/asset-1.jpg');

    await expect(resolvePhotoDisplayUri('asset-1', 'ph://asset-1')).resolves.toBe('file:///tmp/asset-1.jpg');
  });

  it('キャッシュを消すと再びネイティブへ問い合わせる', async () => {
    mockAssetUri(async () => 'file:///tmp/asset-1.jpg');

    await resolvePhotoDisplayUri('asset-1', 'ph://asset-1');
    clearPhotoDisplayUriCache();
    await resolvePhotoDisplayUri('asset-1', 'ph://asset-1');

    expect(Asset).toHaveBeenCalledTimes(2);
  });
});
