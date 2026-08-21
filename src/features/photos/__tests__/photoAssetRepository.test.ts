import { db, withExclusiveTransaction } from '@/db/database';
import { getPhotoAssetsInBounds, savePhotoAssets, type PhotoAssetRecord } from '@/features/photos/photoAssetRepository';
import type { PhotoViewportBounds } from '@/features/photos/photoViewportBounds';

/** トランザクションrunnerのモック。withExclusiveTransaction のコールバックへ渡す。 */
const mockTxn = {
  runAsync: jest.fn(),
};

jest.mock('@/db/database', () => ({
  db: {
    getAllAsync: jest.fn(),
  },
  // busy_timeout付き排他トランザクション(database.tsのラッパー)。txnランナーを直接渡す
  withExclusiveTransaction: jest.fn(async (callback: (txn: typeof mockTxn) => Promise<void>) => callback(mockTxn)),
}));

/** テスト用の保存レコードを作る。 */
function record(overrides: Partial<PhotoAssetRecord> = {}): PhotoAssetRecord {
  return {
    assetId: 'asset-1',
    latitude: 35,
    longitude: 139,
    takenAt: '2026-08-21T00:00:00.000Z',
    uri: 'ph://asset-1',
    width: 4032,
    height: 3024,
    ...overrides,
  };
}

/** テスト用のビューポート境界を作る。 */
function bounds(overrides: Partial<PhotoViewportBounds> = {}): PhotoViewportBounds {
  return {
    minLatitude: 34,
    maxLatitude: 36,
    westLongitude: 138,
    eastLongitude: 140,
    crossesAntimeridian: false,
    ...overrides,
  };
}

describe('写真メタデータリポジトリ savePhotoAssets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('保存対象が空の場合はトランザクションを開かない', async () => {
    await savePhotoAssets([]);

    expect(withExclusiveTransaction).not.toHaveBeenCalled();
  });

  it('複数件を1つのトランザクションでまとめて保存する', async () => {
    await savePhotoAssets([record(), record({ assetId: 'asset-2' })]);

    expect(withExclusiveTransaction).toHaveBeenCalledTimes(1);
    expect(mockTxn.runAsync).toHaveBeenCalledTimes(2);
  });

  it('同じasset_idを再保存しても行が増えないUPSERT文で保存する', async () => {
    await savePhotoAssets([record()]);

    const sql = mockTxn.runAsync.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO photo_assets');
    expect(sql).toContain('ON CONFLICT(asset_id) DO UPDATE SET');
  });

  it('created_atは初回保存時の値を保ち、updated_atとlast_seen_atだけを更新する', async () => {
    await savePhotoAssets([record()]);

    const sql = mockTxn.runAsync.mock.calls[0][0] as string;
    expect(sql).not.toContain('created_at = excluded.created_at');
    expect(sql).toContain('updated_at = excluded.updated_at');
    expect(sql).toContain('last_seen_at = excluded.last_seen_at');
  });

  it('安定したuriと撮影日時を含めて保存する', async () => {
    await savePhotoAssets([record()]);

    const params = mockTxn.runAsync.mock.calls[0].slice(1);
    expect(params.slice(0, 7)).toEqual(['asset-1', 35, 139, '2026-08-21T00:00:00.000Z', 'ph://asset-1', 4032, 3024]);
    // last_seen_at / created_at / updated_at は同一の保存時刻
    expect(params[7]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(params[8]).toBe(params[7]);
    expect(params[9]).toBe(params[7]);
  });

  it('撮影日時が不明な写真もnullとして保存する', async () => {
    await savePhotoAssets([record({ takenAt: null })]);

    const params = mockTxn.runAsync.mock.calls[0].slice(1);
    expect(params[3]).toBeNull();
  });
});

describe('写真メタデータリポジトリ getPhotoAssetsInBounds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (db.getAllAsync as jest.Mock).mockResolvedValue([]);
  });

  it('緯度経度の範囲で絞り込む', async () => {
    await getPhotoAssetsInBounds(bounds());

    const [sql, ...params] = (db.getAllAsync as jest.Mock).mock.calls[0];
    expect(sql).toContain('FROM photo_assets');
    expect(sql).toContain('latitude BETWEEN ? AND ?');
    expect(sql).toContain('longitude BETWEEN ? AND ?');
    expect(params).toEqual([34, 36, 138, 140]);
  });

  it('日付変更線をまたぐ場合はBETWEENではなくOR条件で絞り込む', async () => {
    await getPhotoAssetsInBounds(bounds({ westLongitude: 170, eastLongitude: -170, crossesAntimeridian: true }));

    const [sql, ...params] = (db.getAllAsync as jest.Mock).mock.calls[0];
    // min > max の BETWEEN は空集合になるため、OR条件へ分岐する必要がある
    expect(sql).not.toContain('longitude BETWEEN ? AND ?');
    expect(sql).toContain('(longitude >= ? OR longitude <= ?)');
    expect(params).toEqual([34, 36, 170, -170]);
  });

  it('取得した行をcamelCaseのレコードとして返す', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValue([record()]);

    await expect(getPhotoAssetsInBounds(bounds())).resolves.toEqual([record()]);
  });
});
