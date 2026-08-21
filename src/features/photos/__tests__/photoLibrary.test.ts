import * as MediaLibrary from 'expo-media-library/legacy';

import { reportPhotoMapDiagnostics } from '@/config/sentry';
import { hasFullPhotoAccess, loadGeotaggedPhotos, toMapPhoto, PHOTO_INFO_CONCURRENCY } from '@/features/photos/photoLibrary';

jest.mock('@/config/sentry', () => ({
  reportPhotoMapDiagnostics: jest.fn(),
}));

jest.mock('expo-media-library/legacy', () => ({
  getAssetsAsync: jest.fn(),
  getAssetInfoAsync: jest.fn(),
  MediaType: { photo: 'photo' },
  SortBy: { creationTime: 'creationTime' },
}));

/**
 * テスト用アセットの位置情報。
 *
 * expo-media-libraryの型定義は`number`を宣言しているが、iOSのネイティブ実装は緯度経度を
 * 文字列で返す(Androidは数値)。実機で起きる形をそのまま再現できるよう、テストでは
 * `number | string` のどちらも渡せるようにしている。
 */
type TestAssetLocation = { latitude: number | string; longitude: number | string };

/**
 * テスト用の写真アセット詳細を作る。
 *
 * @param id - アセットID。
 * @param location - 写真の位置情報。iOS実機を模す場合は文字列を渡す。
 * @returns MediaLibrary.AssetInfo相当のテストデータ。
 */
function createAssetInfo(id: string, location?: TestAssetLocation): MediaLibrary.AssetInfo {
  return {
    id,
    uri: `ph://${id}`,
    localUri: `file:///${id}.jpg`,
    mediaType: 'photo',
    width: 100,
    height: 80,
    creationTime: 1,
    modificationTime: 2,
    duration: 0,
    filename: `${id}.jpg`,
    location,
  } as unknown as MediaLibrary.AssetInfo;
}

describe('写真ライブラリ権限 hasFullPhotoAccess', () => {
  it('フルアクセスが許可されている場合はtrueを返す', () => {
    expect(hasFullPhotoAccess({ granted: true, accessPrivileges: 'all' } as MediaLibrary.PermissionResponse)).toBe(true);
  });

  it('限定アクセスや拒否状態の場合はfalseを返す', () => {
    expect(hasFullPhotoAccess({ granted: true, accessPrivileges: 'limited' } as MediaLibrary.PermissionResponse)).toBe(false);
    expect(hasFullPhotoAccess({ granted: false, accessPrivileges: 'none' } as MediaLibrary.PermissionResponse)).toBe(false);
  });
});

describe('地図写真変換 toMapPhoto', () => {
  it('ジオタグがある写真を地図表示用データへ変換する', () => {
    expect(toMapPhoto(createAssetInfo('asset-1', { latitude: 35, longitude: 139 }))).toEqual({
      id: 'asset-1',
      uri: 'file:///asset-1.jpg',
      latitude: 35,
      longitude: 139,
      creationTime: 1,
      width: 100,
      height: 80,
    });
  });

  it('localUriがない場合はasset.uriを使用する', () => {
    const asset = createAssetInfo('asset-1', { latitude: 35, longitude: 139 });
    delete asset.localUri;

    expect(toMapPhoto(asset)?.uri).toBe('ph://asset-1');
  });

  it('ジオタグがない写真はnullを返す', () => {
    expect(toMapPhoto(createAssetInfo('asset-1'))).toBeNull();
  });

  it('iOSのネイティブ実装が返す文字列の緯度経度を数値へ変換する', () => {
    // iOSは exportLocation が [String: String] を返すため、実行時は "35.6812" のような文字列になる。
    // 文字列のままMarkerへ渡すと座標が解決されずマーカーが描画されない(issue #160)
    const photo = toMapPhoto(createAssetInfo('asset-1', { latitude: '35.6812', longitude: '139.7671' }));

    expect(photo).toEqual({
      id: 'asset-1',
      uri: 'file:///asset-1.jpg',
      latitude: 35.6812,
      longitude: 139.7671,
      creationTime: 1,
      width: 100,
      height: 80,
    });
    expect(typeof photo?.latitude).toBe('number');
    expect(typeof photo?.longitude).toBe('number');
  });

  it('Androidのネイティブ実装が返す数値の緯度経度はそのまま数値として扱う', () => {
    // Androidは putDouble で数値を返すため、変換後も値が変わらないことを確認する
    const photo = toMapPhoto(createAssetInfo('asset-1', { latitude: -35.6812, longitude: -139.7671 }));

    expect(photo).toMatchObject({ latitude: -35.6812, longitude: -139.7671 });
    expect(typeof photo?.latitude).toBe('number');
  });

  it('数値へ変換できない緯度経度の写真は除外してnullを返す', () => {
    expect(toMapPhoto(createAssetInfo('asset-1', { latitude: 'abc', longitude: '139.7671' }))).toBeNull();
    expect(toMapPhoto(createAssetInfo('asset-2', { latitude: '35.6812', longitude: '' }))).toBeNull();
    expect(toMapPhoto(createAssetInfo('asset-3', { latitude: Number.NaN, longitude: 139.7671 }))).toBeNull();
    expect(toMapPhoto(createAssetInfo('asset-4', { latitude: 35.6812, longitude: Number.POSITIVE_INFINITY }))).toBeNull();
    expect(toMapPhoto(createAssetInfo('asset-5', { latitude: Number.NEGATIVE_INFINITY, longitude: 139.7671 }))).toBeNull();
  });
});

describe('ジオタグ付き写真読み込み loadGeotaggedPhotos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ジオタグ付き写真だけを返す', async () => {
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({
      assets: [{ id: 'asset-1' }, { id: 'asset-2' }],
    });
    (MediaLibrary.getAssetInfoAsync as jest.Mock)
      .mockResolvedValueOnce(createAssetInfo('asset-1', { latitude: 35, longitude: 139 }))
      .mockResolvedValueOnce(createAssetInfo('asset-2'));

    await expect(loadGeotaggedPhotos()).resolves.toEqual([
      {
        id: 'asset-1',
        uri: 'file:///asset-1.jpg',
        latitude: 35,
        longitude: 139,
        creationTime: 1,
        width: 100,
        height: 80,
      },
    ]);
    expect(MediaLibrary.getAssetsAsync).toHaveBeenCalledWith(expect.objectContaining({ mediaType: MediaLibrary.MediaType.photo }));
  });

  it('iOSのように文字列座標が返ってきても数値のMapPhotoとして返す', async () => {
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({
      assets: [{ id: 'asset-1' }, { id: 'asset-2' }],
    });
    (MediaLibrary.getAssetInfoAsync as jest.Mock)
      .mockResolvedValueOnce(createAssetInfo('asset-1', { latitude: '35.6812', longitude: '139.7671' }))
      // 座標として解釈できないアセットは地図に置けないため除外する
      .mockResolvedValueOnce(createAssetInfo('asset-2', { latitude: 'abc', longitude: 'def' }));

    const photos = await loadGeotaggedPhotos();

    expect(photos).toEqual([
      {
        id: 'asset-1',
        uri: 'file:///asset-1.jpg',
        latitude: 35.6812,
        longitude: 139.7671,
        creationTime: 1,
        width: 100,
        height: 80,
      },
    ]);
  });

  it('写真ライブラリが空の場合は空配列を返す', async () => {
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({ assets: [] });

    await expect(loadGeotaggedPhotos()).resolves.toEqual([]);
    expect(MediaLibrary.getAssetInfoAsync).not.toHaveBeenCalled();
  });

  it('一部の詳細取得に失敗しても成功したジオタグ付き写真だけを返す', async () => {
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({
      assets: [{ id: 'asset-1' }, { id: 'asset-2' }],
    });
    (MediaLibrary.getAssetInfoAsync as jest.Mock)
      .mockResolvedValueOnce(createAssetInfo('asset-1', { latitude: 35, longitude: 139 }))
      .mockRejectedValueOnce(new Error('broken asset'));

    await expect(loadGeotaggedPhotos()).resolves.toHaveLength(1);
  });

  it('getAssetInfoAsyncの同時実行数がPHOTO_INFO_CONCURRENCYを超えない', async () => {
    const assetCount = 10;
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({
      assets: Array.from({ length: assetCount }, (_, index) => ({ id: `asset-${index}` })),
    });

    let runningCount = 0;
    let maxRunningCount = 0;
    (MediaLibrary.getAssetInfoAsync as jest.Mock).mockImplementation(async (asset: { id: string }) => {
      runningCount += 1;
      maxRunningCount = Math.max(maxRunningCount, runningCount);
      await new Promise((resolve) => setTimeout(resolve, 5));
      runningCount -= 1;
      return createAssetInfo(asset.id, { latitude: 35, longitude: 139 });
    });

    await loadGeotaggedPhotos();

    expect(maxRunningCount).toBeLessThanOrEqual(PHOTO_INFO_CONCURRENCY);
    expect(MediaLibrary.getAssetInfoAsync).toHaveBeenCalledTimes(assetCount);
  });
});

describe('ジオタグ付き写真読み込みの診断計装', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('走査件数・ジオタグ件数・所要時間をloadステージとして送る', async () => {
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({
      assets: [{ id: 'asset-1' }, { id: 'asset-2' }],
      hasNextPage: true,
    });
    (MediaLibrary.getAssetInfoAsync as jest.Mock)
      .mockResolvedValueOnce(createAssetInfo('asset-1', { latitude: 35, longitude: 139 }))
      .mockResolvedValueOnce(createAssetInfo('asset-2'));

    await loadGeotaggedPhotos(50);

    expect(reportPhotoMapDiagnostics).toHaveBeenCalledTimes(1);
    expect(reportPhotoMapDiagnostics).toHaveBeenCalledWith('load', {
      requestedLimit: 50,
      scannedAssetCount: 2,
      hasNextPage: true,
      assetInfoFulfilledCount: 2,
      assetInfoRejectedCount: 0,
      geotaggedPhotoCount: 1,
      durationMs: expect.any(Number),
    });
  });

  it('詳細取得の一部が失敗した場合はfulfilled/rejectedの件数を分けて送る', async () => {
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({
      assets: [{ id: 'asset-1' }, { id: 'asset-2' }, { id: 'asset-3' }],
      hasNextPage: false,
    });
    (MediaLibrary.getAssetInfoAsync as jest.Mock)
      .mockResolvedValueOnce(createAssetInfo('asset-1', { latitude: 35, longitude: 139 }))
      .mockRejectedValueOnce(new Error('broken asset'))
      .mockRejectedValueOnce(new Error('broken asset'));

    await loadGeotaggedPhotos();

    expect(reportPhotoMapDiagnostics).toHaveBeenCalledWith(
      'load',
      expect.objectContaining({
        scannedAssetCount: 3,
        assetInfoFulfilledCount: 1,
        assetInfoRejectedCount: 2,
        geotaggedPhotoCount: 1,
      }),
    );
  });

  it('座標・アセットID・URIを診断へ含めない', async () => {
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({
      assets: [{ id: 'asset-1' }],
      hasNextPage: false,
    });
    (MediaLibrary.getAssetInfoAsync as jest.Mock).mockResolvedValueOnce(createAssetInfo('asset-1', { latitude: 35, longitude: 139 }));

    await loadGeotaggedPhotos();

    // ローカルファースト方針(AGENTS.md §5)により、写真メタデータ本体は送信対象外。
    // 送信キーを固定して、座標・アセットID・URIが紛れ込む余地を無くす
    const [, payload] = (reportPhotoMapDiagnostics as jest.Mock).mock.calls[0];
    expect(Object.keys(payload).sort()).toEqual([
      'assetInfoFulfilledCount',
      'assetInfoRejectedCount',
      'durationMs',
      'geotaggedPhotoCount',
      'hasNextPage',
      'requestedLimit',
      'scannedAssetCount',
    ]);
    expect(Object.values(payload).every((value) => typeof value === 'number' || typeof value === 'boolean')).toBe(true);
  });
});
