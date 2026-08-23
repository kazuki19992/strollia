import * as MediaLibrary from 'expo-media-library/legacy';
import { getPhotoThumbnailAsync } from '@modules/photo-thumbnail';

import { reportPhotoMapDiagnostics } from '@/config/sentry';
import { getPhotoAssetsInBounds, savePhotoAssets, type PhotoAssetRecord } from '@/features/photos/photoAssetRepository';
import { clearPhotoDisplayUriCache } from '@/features/photos/photoDisplayUri';
import {
  hasFullPhotoAccess,
  loadGeotaggedPhotos,
  loadGeotaggedPhotosInBounds,
  toMapPhoto,
  toMapPhotoFromPhotoAsset,
  toPhotoAssetRecord,
  PHOTO_INFO_CONCURRENCY,
} from '@/features/photos/photoLibrary';
import type { PhotoAssetReconciliation } from '@/features/photos/photoScanWindow';
import type { PhotoViewportBounds } from '@/features/photos/photoViewportBounds';

jest.mock('@/config/sentry', () => ({
  reportPhotoMapDiagnostics: jest.fn(),
}));

jest.mock('@/features/photos/photoAssetRepository', () => ({
  savePhotoAssets: jest.fn().mockResolvedValue(undefined),
  getPhotoAssetsInBounds: jest.fn().mockResolvedValue([]),
}));

// 表示用URIの解決に使うサムネイル取得モジュール。ネイティブ実装は jest で読めないためモックする
jest.mock('@modules/photo-thumbnail', () => ({
  getPhotoThumbnailAsync: jest.fn(),
}));

jest.mock('expo-media-library/legacy', () => ({
  getAssetsAsync: jest.fn(),
  getAssetInfoAsync: jest.fn(),
  // 既定はフルアクセス。突き合わせを抑止するケースだけ各テストで上書きする
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, accessPrivileges: 'all' }),
  requestPermissionsAsync: jest.fn(),
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
 * `getPhotoThumbnailAsync` の解決結果を差し替える。
 *
 * `clearMocks: true` により実装はテストごとに消えるため、必要なテストのbeforeEachで入れ直す。
 *
 * @param resolver - 渡された `ph://` URIからサムネイルのパスを返す関数。取得できない場合はnull。
 */
function mockPhotoThumbnail(resolver: (uri: string) => Promise<string | null>): void {
  (getPhotoThumbnailAsync as jest.Mock).mockImplementation((uri: string) => resolver(uri));
}

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

describe('写真メタデータ変換 toPhotoAssetRecord', () => {
  it('DBには再起動をまたいで安定するuriを保存し、一時パスのlocalUriは使わない', () => {
    const asset = createAssetInfo('asset-1', { latitude: 35, longitude: 139 });

    expect(toPhotoAssetRecord(asset)).toEqual({
      assetId: 'asset-1',
      latitude: 35,
      longitude: 139,
      takenAt: new Date(1).toISOString(),
      uri: 'ph://asset-1',
      width: 100,
      height: 80,
    });
    // MapPhoto.uri は localUri を優先するが、保存する値とは別物である
    expect(toMapPhoto(asset)?.uri).toBe('file:///asset-1.jpg');
  });

  it('撮影日時が取得できない場合はtakenAtをnullにする', () => {
    const asset = createAssetInfo('asset-1', { latitude: 35, longitude: 139 });
    asset.creationTime = 0;

    expect(toPhotoAssetRecord(asset)?.takenAt).toBeNull();
  });

  it('ジオタグがない写真はnullを返す', () => {
    expect(toPhotoAssetRecord(createAssetInfo('asset-1'))).toBeNull();
  });

  it('iOSのように文字列で返る緯度経度を数値へ変換する', () => {
    const record = toPhotoAssetRecord(createAssetInfo('asset-1', { latitude: '35.6812', longitude: '139.7671' }));

    expect(record).toMatchObject({ latitude: 35.6812, longitude: 139.7671 });
    expect(typeof record?.latitude).toBe('number');
  });

  it('数値へ変換できない緯度経度の写真は保存対象にしない', () => {
    expect(toPhotoAssetRecord(createAssetInfo('asset-1', { latitude: 'abc', longitude: '139.7671' }))).toBeNull();
  });
});

describe('保存済み写真の地図表示変換 toMapPhotoFromPhotoAsset', () => {
  /** テスト用の保存済みレコードを作る。 */
  function record(overrides: Partial<PhotoAssetRecord> = {}): PhotoAssetRecord {
    return {
      assetId: 'asset-1',
      latitude: 35,
      longitude: 139,
      takenAt: '2026-08-21T00:00:00.000Z',
      uri: 'ph://asset-1',
      width: 100,
      height: 80,
      ...overrides,
    };
  }

  it('保存済みの安定したuriを表示用URI解決前の値として持つ', () => {
    expect(toMapPhotoFromPhotoAsset(record())).toEqual({
      id: 'asset-1',
      uri: 'ph://asset-1',
      latitude: 35,
      longitude: 139,
      creationTime: Date.parse('2026-08-21T00:00:00.000Z'),
      width: 100,
      height: 80,
    });
  });

  it('撮影日時が無い写真は撮影日時を0として扱う', () => {
    expect(toMapPhotoFromPhotoAsset(record({ takenAt: null })).creationTime).toBe(0);
  });

  it('撮影日時が壊れている写真も撮影日時を0として扱う', () => {
    expect(toMapPhotoFromPhotoAsset(record({ takenAt: 'broken' })).creationTime).toBe(0);
  });
});

describe('表示範囲の写真読み込み loadGeotaggedPhotosInBounds', () => {
  const bounds: PhotoViewportBounds = {
    minLatitude: 34,
    maxLatitude: 36,
    westLongitude: 138,
    eastLongitude: 140,
    crossesAntimeridian: false,
  };

  /**
   * `photo_assets` の保存済みレコードを組み立てる。
   *
   * `uri` は実機(iOS)と同じく `ph://<localIdentifier>` 形式にする。
   *
   * @param assetId - アセットID。
   * @returns 保存済みレコード。
   */
  function savedRecord(assetId: string): PhotoAssetRecord {
    return {
      assetId,
      latitude: 35,
      longitude: 139,
      takenAt: '2026-08-21T00:00:00.000Z',
      uri: `ph://${assetId}`,
      width: 100,
      height: 80,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    clearPhotoDisplayUriCache();
    mockPhotoThumbnail(async (uri) => `file:///tmp/${uri.replace('ph://', '')}.jpg`);
  });

  it('表示範囲で絞り込んだ保存済み写真を、描画できる表示用URIへ解決して返す', async () => {
    (getPhotoAssetsInBounds as jest.Mock).mockResolvedValue([savedRecord('asset-1')]);

    await expect(loadGeotaggedPhotosInBounds(bounds)).resolves.toEqual([
      {
        id: 'asset-1',
        // ph:// のままでは <Image> が描画できないため file:// へ解決されている必要がある
        uri: 'file:///tmp/asset-1.jpg',
        latitude: 35,
        longitude: 139,
        creationTime: Date.parse('2026-08-21T00:00:00.000Z'),
        width: 100,
        height: 80,
      },
    ]);
    expect(getPhotoAssetsInBounds).toHaveBeenCalledWith(bounds);
  });

  it('同じ写真を再度読み込んでも表示用URIの解決は1回しか走らない', async () => {
    (getPhotoAssetsInBounds as jest.Mock).mockResolvedValue([savedRecord('asset-1')]);

    await loadGeotaggedPhotosInBounds(bounds);
    await loadGeotaggedPhotosInBounds(bounds);

    expect(getPhotoThumbnailAsync).toHaveBeenCalledTimes(1);
  });

  it('サムネイルを取得できなかった写真も、画像なし(uri=null)として結果に残す', async () => {
    (getPhotoAssetsInBounds as jest.Mock).mockResolvedValue([savedRecord('asset-1')]);
    mockPhotoThumbnail(async () => null);

    // 除外すると「マーカーごと消える」ため、画像が無いだけのマーカーとして表示する
    await expect(loadGeotaggedPhotosInBounds(bounds)).resolves.toEqual([expect.objectContaining({ id: 'asset-1', uri: null })]);
  });

  it('一部の写真だけサムネイルを取得できた場合、取得できた写真は画像あり・できなかった写真は画像なしで返す', async () => {
    (getPhotoAssetsInBounds as jest.Mock).mockResolvedValue([savedRecord('asset-1'), savedRecord('asset-2')]);
    mockPhotoThumbnail(async (uri) => (uri === 'ph://asset-1' ? null : 'file:///tmp/asset-2.jpg'));

    await expect(loadGeotaggedPhotosInBounds(bounds)).resolves.toEqual([
      expect.objectContaining({ id: 'asset-1', uri: null }),
      expect.objectContaining({ id: 'asset-2', uri: 'file:///tmp/asset-2.jpg' }),
    ]);
  });

  it('表示用URIの解決が例外で失敗した写真も、画像なしとして結果に残す', async () => {
    (getPhotoAssetsInBounds as jest.Mock).mockResolvedValue([savedRecord('asset-1'), savedRecord('asset-2')]);
    mockPhotoThumbnail(async (uri) => {
      if (uri === 'ph://asset-1') {
        throw new Error('asset not found');
      }

      return 'file:///tmp/asset-2.jpg';
    });

    await expect(loadGeotaggedPhotosInBounds(bounds)).resolves.toEqual([
      expect.objectContaining({ id: 'asset-1', uri: null }),
      expect.objectContaining({ id: 'asset-2', uri: 'file:///tmp/asset-2.jpg' }),
    ]);
  });

  it('表示用URI解決の同時実行数がPHOTO_INFO_CONCURRENCYを超えない', async () => {
    const assetCount = 10;
    (getPhotoAssetsInBounds as jest.Mock).mockResolvedValue(
      Array.from({ length: assetCount }, (_, index) => savedRecord(`asset-${index}`)),
    );

    let runningCount = 0;
    let maxRunningCount = 0;
    mockPhotoThumbnail(async (uri) => {
      runningCount += 1;
      maxRunningCount = Math.max(maxRunningCount, runningCount);
      await new Promise((resolve) => setTimeout(resolve, 5));
      runningCount -= 1;

      return `file:///tmp/${uri.replace('ph://', '')}.jpg`;
    });

    await loadGeotaggedPhotosInBounds(bounds);

    expect(maxRunningCount).toBeLessThanOrEqual(PHOTO_INFO_CONCURRENCY);
    expect(getPhotoThumbnailAsync).toHaveBeenCalledTimes(assetCount);
  });

  it('写真ライブラリの走査は行わない', async () => {
    (getPhotoAssetsInBounds as jest.Mock).mockResolvedValue([]);

    await loadGeotaggedPhotosInBounds(bounds);

    expect(MediaLibrary.getAssetsAsync).not.toHaveBeenCalled();
    expect(MediaLibrary.getAssetInfoAsync).not.toHaveBeenCalled();
  });
});

describe('ジオタグ付き写真読み込み loadGeotaggedPhotos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ジオタグ付き写真のメタデータをphoto_assetsへ保存する', async () => {
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({
      assets: [{ id: 'asset-1' }, { id: 'asset-2' }],
    });
    (MediaLibrary.getAssetInfoAsync as jest.Mock)
      .mockResolvedValueOnce(createAssetInfo('asset-1', { latitude: 35, longitude: 139 }))
      // ジオタグのない写真は保存対象外
      .mockResolvedValueOnce(createAssetInfo('asset-2'));

    await loadGeotaggedPhotos();

    expect(savePhotoAssets).toHaveBeenCalledTimes(1);
    expect(savePhotoAssets).toHaveBeenCalledWith(
      [
        {
          assetId: 'asset-1',
          latitude: 35,
          longitude: 139,
          takenAt: new Date(1).toISOString(),
          uri: 'ph://asset-1',
          width: 100,
          height: 80,
        },
      ],
      // ページ内アセットの撮影日時が無く窓の下限を計算できないため、突き合わせは行わない
      null,
    );
  });

  it('保存に失敗しても写真表示は継続する', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (savePhotoAssets as jest.Mock).mockRejectedValueOnce(new Error('database is locked'));
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({ assets: [{ id: 'asset-1' }] });
    (MediaLibrary.getAssetInfoAsync as jest.Mock).mockResolvedValueOnce(createAssetInfo('asset-1', { latitude: 35, longitude: 139 }));

    await expect(loadGeotaggedPhotos()).resolves.toEqual({ photos: [expect.objectContaining({ id: 'asset-1' })], isCacheSaved: false });
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('ジオタグ付き写真だけを返す', async () => {
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({
      assets: [{ id: 'asset-1' }, { id: 'asset-2' }],
    });
    (MediaLibrary.getAssetInfoAsync as jest.Mock)
      .mockResolvedValueOnce(createAssetInfo('asset-1', { latitude: 35, longitude: 139 }))
      .mockResolvedValueOnce(createAssetInfo('asset-2'));

    await expect(loadGeotaggedPhotos()).resolves.toEqual({
      photos: [
        {
          id: 'asset-1',
          uri: 'file:///asset-1.jpg',
          latitude: 35,
          longitude: 139,
          creationTime: 1,
          width: 100,
          height: 80,
        },
      ],
      isCacheSaved: true,
    });
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

    const { photos } = await loadGeotaggedPhotos();

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

    await expect(loadGeotaggedPhotos()).resolves.toEqual({ photos: [], isCacheSaved: true });
    expect(MediaLibrary.getAssetInfoAsync).not.toHaveBeenCalled();
  });

  it('一部の詳細取得に失敗しても成功したジオタグ付き写真だけを返す', async () => {
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({
      assets: [{ id: 'asset-1' }, { id: 'asset-2' }],
    });
    (MediaLibrary.getAssetInfoAsync as jest.Mock)
      .mockResolvedValueOnce(createAssetInfo('asset-1', { latitude: 35, longitude: 139 }))
      .mockRejectedValueOnce(new Error('broken asset'));

    await expect(loadGeotaggedPhotos()).resolves.toEqual(expect.objectContaining({ photos: [expect.objectContaining({ id: 'asset-1' })] }));
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

describe('走査済み窓との突き合わせ loadGeotaggedPhotos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * `savePhotoAssets` へ渡された突き合わせ条件を取り出す。
   *
   * @returns 突き合わせ条件。渡されていない場合はnull。
   */
  function reconciliationArgument(): PhotoAssetReconciliation | null {
    return (savePhotoAssets as jest.Mock).mock.calls[0][1] as PhotoAssetReconciliation | null;
  }

  it('ライブラリから削除された写真は残す対象に含まれず、削除候補になる', async () => {
    // 以前保存した asset-deleted は getAssetsAsync が返さない = 窓の中に存在しない
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({
      assets: [{ id: 'asset-1', creationTime: 2000 }],
      hasNextPage: true,
    });
    (MediaLibrary.getAssetInfoAsync as jest.Mock).mockResolvedValueOnce(createAssetInfo('asset-1', { latitude: 35, longitude: 139 }));

    await loadGeotaggedPhotos();

    expect(reconciliationArgument()).toEqual({
      scannedEntireLibrary: false,
      exclusiveOldestTakenAt: new Date(2000).toISOString(),
      retainedAssetIds: ['asset-1'],
    });
  });

  it('ジオタグを失った写真は残す対象に含まれない', async () => {
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({
      assets: [
        { id: 'asset-1', creationTime: 2000 },
        { id: 'asset-lost-geotag', creationTime: 1000 },
      ],
      hasNextPage: true,
    });
    (MediaLibrary.getAssetInfoAsync as jest.Mock)
      .mockResolvedValueOnce(createAssetInfo('asset-1', { latitude: 35, longitude: 139 }))
      // 詳細取得は成功したがジオタグが無い = 写真アプリで位置情報が外された
      .mockResolvedValueOnce(createAssetInfo('asset-lost-geotag'));

    await loadGeotaggedPhotos();

    expect(reconciliationArgument()?.retainedAssetIds).toEqual(['asset-1']);
  });

  it('詳細取得がrejectされた写真は残す対象に含まれ、削除されない', async () => {
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({
      assets: [
        { id: 'asset-1', creationTime: 2000 },
        { id: 'asset-broken', creationTime: 1000 },
      ],
      hasNextPage: true,
    });
    (MediaLibrary.getAssetInfoAsync as jest.Mock)
      .mockResolvedValueOnce(createAssetInfo('asset-1', { latitude: 35, longitude: 139 }))
      .mockRejectedValueOnce(new Error('broken asset'));

    await loadGeotaggedPhotos();

    // 存在は確認できたがジオタグの有無を判断できないため、実在する写真の行を消してはいけない
    expect(reconciliationArgument()?.retainedAssetIds).toEqual(['asset-1', 'asset-broken']);
  });

  it('窓の下限はジオタグの有無を問わずページ内全アセットの最古の撮影日時になる', async () => {
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({
      assets: [
        { id: 'asset-1', creationTime: 3000 },
        // ジオタグが無い写真も「見た範囲」に含まれる
        { id: 'asset-2', creationTime: 1000 },
      ],
      hasNextPage: true,
    });
    (MediaLibrary.getAssetInfoAsync as jest.Mock)
      .mockResolvedValueOnce(createAssetInfo('asset-1', { latitude: 35, longitude: 139 }))
      .mockResolvedValueOnce(createAssetInfo('asset-2'));

    await loadGeotaggedPhotos();

    expect(reconciliationArgument()).toMatchObject({ exclusiveOldestTakenAt: new Date(1000).toISOString() });
  });

  it('ライブラリ末尾まで走査した場合は全期間の突き合わせになる', async () => {
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({
      assets: [{ id: 'asset-1', creationTime: 2000 }],
      hasNextPage: false,
    });
    (MediaLibrary.getAssetInfoAsync as jest.Mock).mockResolvedValueOnce(createAssetInfo('asset-1', { latitude: 35, longitude: 139 }));

    await loadGeotaggedPhotos();

    expect(reconciliationArgument()).toEqual({ scannedEntireLibrary: true, retainedAssetIds: ['asset-1'] });
  });

  it('写真ライブラリが空の場合は保存済みの行をすべて削除する条件を渡す', async () => {
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({ assets: [], hasNextPage: false });

    await loadGeotaggedPhotos();

    expect(savePhotoAssets).toHaveBeenCalledWith([], { scannedEntireLibrary: true, retainedAssetIds: [] });
  });

  it('窓の下限を計算できない場合は突き合わせを行わない', async () => {
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({
      assets: [{ id: 'asset-1' }],
      hasNextPage: true,
    });
    (MediaLibrary.getAssetInfoAsync as jest.Mock).mockResolvedValueOnce(createAssetInfo('asset-1', { latitude: 35, longitude: 139 }));

    await loadGeotaggedPhotos();

    expect(reconciliationArgument()).toBeNull();
  });

  it('突き合わせを含む保存が失敗しても写真表示は継続する', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (savePhotoAssets as jest.Mock).mockRejectedValueOnce(new Error('database is locked'));
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({
      assets: [{ id: 'asset-1', creationTime: 2000 }],
      hasNextPage: false,
    });
    (MediaLibrary.getAssetInfoAsync as jest.Mock).mockResolvedValueOnce(createAssetInfo('asset-1', { latitude: 35, longitude: 139 }));

    // 保存に失敗したことは呼び出し側へ伝える(キャッシュが空でも走査結果を表示できるようにするため)
    await expect(loadGeotaggedPhotos()).resolves.toEqual({
      photos: [expect.objectContaining({ id: 'asset-1' })],
      isCacheSaved: false,
    });
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});

describe('写真ライブラリ権限による突き合わせの抑止 loadGeotaggedPhotos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 限定アクセスでは getAssetsAsync が「ユーザーが選択した写真」だけを hasNextPage: false で返す。
    // その形をそのまま突き合わせると全期間が対象になり、保存済みの行がほぼ全て削除される
    (MediaLibrary.getAssetsAsync as jest.Mock).mockResolvedValue({
      assets: [{ id: 'asset-1', creationTime: 2000 }],
      hasNextPage: false,
    });
    (MediaLibrary.getAssetInfoAsync as jest.Mock).mockResolvedValue(createAssetInfo('asset-1', { latitude: 35, longitude: 139 }));
  });

  /**
   * `savePhotoAssets` へ渡された突き合わせ条件を取り出す。
   *
   * @returns 突き合わせ条件。渡されていない場合はnull。
   */
  function reconciliationArgument(): PhotoAssetReconciliation | null {
    return (savePhotoAssets as jest.Mock).mock.calls[0][1] as PhotoAssetReconciliation | null;
  }

  it('フルアクセスの場合は従来どおり突き合わせを行う', async () => {
    (MediaLibrary.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: true, accessPrivileges: 'all' });

    await loadGeotaggedPhotos();

    expect(reconciliationArgument()).toEqual({ scannedEntireLibrary: true, retainedAssetIds: ['asset-1'] });
  });

  it('権限は参照するだけで、権限ダイアログを出さない', async () => {
    await loadGeotaggedPhotos();

    expect(MediaLibrary.getPermissionsAsync).toHaveBeenCalled();
    expect(MediaLibrary.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('限定アクセスの場合は突き合わせを行わず保存だけ行う', async () => {
    (MediaLibrary.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: true, accessPrivileges: 'limited' });

    await loadGeotaggedPhotos();

    expect(savePhotoAssets).toHaveBeenCalledWith(
      [
        {
          assetId: 'asset-1',
          latitude: 35,
          longitude: 139,
          takenAt: new Date(1).toISOString(),
          uri: 'ph://asset-1',
          width: 100,
          height: 80,
        },
      ],
      null,
    );
  });

  it('権限がnoneの場合は突き合わせを行わない', async () => {
    (MediaLibrary.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false, accessPrivileges: 'none' });

    await loadGeotaggedPhotos();

    expect(reconciliationArgument()).toBeNull();
  });

  it('権限が許可されていない場合は突き合わせを行わない', async () => {
    (MediaLibrary.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });

    await loadGeotaggedPhotos();

    expect(reconciliationArgument()).toBeNull();
  });

  it('権限の参照に失敗した場合は安全側に倒して突き合わせを行わず、写真の読み込みは成功する', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (MediaLibrary.getPermissionsAsync as jest.Mock).mockRejectedValueOnce(new Error('permission unavailable'));

    await expect(loadGeotaggedPhotos()).resolves.toEqual(expect.objectContaining({ photos: [expect.objectContaining({ id: 'asset-1' })] }));
    expect(reconciliationArgument()).toBeNull();

    warnSpy.mockRestore();
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
