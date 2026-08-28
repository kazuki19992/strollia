import { getPhotoThumbnailAsync } from '@modules/photo-thumbnail';

import { clearPhotoDisplayUriCache, PHOTO_THUMBNAIL_SIZE, resolvePhotoDisplayUri } from '@/features/photos/photoDisplayUri';

// ネイティブモジュールは jest では解決できないため、公開APIごとモックする。
// モジュール未解決時に null を返すこと自体は modules/photo-thumbnail 側のテストで担保している
jest.mock('@modules/photo-thumbnail', () => ({
  getPhotoThumbnailAsync: jest.fn(),
}));

describe('写真の表示用URI解決 photoDisplayUri', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearPhotoDisplayUriCache();
  });

  it('ph://のURIは<Image>で描画できないため、サムネイルのfile://パスへ解決する', async () => {
    (getPhotoThumbnailAsync as jest.Mock).mockResolvedValue('file:///caches/asset-1.jpg');

    await expect(resolvePhotoDisplayUri('asset-1', 'ph://asset-1')).resolves.toBe('file:///caches/asset-1.jpg');
    expect(getPhotoThumbnailAsync).toHaveBeenCalledWith('ph://asset-1', PHOTO_THUMBNAIL_SIZE);
  });

  it('同じ写真を2回解決してもネイティブ問い合わせは1回で済む', async () => {
    (getPhotoThumbnailAsync as jest.Mock).mockResolvedValue('file:///caches/asset-1.jpg');

    await resolvePhotoDisplayUri('asset-1', 'ph://asset-1');
    await resolvePhotoDisplayUri('asset-1', 'ph://asset-1');

    expect(getPhotoThumbnailAsync).toHaveBeenCalledTimes(1);
  });

  it('ph://以外のURI(Androidのfile://など)はそのまま返し、ネイティブへ問い合わせない', async () => {
    (getPhotoThumbnailAsync as jest.Mock).mockResolvedValue('file:///caches/asset-1.jpg');

    await expect(resolvePhotoDisplayUri('asset-1', 'file:///storage/emulated/0/DCIM/asset-1.jpg')).resolves.toBe(
      'file:///storage/emulated/0/DCIM/asset-1.jpg',
    );
    expect(getPhotoThumbnailAsync).not.toHaveBeenCalled();
  });

  it('サムネイルを取得できない場合は例外を投げずnullを返す', async () => {
    (getPhotoThumbnailAsync as jest.Mock).mockResolvedValue(null);

    await expect(resolvePhotoDisplayUri('asset-1', 'ph://asset-1')).resolves.toBeNull();
  });

  it('取得できなかった結果はキャッシュせず、次回の読み込みで再試行する', async () => {
    (getPhotoThumbnailAsync as jest.Mock).mockResolvedValue(null);

    await expect(resolvePhotoDisplayUri('asset-1', 'ph://asset-1')).resolves.toBeNull();

    (getPhotoThumbnailAsync as jest.Mock).mockResolvedValue('file:///caches/asset-1.jpg');

    await expect(resolvePhotoDisplayUri('asset-1', 'ph://asset-1')).resolves.toBe('file:///caches/asset-1.jpg');
    expect(getPhotoThumbnailAsync).toHaveBeenCalledTimes(2);
  });

  it('キャッシュを消すと再びネイティブへ問い合わせる', async () => {
    (getPhotoThumbnailAsync as jest.Mock).mockResolvedValue('file:///caches/asset-1.jpg');

    await resolvePhotoDisplayUri('asset-1', 'ph://asset-1');
    clearPhotoDisplayUriCache();
    await resolvePhotoDisplayUri('asset-1', 'ph://asset-1');

    expect(getPhotoThumbnailAsync).toHaveBeenCalledTimes(2);
  });
});
