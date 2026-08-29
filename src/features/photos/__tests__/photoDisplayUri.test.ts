import { getPhotoThumbnailAsync } from '@modules/photo-thumbnail';

import {
  applyResolvedPhotoUris,
  clearPhotoDisplayUriCache,
  PHOTO_THUMBNAIL_SIZE,
  resolvePhotoDisplayUri,
  resolvePhotoDisplayUriMap,
} from '@/features/photos/photoDisplayUri';
import { PHOTO_INFO_CONCURRENCY } from '@/features/photos/photoScanConcurrency';
import type { MapPhoto } from '@/features/photos/photoLibrary';

/**
 * 表示用URI未解決の地図表示用写真を組み立てる。
 *
 * `storedUri` は実機(iOS)と同じく `ph://<localIdentifier>` 形式にする。
 *
 * @param assetId - アセットID。
 * @returns `uri` が未解決(null)の地図表示用写真。
 */
function savedPhoto(assetId: string): MapPhoto {
  return {
    id: assetId,
    uri: null,
    storedUri: `ph://${assetId}`,
    latitude: 35,
    longitude: 139,
    creationTime: Date.parse('2026-08-21T00:00:00.000Z'),
    width: 100,
    height: 80,
  };
}

/**
 * サムネイル取得の挙動を差し替える。
 *
 * @param resolver - `ph://` URIを受け取り、サムネイルのパス(取得できない場合はnull)を返す関数。
 * @returns なし。
 */
function mockPhotoThumbnail(resolver: (uri: string) => Promise<string | null>): void {
  (getPhotoThumbnailAsync as jest.Mock).mockImplementation(resolver);
}

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

describe('表示用URIの一括解決 resolvePhotoDisplayUriMap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearPhotoDisplayUriCache();
    mockPhotoThumbnail(async (uri) => `file:///tmp/${uri.replace('ph://', '')}.jpg`);
  });

  it('storedUriから描画できる表示用URIを解決してassetIdごとに返す', async () => {
    const resolved = await resolvePhotoDisplayUriMap([savedPhoto('asset-1')]);

    // ph:// のままでは <Image> が描画できないため file:// へ解決されている必要がある
    expect(resolved.get('asset-1')).toBe('file:///tmp/asset-1.jpg');
  });

  it('同じ写真を再度解決してもサムネイルの書き出しは1回しか走らない', async () => {
    await resolvePhotoDisplayUriMap([savedPhoto('asset-1')]);
    await resolvePhotoDisplayUriMap([savedPhoto('asset-1')]);

    expect(getPhotoThumbnailAsync).toHaveBeenCalledTimes(1);
  });

  it('サムネイルを取得できなかった写真はnullとして返す', async () => {
    mockPhotoThumbnail(async () => null);

    // 除外すると「マーカーごと消える」ため、画像が無いだけのマーカーとして表示する
    const resolved = await resolvePhotoDisplayUriMap([savedPhoto('asset-1')]);

    expect(resolved.get('asset-1')).toBeNull();
  });

  it('解決が例外で失敗した写真もnullとして返し、他の写真を巻き込まない', async () => {
    mockPhotoThumbnail(async (uri) => {
      if (uri === 'ph://asset-1') {
        throw new Error('asset not found');
      }

      return 'file:///tmp/asset-2.jpg';
    });

    const resolved = await resolvePhotoDisplayUriMap([savedPhoto('asset-1'), savedPhoto('asset-2')]);

    expect(resolved.get('asset-1')).toBeNull();
    expect(resolved.get('asset-2')).toBe('file:///tmp/asset-2.jpg');
  });

  it('解決済みの写真は問い合わせ直さない', async () => {
    await resolvePhotoDisplayUriMap([{ ...savedPhoto('asset-1'), uri: 'file:///tmp/already.jpg' }]);

    expect(getPhotoThumbnailAsync).not.toHaveBeenCalled();
  });

  it('同時実行数がPHOTO_INFO_CONCURRENCYを超えない', async () => {
    const assetCount = 10;
    let runningCount = 0;
    let maxRunningCount = 0;
    mockPhotoThumbnail(async (uri) => {
      runningCount += 1;
      maxRunningCount = Math.max(maxRunningCount, runningCount);
      await new Promise((resolve) => setTimeout(resolve, 5));
      runningCount -= 1;

      return `file:///tmp/${uri.replace('ph://', '')}.jpg`;
    });

    await resolvePhotoDisplayUriMap(Array.from({ length: assetCount }, (_, index) => savedPhoto(`asset-${index}`)));

    expect(maxRunningCount).toBeLessThanOrEqual(PHOTO_INFO_CONCURRENCY);
    expect(getPhotoThumbnailAsync).toHaveBeenCalledTimes(assetCount);
  });
});

describe('解決済み表示用URIの反映 applyResolvedPhotoUris', () => {
  it('解決結果を持つ写真だけ表示用URIを差し替える', () => {
    const photos = [savedPhoto('asset-1'), savedPhoto('asset-2')];

    expect(applyResolvedPhotoUris(photos, new Map([['asset-1', 'file:///tmp/asset-1.jpg']]))).toEqual([
      expect.objectContaining({ id: 'asset-1', uri: 'file:///tmp/asset-1.jpg' }),
      expect.objectContaining({ id: 'asset-2', uri: null }),
    ]);
  });

  it('解決できなかった写真は画像なしのまま残す', () => {
    expect(applyResolvedPhotoUris([savedPhoto('asset-1')], new Map([['asset-1', null]]))).toEqual([
      expect.objectContaining({ id: 'asset-1', uri: null }),
    ]);
  });

  it('解決結果が空なら入力をそのまま返す(不要な再レンダーを避けるため)', () => {
    const photos = [savedPhoto('asset-1')];

    expect(applyResolvedPhotoUris(photos, new Map())).toBe(photos);
  });

  it('解決結果が空でなくても、一致する写真が無ければ入力をそのまま返す', () => {
    const photos = [savedPhoto('asset-1')];

    // 非同期解決の途中で地図を動かすと、解決結果と現在の写真がまったく重ならないことがある。
    // ここで新しい配列を作ると、内容は同じなのに再クラスタリングとマーカー再描画が走る
    expect(applyResolvedPhotoUris(photos, new Map([['asset-999', 'file:///tmp/asset-999.jpg']]))).toBe(photos);
  });

  it('一致する写真がある場合は、差し替えた写真だけ新しいオブジェクトにする', () => {
    const photos = [savedPhoto('asset-1'), savedPhoto('asset-2')];

    const applied = applyResolvedPhotoUris(photos, new Map([['asset-1', 'file:///tmp/asset-1.jpg']]));

    expect(applied).not.toBe(photos);
    expect(applied[1]).toBe(photos[1]);
  });
});
