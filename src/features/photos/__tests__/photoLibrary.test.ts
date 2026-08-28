import { AssetField, MediaType, type AssetMetadata, type Location, type PermissionResponse } from 'expo-media-library';
import { getPhotoThumbnailAsync } from '@modules/photo-thumbnail';

import { getPhotoScanLimitOverride } from '@/config/developmentFlags';
import { reportPhotoMapDiagnostics } from '@/config/sentry';
import { getPhotoAssetsInBounds, savePhotoAssets, type PhotoAssetRecord } from '@/features/photos/photoAssetRepository';
import { clearPhotoDisplayUriCache } from '@/features/photos/photoDisplayUri';
import {
  hasFullPhotoAccess,
  loadGeotaggedPhotos,
  loadGeotaggedPhotosInBounds,
  resolvePhotoScanLimit,
  toMapPhoto,
  toMapPhotoFromPhotoAsset,
  toPhotoAssetRecord,
  PHOTO_INFO_CONCURRENCY,
} from '@/features/photos/photoLibrary';
import { getPhotoScanBaselineMs, savePhotoScanBaselineMs } from '@/features/photos/photoScanState';
import type { PhotoAssetReconciliation } from '@/features/photos/photoScanWindow';
import type { PhotoViewportBounds } from '@/features/photos/photoViewportBounds';

/** `Query.eq` の呼び出しを記録するスパイ。走査条件(画像のみ)の検証に使う。 */
const mockQueryEq = jest.fn();
/** `Query.orderBy` の呼び出しを記録するスパイ。並び順(撮影日時の降順)の検証に使う。 */
const mockQueryOrderBy = jest.fn();
/** `Query.limit` の呼び出しを記録するスパイ。`limit + 1` のプロービング検証に使う。 */
const mockQueryLimit = jest.fn();
/** `Query.gt` の呼び出しを記録するスパイ。差分走査の基準時刻による絞り込みの検証に使う。 */
const mockQueryGt = jest.fn();
/** `Query.exeForMetadata` の戻り値を差し替えるスパイ。 */
const mockExeForMetadata = jest.fn<Promise<AssetMetadata[]>, []>();
/** `Asset.getLocation` の戻り値を差し替えるスパイ。引数はアセットID。 */
const mockGetLocation = jest.fn<Promise<Location | null>, [string]>();
/** `getPermissionsAsync` のスパイ。走査済み窓の突き合わせ可否の検証に使う。 */
const mockGetPermissionsAsync = jest.fn();
/** `requestPermissionsAsync` のスパイ。走査経路が権限ダイアログを出さないことの検証に使う。 */
const mockRequestPermissionsAsync = jest.fn();

jest.mock('@/config/sentry', () => ({
  reportPhotoMapDiagnostics: jest.fn(),
}));

// 走査上限の計測用上書き。既定(null)では上限なしで走査する
jest.mock('@/config/developmentFlags', () => ({
  getPhotoScanLimitOverride: jest.fn(() => null),
}));

// このテストはDBに触れない(リポジトリはすべてモック)が、モジュール読み込み時にSQLite接続を開く
// `@/db/database` を経由するため、接続の生成だけ差し替える
jest.mock('@/db/database', () => ({
  db: {},
  withExclusiveTransaction: jest.fn(),
}));

// 差分走査の基準時刻。DBに触れる読み書きだけ差し替え、基準時刻の算出(純粋関数)は実物を使う。
// 既定(null)は初回相当で、差分走査を要求しても全件走査へフォールバックする
jest.mock('@/features/photos/photoScanState', () => ({
  ...jest.requireActual('@/features/photos/photoScanState'),
  getPhotoScanBaselineMs: jest.fn().mockResolvedValue(null),
  savePhotoScanBaselineMs: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/photos/photoAssetRepository', () => ({
  savePhotoAssets: jest.fn().mockResolvedValue(undefined),
  getPhotoAssetsInBounds: jest.fn().mockResolvedValue([]),
}));

// 表示用URIの解決に使うサムネイル取得モジュール。ネイティブ実装は jest で読めないためモックする
jest.mock('@modules/photo-thumbnail', () => ({
  getPhotoThumbnailAsync: jest.fn(),
}));

// SDK 57 のクラスベース新API。`Query` はメソッドチェーンなので、絞り込み系は自分自身を返しつつ
// 引数だけスパイへ記録する。ルートの手動モック(`__mocks__/expo-media-library.js`)をこれで上書きする
jest.mock('expo-media-library', () => ({
  AssetField: {
    CREATION_TIME: 'creationTime',
    MODIFICATION_TIME: 'modificationTime',
    MEDIA_TYPE: 'mediaType',
    WIDTH: 'width',
    HEIGHT: 'height',
    DURATION: 'duration',
    IS_FAVORITE: 'isFavorite',
  },
  MediaType: { UNKNOWN: 'unknown', IMAGE: 'image', AUDIO: 'audio', VIDEO: 'video' },
  Query: class {
    /** @returns チェーン用に自分自身。 */
    eq(field: string, value: unknown) {
      mockQueryEq(field, value);
      return this;
    }

    /** @returns チェーン用に自分自身。 */
    orderBy(sortDescriptor: unknown) {
      mockQueryOrderBy(sortDescriptor);
      return this;
    }

    /** @returns チェーン用に自分自身。 */
    limit(count: number) {
      mockQueryLimit(count);
      return this;
    }

    /** @returns チェーン用に自分自身。 */
    gt(field: string, value: number) {
      mockQueryGt(field, value);
      return this;
    }

    /** @returns 走査結果のメタデータ。 */
    exeForMetadata() {
      return mockExeForMetadata();
    }
  },
  Asset: class {
    id: string;

    constructor(id: string) {
      this.id = id;
    }

    /** @returns 撮影位置。 */
    getLocation() {
      return mockGetLocation(this.id);
    }
  },
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
}));

/**
 * テスト用の位置情報。
 *
 * expo-media-libraryの型定義は緯度経度を`number`と宣言しているが、**型宣言と実装が食い違いうる**
 * (issue #160: 旧APIのiOS実装は文字列を返していた)。新APIでも型を信用しきらない防御を残しているため、
 * テストでは文字列も渡せるようにしている。
 */
type TestLocation = { latitude: number | string; longitude: number | string };

/**
 * 型宣言と食い違う値も渡せるよう、テスト用位置情報を `Location` として扱う。
 *
 * @param location - テスト用の位置情報。
 * @returns Location相当の値。
 */
function asLocation(location: TestLocation): Location {
  return location as unknown as Location;
}

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
 * テスト用の走査メタデータを作る。
 *
 * 新APIの `id` は `ph://<localIdentifier>` 形式で、`photo_assets.uri` に保存する値と同一である。
 *
 * @param localIdentifier - `ph://` を除いた識別子。
 * @param overrides - 個別に差し替えるフィールド。
 * @returns AssetMetadata相当のテストデータ。
 */
function createAssetMetadata(localIdentifier: string, overrides: Partial<AssetMetadata> = {}): AssetMetadata {
  return {
    id: `ph://${localIdentifier}`,
    filename: `${localIdentifier}.jpg`,
    mediaType: MediaType.IMAGE,
    width: 100,
    height: 80,
    duration: null,
    creationTime: 1,
    modificationTime: 2,
    isFavorite: false,
    ...overrides,
  };
}

/**
 * 走査結果(メタデータ)と、アセットIDごとの位置情報をまとめてモックへ設定する。
 *
 * @param metadata - `exeForMetadata` が返すメタデータ。
 * @param locations - アセットIDから位置情報を引く関数。省略時はジオタグなし。
 */
function mockScan(metadata: AssetMetadata[], locations: (assetId: string) => Promise<Location | null> = async () => null): void {
  mockExeForMetadata.mockImplementation(async () => metadata);
  mockGetLocation.mockImplementation((assetId) => locations(assetId));
}

/** ジオタグ付き写真の位置情報(東京)。 */
const tokyoLocation = asLocation({ latitude: 35, longitude: 139 });

describe('写真ライブラリ権限 hasFullPhotoAccess', () => {
  it('フルアクセスが許可されている場合はtrueを返す', () => {
    expect(hasFullPhotoAccess({ granted: true, accessPrivileges: 'all' } as PermissionResponse)).toBe(true);
  });

  it('限定アクセスや拒否状態の場合はfalseを返す', () => {
    expect(hasFullPhotoAccess({ granted: true, accessPrivileges: 'limited' } as PermissionResponse)).toBe(false);
    expect(hasFullPhotoAccess({ granted: false, accessPrivileges: 'none' } as PermissionResponse)).toBe(false);
  });
});

describe('地図写真変換 toMapPhoto', () => {
  it('ジオタグがある写真を地図表示用データへ変換する', () => {
    expect(toMapPhoto(createAssetMetadata('asset-1'), tokyoLocation)).toEqual({
      id: 'ph://asset-1',
      uri: 'ph://asset-1',
      latitude: 35,
      longitude: 139,
      creationTime: 1,
      width: 100,
      height: 80,
    });
  });

  it('uriにはAssetMetadata.idのph://をそのまま使う', () => {
    // `Asset.getUri()` は requestContentEditingInput を伴い、iCloudにしか本体が無い写真で失敗する。
    // 走査ではI/Oの要らない `id` をそのまま安定URIとして使う
    expect(toMapPhoto(createAssetMetadata('asset-1'), tokyoLocation)?.uri).toBe('ph://asset-1');
  });

  it('ジオタグがない写真はnullを返す', () => {
    expect(toMapPhoto(createAssetMetadata('asset-1'), null)).toBeNull();
  });

  it('ネイティブ実装が型宣言に反して文字列の緯度経度を返しても数値へ変換する', () => {
    // 旧APIのiOS実装は緯度経度を文字列で返していた(issue #160)。新APIはDoubleを返す宣言だが、
    // 「型宣言と実装が食い違いうる」という教訓としてこの防御をテストごと残している
    const photo = toMapPhoto(createAssetMetadata('asset-1'), asLocation({ latitude: '35.6812', longitude: '139.7671' }));

    expect(photo).toMatchObject({ latitude: 35.6812, longitude: 139.7671 });
    expect(typeof photo?.latitude).toBe('number');
    expect(typeof photo?.longitude).toBe('number');
  });

  it('数値の緯度経度はそのまま数値として扱う', () => {
    const photo = toMapPhoto(createAssetMetadata('asset-1'), asLocation({ latitude: -35.6812, longitude: -139.7671 }));

    expect(photo).toMatchObject({ latitude: -35.6812, longitude: -139.7671 });
    expect(typeof photo?.latitude).toBe('number');
  });

  it('数値へ変換できない緯度経度の写真は除外してnullを返す', () => {
    expect(toMapPhoto(createAssetMetadata('asset-1'), asLocation({ latitude: 'abc', longitude: '139.7671' }))).toBeNull();
    expect(toMapPhoto(createAssetMetadata('asset-2'), asLocation({ latitude: '35.6812', longitude: '' }))).toBeNull();
    expect(toMapPhoto(createAssetMetadata('asset-3'), asLocation({ latitude: Number.NaN, longitude: 139.7671 }))).toBeNull();
    expect(toMapPhoto(createAssetMetadata('asset-4'), asLocation({ latitude: 35.6812, longitude: Number.POSITIVE_INFINITY }))).toBeNull();
    expect(toMapPhoto(createAssetMetadata('asset-5'), asLocation({ latitude: Number.NEGATIVE_INFINITY, longitude: 139.7671 }))).toBeNull();
  });

  it('寸法を取得できない写真は0として扱う', () => {
    // AssetMetadata の width / height は Android のメディアストアが値を持たない場合 null になる
    expect(toMapPhoto(createAssetMetadata('asset-1', { width: null, height: null }), tokyoLocation)).toMatchObject({ width: 0, height: 0 });
  });
});

describe('写真メタデータ変換 toPhotoAssetRecord', () => {
  it('走査で得たph://のidを、そのままassetIdとuriとして保存する', () => {
    expect(toPhotoAssetRecord(createAssetMetadata('asset-1'), tokyoLocation)).toEqual({
      assetId: 'ph://asset-1',
      latitude: 35,
      longitude: 139,
      takenAt: new Date(1).toISOString(),
      uri: 'ph://asset-1',
      width: 100,
      height: 80,
    });
  });

  it('撮影日時が取得できない場合はtakenAtをnullにする', () => {
    expect(toPhotoAssetRecord(createAssetMetadata('asset-1', { creationTime: 0 }), tokyoLocation)?.takenAt).toBeNull();
    expect(toPhotoAssetRecord(createAssetMetadata('asset-2', { creationTime: null }), tokyoLocation)?.takenAt).toBeNull();
  });

  it('ジオタグがない写真はnullを返す', () => {
    expect(toPhotoAssetRecord(createAssetMetadata('asset-1'), null)).toBeNull();
  });

  it('型宣言に反して文字列で返る緯度経度を数値へ変換する', () => {
    const record = toPhotoAssetRecord(createAssetMetadata('asset-1'), asLocation({ latitude: '35.6812', longitude: '139.7671' }));

    expect(record).toMatchObject({ latitude: 35.6812, longitude: 139.7671 });
    expect(typeof record?.latitude).toBe('number');
  });

  it('数値へ変換できない緯度経度の写真は保存対象にしない', () => {
    expect(toPhotoAssetRecord(createAssetMetadata('asset-1'), asLocation({ latitude: 'abc', longitude: '139.7671' }))).toBeNull();
  });

  it('寸法を取得できない写真は0として保存する', () => {
    expect(toPhotoAssetRecord(createAssetMetadata('asset-1', { width: null, height: null }), tokyoLocation)).toMatchObject({
      width: 0,
      height: 0,
    });
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
    // 表示上限を指定しない場合は上限なし(内部の安全上限だけが効く)
    expect(getPhotoAssetsInBounds).toHaveBeenCalledWith(bounds, { displayLimit: null });
  });

  it('表示上限をビューポート検索へ渡す', async () => {
    (getPhotoAssetsInBounds as jest.Mock).mockResolvedValue([]);

    await loadGeotaggedPhotosInBounds(bounds, 1000);

    expect(getPhotoAssetsInBounds).toHaveBeenCalledWith(bounds, { displayLimit: 1000 });
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

    expect(mockExeForMetadata).not.toHaveBeenCalled();
    expect(mockGetLocation).not.toHaveBeenCalled();
  });
});

describe('ジオタグ付き写真読み込み loadGeotaggedPhotos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 保存失敗時のフォールバックは表示用URIを解決するため、解決結果をテスト間へ持ち越さない
    clearPhotoDisplayUriCache();
    // 既定はフルアクセス。突き合わせを抑止するケースだけ各テストで上書きする
    mockGetPermissionsAsync.mockResolvedValue({ granted: true, accessPrivileges: 'all' });
  });

  it('画像のみを撮影日時の降順で問い合わせる', async () => {
    mockScan([]);

    await loadGeotaggedPhotos();

    expect(mockQueryEq).toHaveBeenCalledWith(AssetField.MEDIA_TYPE, MediaType.IMAGE);
    expect(mockQueryOrderBy).toHaveBeenCalledWith({ key: AssetField.CREATION_TIME, ascending: false });
  });

  it('次ページの有無を判定するため上限より1件多く要求する', async () => {
    mockScan([]);

    await loadGeotaggedPhotos({ limit: 50 });

    expect(mockQueryLimit).toHaveBeenCalledWith(51);
  });

  it('ジオタグ付き写真のメタデータをphoto_assetsへ保存する', async () => {
    mockScan([createAssetMetadata('asset-1'), createAssetMetadata('asset-2')], async (assetId) =>
      // ジオタグのない写真は保存対象外
      assetId === 'ph://asset-1' ? tokyoLocation : null,
    );

    await loadGeotaggedPhotos();

    expect(savePhotoAssets).toHaveBeenCalledTimes(1);
    expect(savePhotoAssets).toHaveBeenCalledWith(
      [
        {
          assetId: 'ph://asset-1',
          latitude: 35,
          longitude: 139,
          takenAt: new Date(1).toISOString(),
          uri: 'ph://asset-1',
          width: 100,
          height: 80,
        },
      ],
      // ページ内アセットの撮影日時から窓の下限は計算できるが、ライブラリを見切っているため全期間になる
      { scannedEntireLibrary: true, retainedAssetIds: ['ph://asset-1'] },
    );
  });

  it('保存に失敗しても写真表示は継続する', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (savePhotoAssets as jest.Mock).mockRejectedValueOnce(new Error('database is locked'));
    mockScan([createAssetMetadata('asset-1')], async () => tokyoLocation);

    await expect(loadGeotaggedPhotos()).resolves.toEqual(
      expect.objectContaining({
        photos: [expect.objectContaining({ id: 'ph://asset-1' })],
        isCacheSaved: false,
      }),
    );
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('ジオタグ付き写真だけを返す', async () => {
    mockScan([createAssetMetadata('asset-1'), createAssetMetadata('asset-2')], async (assetId) =>
      assetId === 'ph://asset-1' ? tokyoLocation : null,
    );

    await expect(loadGeotaggedPhotos()).resolves.toEqual(
      expect.objectContaining({
        photos: [
          {
            id: 'ph://asset-1',
            uri: 'ph://asset-1',
            latitude: 35,
            longitude: 139,
            creationTime: 1,
            width: 100,
            height: 80,
          },
        ],
        isCacheSaved: true,
      }),
    );
  });

  it('型宣言に反して文字列座標が返ってきても数値のMapPhotoとして返す', async () => {
    mockScan([createAssetMetadata('asset-1'), createAssetMetadata('asset-2')], async (assetId) =>
      assetId === 'ph://asset-1'
        ? asLocation({ latitude: '35.6812', longitude: '139.7671' })
        : // 座標として解釈できないアセットは地図に置けないため除外する
          asLocation({ latitude: 'abc', longitude: 'def' }),
    );

    const { photos } = await loadGeotaggedPhotos();

    expect(photos).toEqual([
      {
        id: 'ph://asset-1',
        uri: 'ph://asset-1',
        latitude: 35.6812,
        longitude: 139.7671,
        creationTime: 1,
        width: 100,
        height: 80,
      },
    ]);
  });

  it('写真ライブラリが空の場合は空配列を返す', async () => {
    mockScan([]);

    await expect(loadGeotaggedPhotos()).resolves.toEqual(expect.objectContaining({ photos: [], isCacheSaved: true }));
    expect(mockGetLocation).not.toHaveBeenCalled();
  });

  it('一部の位置情報取得に失敗しても成功したジオタグ付き写真だけを返す', async () => {
    mockScan([createAssetMetadata('asset-1'), createAssetMetadata('asset-2')], async (assetId) => {
      if (assetId === 'ph://asset-2') {
        throw new Error('broken asset');
      }

      return tokyoLocation;
    });

    await expect(loadGeotaggedPhotos()).resolves.toEqual(
      expect.objectContaining({ photos: [expect.objectContaining({ id: 'ph://asset-1' })] }),
    );
  });

  it('getLocationの同時実行数がPHOTO_INFO_CONCURRENCYを超えない', async () => {
    const assetCount = 10;
    let runningCount = 0;
    let maxRunningCount = 0;
    mockScan(
      Array.from({ length: assetCount }, (_, index) => createAssetMetadata(`asset-${index}`)),
      async () => {
        runningCount += 1;
        maxRunningCount = Math.max(maxRunningCount, runningCount);
        await new Promise((resolve) => setTimeout(resolve, 5));
        runningCount -= 1;

        return tokyoLocation;
      },
    );

    await loadGeotaggedPhotos();

    expect(maxRunningCount).toBeLessThanOrEqual(PHOTO_INFO_CONCURRENCY);
    expect(mockGetLocation).toHaveBeenCalledTimes(assetCount);
  });
});

describe('キャッシュ保存に失敗したときのフォールバック loadGeotaggedPhotos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearPhotoDisplayUriCache();
    mockGetPermissionsAsync.mockResolvedValue({ granted: true, accessPrivileges: 'all' });
    mockPhotoThumbnail(async (uri) => `file:///tmp/${uri.replace('ph://', '')}.jpg`);
  });

  it('保存に失敗した場合、返る写真の表示用URIが解決済みになっている', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (savePhotoAssets as jest.Mock).mockRejectedValueOnce(new Error('database is locked'));
    mockScan([createAssetMetadata('asset-1')], async () => tokyoLocation);

    // この結果は呼び出し側がそのまま描画へ回す。ph:// のままでは <Image> が何も描画できない
    await expect(loadGeotaggedPhotos()).resolves.toEqual(
      expect.objectContaining({
        photos: [expect.objectContaining({ id: 'ph://asset-1', uri: 'file:///tmp/asset-1.jpg' })],
        isCacheSaved: false,
      }),
    );

    warnSpy.mockRestore();
  });

  it('表示用URIを解決できなかった写真も、画像なし(uri=null)として結果に残す', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (savePhotoAssets as jest.Mock).mockRejectedValueOnce(new Error('database is locked'));
    mockScan([createAssetMetadata('asset-1'), createAssetMetadata('asset-2')], async () => tokyoLocation);
    mockPhotoThumbnail(async (uri) => (uri === 'ph://asset-1' ? null : 'file:///tmp/asset-2.jpg'));

    // 除外すると「マーカーごと消える」ため、画像が無いだけのマーカーとして表示する
    const { photos } = await loadGeotaggedPhotos();

    expect(photos).toEqual([
      expect.objectContaining({ id: 'ph://asset-1', uri: null }),
      expect.objectContaining({ id: 'ph://asset-2', uri: 'file:///tmp/asset-2.jpg' }),
    ]);

    warnSpy.mockRestore();
  });

  it('保存に成功した場合は表示用URIを解決しない(呼び出し側が走査結果を使わないため)', async () => {
    mockScan([createAssetMetadata('asset-1')], async () => tokyoLocation);

    await loadGeotaggedPhotos();

    // 表示しない写真ぶんまでサムネイルを書き出すと、走査のたびに無駄なコストがかかる
    expect(getPhotoThumbnailAsync).not.toHaveBeenCalled();
  });
});

describe('次ページ判定のプロービング loadGeotaggedPhotos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPermissionsAsync.mockResolvedValue({ granted: true, accessPrivileges: 'all' });
  });

  it('上限を超える件数が返った場合は保存対象を上限件数へ切り詰める', async () => {
    // limit=2 に対し3件返る = さらに古い写真が残っている
    mockScan(
      [
        createAssetMetadata('asset-1', { creationTime: 3000 }),
        createAssetMetadata('asset-2', { creationTime: 2000 }),
        createAssetMetadata('asset-3', { creationTime: 1000 }),
      ],
      async () => tokyoLocation,
    );

    const { photos } = await loadGeotaggedPhotos({ limit: 2 });

    expect(photos.map((photo) => photo.id)).toEqual(['ph://asset-1', 'ph://asset-2']);
    // 切り詰めた1件には位置情報を問い合わせない(往復回数を上限どおりに保つ)
    expect(mockGetLocation).toHaveBeenCalledTimes(2);
    expect((savePhotoAssets as jest.Mock).mock.calls[0][0].map((record: PhotoAssetRecord) => record.assetId)).toEqual([
      'ph://asset-1',
      'ph://asset-2',
    ]);
  });

  it('上限を超える件数が返った場合は次ページありとして扱う', async () => {
    mockScan(
      [
        createAssetMetadata('asset-1', { creationTime: 3000 }),
        createAssetMetadata('asset-2', { creationTime: 2000 }),
        createAssetMetadata('asset-3', { creationTime: 1000 }),
      ],
      async () => tokyoLocation,
    );

    await loadGeotaggedPhotos({ limit: 2 });

    // 次ページありなので全期間の突き合わせにはせず、走査済み窓(切り詰め後の最古)の下限を持つ
    expect((savePhotoAssets as jest.Mock).mock.calls[0][1]).toEqual({
      scannedEntireLibrary: false,
      exclusiveOldestTakenAt: new Date(2000).toISOString(),
      retainedAssetIds: ['ph://asset-1', 'ph://asset-2'],
    });
  });

  it('上限以下の件数しか返らない場合はライブラリを見切ったとして扱う', async () => {
    mockScan(
      [createAssetMetadata('asset-1', { creationTime: 3000 }), createAssetMetadata('asset-2', { creationTime: 2000 })],
      async () => tokyoLocation,
    );

    await loadGeotaggedPhotos({ limit: 2 });

    expect((savePhotoAssets as jest.Mock).mock.calls[0][1]).toEqual({
      scannedEntireLibrary: true,
      retainedAssetIds: ['ph://asset-1', 'ph://asset-2'],
    });
  });
});

describe('走査済み窓との突き合わせ loadGeotaggedPhotos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 保存失敗時のフォールバックは表示用URIを解決するため、解決結果をテスト間へ持ち越さない
    clearPhotoDisplayUriCache();
    mockGetPermissionsAsync.mockResolvedValue({ granted: true, accessPrivileges: 'all' });
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
    // 以前保存した asset-deleted は走査結果に現れない = 窓の中に存在しない
    mockScan(
      [createAssetMetadata('asset-1', { creationTime: 2000 }), createAssetMetadata('asset-2', { creationTime: 1000 })],
      async () => tokyoLocation,
    );

    await loadGeotaggedPhotos({ limit: 1 });

    expect(reconciliationArgument()).toEqual({
      scannedEntireLibrary: false,
      exclusiveOldestTakenAt: new Date(2000).toISOString(),
      retainedAssetIds: ['ph://asset-1'],
    });
  });

  it('ジオタグを失った写真は残す対象に含まれない', async () => {
    mockScan(
      [createAssetMetadata('asset-1', { creationTime: 2000 }), createAssetMetadata('asset-lost-geotag', { creationTime: 1000 })],
      // 位置情報の取得は成功したがジオタグが無い = 写真アプリで位置情報が外された
      async (assetId) => (assetId === 'ph://asset-1' ? tokyoLocation : null),
    );

    await loadGeotaggedPhotos();

    expect(reconciliationArgument()?.retainedAssetIds).toEqual(['ph://asset-1']);
  });

  it('位置情報の取得がrejectされた写真は残す対象に含まれ、削除されない', async () => {
    mockScan(
      [createAssetMetadata('asset-1', { creationTime: 2000 }), createAssetMetadata('asset-broken', { creationTime: 1000 })],
      async (assetId) => {
        if (assetId === 'ph://asset-broken') {
          throw new Error('broken asset');
        }

        return tokyoLocation;
      },
    );

    await loadGeotaggedPhotos();

    // 存在は確認できたがジオタグの有無を判断できないため、実在する写真の行を消してはいけない
    expect(reconciliationArgument()?.retainedAssetIds).toEqual(['ph://asset-1', 'ph://asset-broken']);
  });

  it('窓の下限はジオタグの有無を問わずページ内全アセットの最古の撮影日時になる', async () => {
    mockScan(
      [
        createAssetMetadata('asset-1', { creationTime: 3000 }),
        // ジオタグが無い写真も「見た範囲」に含まれる
        createAssetMetadata('asset-2', { creationTime: 1000 }),
        createAssetMetadata('asset-3', { creationTime: 500 }),
      ],
      async (assetId) => (assetId === 'ph://asset-1' ? tokyoLocation : null),
    );

    await loadGeotaggedPhotos({ limit: 2 });

    expect(reconciliationArgument()).toMatchObject({ exclusiveOldestTakenAt: new Date(1000).toISOString() });
  });

  it('ライブラリ末尾まで走査した場合は全期間の突き合わせになる', async () => {
    mockScan([createAssetMetadata('asset-1', { creationTime: 2000 })], async () => tokyoLocation);

    await loadGeotaggedPhotos();

    expect(reconciliationArgument()).toEqual({ scannedEntireLibrary: true, retainedAssetIds: ['ph://asset-1'] });
  });

  it('写真ライブラリが空の場合は保存済みの行をすべて削除する条件を渡す', async () => {
    mockScan([]);

    await loadGeotaggedPhotos();

    expect(savePhotoAssets).toHaveBeenCalledWith([], { scannedEntireLibrary: true, retainedAssetIds: [] });
  });

  it('窓の下限を計算できない場合は突き合わせを行わない', async () => {
    mockScan(
      [createAssetMetadata('asset-1', { creationTime: null }), createAssetMetadata('asset-2', { creationTime: null })],
      async () => tokyoLocation,
    );

    await loadGeotaggedPhotos({ limit: 1 });

    expect(reconciliationArgument()).toBeNull();
  });

  it('突き合わせを含む保存が失敗しても写真表示は継続する', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (savePhotoAssets as jest.Mock).mockRejectedValueOnce(new Error('database is locked'));
    mockScan([createAssetMetadata('asset-1', { creationTime: 2000 })], async () => tokyoLocation);

    // 保存に失敗したことは呼び出し側へ伝える(キャッシュが空でも走査結果を表示できるようにするため)
    await expect(loadGeotaggedPhotos()).resolves.toEqual(
      expect.objectContaining({
        photos: [expect.objectContaining({ id: 'ph://asset-1' })],
        isCacheSaved: false,
      }),
    );
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});

describe('写真ライブラリ権限による突き合わせの抑止 loadGeotaggedPhotos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 限定アクセスでは走査結果が「ユーザーが選択した写真」だけになり、しかも上限に満たないため
    // ライブラリを見切ったように見える。その形をそのまま突き合わせると保存済みの行がほぼ全て削除される
    mockScan([createAssetMetadata('asset-1', { creationTime: 2000 })], async () => tokyoLocation);
    mockGetPermissionsAsync.mockResolvedValue({ granted: true, accessPrivileges: 'all' });
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
    await loadGeotaggedPhotos();

    expect(reconciliationArgument()).toEqual({ scannedEntireLibrary: true, retainedAssetIds: ['ph://asset-1'] });
  });

  it('権限は参照するだけで、権限ダイアログを出さない', async () => {
    await loadGeotaggedPhotos();

    expect(mockGetPermissionsAsync).toHaveBeenCalled();
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('限定アクセスの場合は突き合わせを行わず保存だけ行う', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: true, accessPrivileges: 'limited' });

    await loadGeotaggedPhotos();

    expect(savePhotoAssets).toHaveBeenCalledWith(
      [
        {
          assetId: 'ph://asset-1',
          latitude: 35,
          longitude: 139,
          takenAt: new Date(2000).toISOString(),
          uri: 'ph://asset-1',
          width: 100,
          height: 80,
        },
      ],
      null,
    );
  });

  it('権限がnoneの場合は突き合わせを行わない', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: false, accessPrivileges: 'none' });

    await loadGeotaggedPhotos();

    expect(reconciliationArgument()).toBeNull();
  });

  it('権限が許可されていない場合は突き合わせを行わない', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: false });

    await loadGeotaggedPhotos();

    expect(reconciliationArgument()).toBeNull();
  });

  it('権限の参照に失敗した場合は安全側に倒して突き合わせを行わず、写真の読み込みは成功する', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockGetPermissionsAsync.mockRejectedValue(new Error('permission unavailable'));

    await expect(loadGeotaggedPhotos()).resolves.toEqual(
      expect.objectContaining({ photos: [expect.objectContaining({ id: 'ph://asset-1' })] }),
    );
    expect(reconciliationArgument()).toBeNull();

    warnSpy.mockRestore();
  });
});

describe('ジオタグ付き写真読み込みの診断計装', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPermissionsAsync.mockResolvedValue({ granted: true, accessPrivileges: 'all' });
  });

  it('走査件数・ジオタグ件数・所要時間をloadステージとして送る', async () => {
    mockScan(
      [
        createAssetMetadata('asset-1', { creationTime: 3000 }),
        createAssetMetadata('asset-2', { creationTime: 2000 }),
        createAssetMetadata('asset-3', { creationTime: 1000 }),
      ],
      async (assetId) => (assetId === 'ph://asset-1' ? tokyoLocation : null),
    );

    await loadGeotaggedPhotos({ limit: 2 });

    expect(reportPhotoMapDiagnostics).toHaveBeenCalledTimes(1);
    expect(reportPhotoMapDiagnostics).toHaveBeenCalledWith('load', {
      requestedLimit: 2,
      // 切り詰めたあとの件数(次ページ判定用の1件は含めない)
      scannedAssetCount: 2,
      hasNextPage: true,
      isIncrementalScan: false,
      assetInfoFulfilledCount: 2,
      assetInfoRejectedCount: 0,
      geotaggedPhotoCount: 1,
      durationMs: expect.any(Number),
    });
  });

  it('上限なしで走査した場合はrequestedLimitを0として送る', async () => {
    mockScan([createAssetMetadata('asset-1')], async () => tokyoLocation);

    await loadGeotaggedPhotos();

    // 送信キーの構成を変えずに「上限を掛けていない」ことを表す
    expect(reportPhotoMapDiagnostics).toHaveBeenCalledWith('load', expect.objectContaining({ requestedLimit: 0, hasNextPage: false }));
  });

  it('差分走査かどうかを診断へ含める', async () => {
    (getPhotoScanBaselineMs as jest.Mock).mockResolvedValue(3000);
    mockScan([createAssetMetadata('asset-1', { creationTime: 5000 })], async () => tokyoLocation);

    await loadGeotaggedPhotos({ mode: 'incremental' });

    expect(reportPhotoMapDiagnostics).toHaveBeenCalledWith('load', expect.objectContaining({ isIncrementalScan: true }));
  });

  it('位置情報取得の一部が失敗した場合はfulfilled/rejectedの件数を分けて送る', async () => {
    mockScan([createAssetMetadata('asset-1'), createAssetMetadata('asset-2'), createAssetMetadata('asset-3')], async (assetId) => {
      if (assetId !== 'ph://asset-1') {
        throw new Error('broken asset');
      }

      return tokyoLocation;
    });

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
    mockScan([createAssetMetadata('asset-1')], async () => tokyoLocation);

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
      'isIncrementalScan',
      'requestedLimit',
      'scannedAssetCount',
    ]);
    expect(Object.values(payload).every((value) => typeof value === 'number' || typeof value === 'boolean')).toBe(true);
  });
});

describe('走査上限の解決 resolvePhotoScanLimit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPermissionsAsync.mockResolvedValue({ granted: true, accessPrivileges: 'all' });
    mockScan([]);
  });

  it('上書きが無い場合は上限なし(null)になる', async () => {
    (getPhotoScanLimitOverride as jest.Mock).mockReturnValue(null);

    expect(resolvePhotoScanLimit()).toBeNull();

    await loadGeotaggedPhotos();

    // 上限を掛けないため件数の絞り込み自体を行わない(200件上限の撤廃)
    expect(mockQueryLimit).not.toHaveBeenCalled();
  });

  it('上限なしで走査した場合はライブラリを見切ったとして扱う', async () => {
    (getPhotoScanLimitOverride as jest.Mock).mockReturnValue(null);
    mockScan([createAssetMetadata('asset-1', { creationTime: 2000 })], async () => tokyoLocation);

    await loadGeotaggedPhotos();

    // 次ページ判定のプロービングは上限を掛けるときだけ必要。上限なしなら常に全期間の突き合わせになる
    expect((savePhotoAssets as jest.Mock).mock.calls[0][1]).toEqual({
      scannedEntireLibrary: true,
      retainedAssetIds: ['ph://asset-1'],
    });
  });

  it('計測用の上書きがある場合はその値を上限にする', async () => {
    (getPhotoScanLimitOverride as jest.Mock).mockReturnValue(2000);

    expect(resolvePhotoScanLimit()).toBe(2000);

    await loadGeotaggedPhotos();

    expect(mockQueryLimit).toHaveBeenCalledWith(2001);
  });

  it('引数で上限を明示した場合は上書きより引数を優先する', async () => {
    (getPhotoScanLimitOverride as jest.Mock).mockReturnValue(2000);

    await loadGeotaggedPhotos({ limit: 50 });

    expect(mockQueryLimit).toHaveBeenCalledWith(51);
  });
});

describe('走査モード loadGeotaggedPhotos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPermissionsAsync.mockResolvedValue({ granted: true, accessPrivileges: 'all' });
    mockScan([createAssetMetadata('asset-1', { creationTime: 5000 })], async () => tokyoLocation);
    (getPhotoScanBaselineMs as jest.Mock).mockResolvedValue(null);
  });

  it('全件モードでは撮影日時での絞り込みを行わない', async () => {
    await loadGeotaggedPhotos({ mode: 'full' });

    expect(mockQueryGt).not.toHaveBeenCalled();
    expect(getPhotoScanBaselineMs).not.toHaveBeenCalled();
  });

  it('差分モードでは基準時刻より新しい写真だけを要求する', async () => {
    (getPhotoScanBaselineMs as jest.Mock).mockResolvedValue(3000);

    await expect(loadGeotaggedPhotos({ mode: 'incremental' })).resolves.toEqual(expect.objectContaining({ mode: 'incremental' }));

    expect(mockQueryGt).toHaveBeenCalledWith(AssetField.CREATION_TIME, 3000);
  });

  it('差分モードでも基準時刻が無い(初回)場合は全件走査へフォールバックする', async () => {
    (getPhotoScanBaselineMs as jest.Mock).mockResolvedValue(null);

    await expect(loadGeotaggedPhotos({ mode: 'incremental' })).resolves.toEqual(expect.objectContaining({ mode: 'full' }));

    expect(mockQueryGt).not.toHaveBeenCalled();
  });

  it('差分モードでは走査した範囲だけを突き合わせ対象にする', async () => {
    (getPhotoScanBaselineMs as jest.Mock).mockResolvedValue(3000);
    mockScan(
      [createAssetMetadata('asset-1', { creationTime: 5000 }), createAssetMetadata('asset-2', { creationTime: 4000 })],
      async () => tokyoLocation,
    );

    await loadGeotaggedPhotos({ mode: 'incremental' });

    // 基準時刻より古い範囲は走査していない。全期間扱いにするとキャッシュ済みの古い写真を全部消してしまう
    expect((savePhotoAssets as jest.Mock).mock.calls[0][1]).toEqual({
      scannedEntireLibrary: false,
      exclusiveOldestTakenAt: new Date(4000).toISOString(),
      retainedAssetIds: ['ph://asset-1', 'ph://asset-2'],
    });
  });

  it('差分モードで新しい写真が1枚も無い場合は突き合わせを行わない', async () => {
    (getPhotoScanBaselineMs as jest.Mock).mockResolvedValue(3000);
    mockScan([]);

    await loadGeotaggedPhotos({ mode: 'incremental' });

    // 走査範囲の下限を計算できないため、保存済みの行を消してはいけない
    expect(savePhotoAssets).toHaveBeenCalledWith([], null);
  });

  it('保存に成功した場合は走査した最新の撮影日時を次回の基準時刻として保存する', async () => {
    mockScan(
      [createAssetMetadata('asset-1', { creationTime: 5000 }), createAssetMetadata('asset-2', { creationTime: 4000 })],
      async () => tokyoLocation,
    );

    await loadGeotaggedPhotos({ mode: 'full' });

    expect(savePhotoScanBaselineMs).toHaveBeenCalledWith(5000);
  });

  it('保存に失敗した場合は基準時刻を進めない', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (savePhotoAssets as jest.Mock).mockRejectedValueOnce(new Error('database is locked'));

    await loadGeotaggedPhotos({ mode: 'full' });

    // 進めてしまうと、保存できなかった範囲を差分走査が二度と拾えなくなる
    expect(savePhotoScanBaselineMs).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('基準時刻の保存に失敗しても走査結果は返す', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (savePhotoScanBaselineMs as jest.Mock).mockRejectedValueOnce(new Error('database is locked'));

    await expect(loadGeotaggedPhotos({ mode: 'full' })).resolves.toEqual(
      expect.objectContaining({ photos: [expect.objectContaining({ id: 'ph://asset-1' })], isCacheSaved: true }),
    );
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('走査結果から基準時刻を算出できない場合は保存しない', async () => {
    mockScan([createAssetMetadata('asset-1', { creationTime: null })], async () => tokyoLocation);

    await loadGeotaggedPhotos({ mode: 'full' });

    expect(savePhotoScanBaselineMs).not.toHaveBeenCalled();
  });
});

describe('走査コストの計測 loadGeotaggedPhotos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPermissionsAsync.mockResolvedValue({ granted: true, accessPrivileges: 'all' });
  });

  it('走査件数・ジオタグ件数・位置情報の失敗件数を計測値として返す', async () => {
    mockScan([createAssetMetadata('asset-1'), createAssetMetadata('asset-2'), createAssetMetadata('asset-3')], async (assetId) => {
      if (assetId === 'ph://asset-3') {
        throw new Error('broken asset');
      }

      return assetId === 'ph://asset-1' ? tokyoLocation : null;
    });

    const { metrics } = await loadGeotaggedPhotos();

    expect(metrics.scannedAssetCount).toBe(3);
    expect(metrics.geotaggedPhotoCount).toBe(1);
    expect(metrics.locationRejectedCount).toBe(1);
  });

  it('走査コストを外挿できるよう所要時間を内訳ごとに返す', async () => {
    mockScan([createAssetMetadata('asset-1')], async () => tokyoLocation);

    const { metrics } = await loadGeotaggedPhotos();

    expect(metrics.metadataDurationMs).toEqual(expect.any(Number));
    expect(metrics.locationDurationMs).toEqual(expect.any(Number));
    expect(metrics.saveDurationMs).toEqual(expect.any(Number));
    expect(metrics.totalDurationMs).toEqual(expect.any(Number));
    expect(metrics.metadataDurationMs).toBeGreaterThanOrEqual(0);
    expect(metrics.totalDurationMs).toBeGreaterThanOrEqual(metrics.metadataDurationMs);
  });

  it('上限で切り詰めた場合は切り詰めたあとの件数を走査件数にする', async () => {
    mockScan([createAssetMetadata('asset-1'), createAssetMetadata('asset-2'), createAssetMetadata('asset-3')], async () => tokyoLocation);

    const { metrics } = await loadGeotaggedPhotos({ limit: 2 });

    // 次ページ判定用に取得した3件目は走査対象ではない
    expect(metrics.scannedAssetCount).toBe(2);
    expect(metrics.geotaggedPhotoCount).toBe(2);
  });

  it('保存に失敗した場合も計測値は返す', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (savePhotoAssets as jest.Mock).mockRejectedValueOnce(new Error('database is locked'));
    mockScan([createAssetMetadata('asset-1')], async () => tokyoLocation);

    const { metrics } = await loadGeotaggedPhotos();

    expect(metrics.scannedAssetCount).toBe(1);
    expect(metrics.saveDurationMs).toEqual(expect.any(Number));

    warnSpy.mockRestore();
  });
});
