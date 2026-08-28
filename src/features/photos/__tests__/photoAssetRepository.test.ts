import { db, withExclusiveTransaction } from '@/db/database';
import {
  getPhotoAssetsInBounds,
  PHOTO_VIEWPORT_SAFETY_LIMIT,
  savePhotoAssets,
  type PhotoAssetRecord,
} from '@/features/photos/photoAssetRepository';
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

describe('写真メタデータリポジトリ savePhotoAssets の走査済み窓との突き合わせ', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * 発行されたDELETE文とそのパラメータを取り出す。
   *
   * UPSERTとDELETEが同じ `runAsync` で発行されるため、SQL先頭で判別する。
   *
   * @returns DELETE文のSQLとパラメータ。発行されていない場合はnull。
   */
  function findDeleteCall(): { sql: string; params: unknown[] } | null {
    const call = mockTxn.runAsync.mock.calls.find((args) => String(args[0]).trimStart().startsWith('DELETE'));

    return call ? { sql: call[0] as string, params: call.slice(1) } : null;
  }

  it('突き合わせを渡さない場合は削除を行わない', async () => {
    await savePhotoAssets([record()]);

    expect(findDeleteCall()).toBeNull();
  });

  it('保存と削除を同一トランザクションで行う', async () => {
    await savePhotoAssets([record()], { scannedEntireLibrary: true, retainedAssetIds: ['asset-1'] });

    expect(withExclusiveTransaction).toHaveBeenCalledTimes(1);
    expect(mockTxn.runAsync).toHaveBeenCalledTimes(2);
    expect(findDeleteCall()).not.toBeNull();
  });

  it('保存対象が空でも突き合わせがあればトランザクションを開く', async () => {
    await savePhotoAssets([], { scannedEntireLibrary: true, retainedAssetIds: [] });

    expect(withExclusiveTransaction).toHaveBeenCalledTimes(1);
    expect(findDeleteCall()?.sql).toContain('DELETE FROM photo_assets');
  });

  it('窓が部分的な場合は下限より新しくかつ残す対象以外の行だけを削除する', async () => {
    await savePhotoAssets([], {
      scannedEntireLibrary: false,
      exclusiveOldestTakenAt: '2026-08-01T00:00:00.000Z',
      retainedAssetIds: ['asset-1', 'asset-2'],
    });

    const deleteCall = findDeleteCall();
    expect(deleteCall?.sql).toContain('taken_at > ?');
    expect(deleteCall?.sql).toContain('asset_id NOT IN (?, ?)');
    expect(deleteCall?.params).toEqual(['2026-08-01T00:00:00.000Z', 'asset-1', 'asset-2']);
  });

  it('窓の下限と同じ撮影日時の行は削除しない(ページ境界の同時刻写真を消さないため)', async () => {
    await savePhotoAssets([], {
      scannedEntireLibrary: false,
      exclusiveOldestTakenAt: '2026-08-01T00:00:00.000Z',
      retainedAssetIds: [],
    });

    // creationTime は一意なカーソルではないため、境界時刻ちょうどの行は
    // 「未走査の次ページに実在する写真」でありうる。両端閉区間(>=)にすると実在する写真を消す
    expect(findDeleteCall()?.sql).not.toContain('taken_at >= ?');
    expect(findDeleteCall()?.sql).toContain('taken_at > ?');
  });

  it('窓が部分的な場合はtaken_atがNULLの行を削除対象にしない', async () => {
    await savePhotoAssets([], {
      scannedEntireLibrary: false,
      exclusiveOldestTakenAt: '2026-08-01T00:00:00.000Z',
      retainedAssetIds: [],
    });

    // 窓の内外を判定できないため、撮影日時不明の行は安全側で残す
    expect(findDeleteCall()?.sql).toContain('taken_at IS NOT NULL');
  });

  it('ライブラリ末尾まで走査した場合はtaken_atがNULLの行も突き合わせ対象にする', async () => {
    await savePhotoAssets([], { scannedEntireLibrary: true, retainedAssetIds: ['asset-1'] });

    const deleteCall = findDeleteCall();
    expect(deleteCall?.sql).not.toContain('taken_at');
    expect(deleteCall?.sql).toContain('asset_id NOT IN (?)');
    expect(deleteCall?.params).toEqual(['asset-1']);
  });

  it('ライブラリ末尾まで走査して残す対象が無い場合は全行を削除する', async () => {
    await savePhotoAssets([], { scannedEntireLibrary: true, retainedAssetIds: [] });

    const deleteCall = findDeleteCall();
    // NOT IN () は構文エラーになるため、条件そのものを付けない
    expect(deleteCall?.sql).not.toContain('NOT IN');
    expect(deleteCall?.sql).not.toContain('WHERE');
    expect(deleteCall?.params).toEqual([]);
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
    expect(params).toEqual([34, 36, 138, 140, PHOTO_VIEWPORT_SAFETY_LIMIT]);
  });

  it('日付変更線をまたぐ場合はBETWEENではなくOR条件で絞り込む', async () => {
    await getPhotoAssetsInBounds(bounds({ westLongitude: 170, eastLongitude: -170, crossesAntimeridian: true }));

    const [sql, ...params] = (db.getAllAsync as jest.Mock).mock.calls[0];
    // min > max の BETWEEN は空集合になるため、OR条件へ分岐する必要がある
    expect(sql).not.toContain('longitude BETWEEN ? AND ?');
    expect(sql).toContain('(longitude >= ? OR longitude <= ?)');
    expect(params).toEqual([34, 36, 170, -170, PHOTO_VIEWPORT_SAFETY_LIMIT]);
  });

  it('取得した行をcamelCaseのレコードとして返す', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValue([record()]);

    await expect(getPhotoAssetsInBounds(bounds())).resolves.toEqual([record()]);
  });

  it('新しい撮影日時の順で返す', async () => {
    await getPhotoAssetsInBounds(bounds());

    const [sql] = (db.getAllAsync as jest.Mock).mock.calls[0];
    expect(sql).toContain('ORDER BY taken_at DESC');
  });
});

describe('ビューポート検索の上限 getPhotoAssetsInBounds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (db.getAllAsync as jest.Mock).mockResolvedValue([]);
  });

  it('表示上限を指定しない場合でも内部の安全上限を掛ける', async () => {
    await getPhotoAssetsInBounds(bounds());

    const [sql, ...params] = (db.getAllAsync as jest.Mock).mock.calls[0];
    // 設定が「すべて」でも、一度にJSへ載る件数はユーザーから見えない保険で抑える
    expect(sql).toContain('LIMIT ?');
    expect(params).toEqual([34, 36, 138, 140, PHOTO_VIEWPORT_SAFETY_LIMIT]);
  });

  it('表示上限は表示範囲ごとではなく全体の最新N件へ掛ける', async () => {
    await getPhotoAssetsInBounds(bounds(), { displayLimit: 200 });

    const [sql, ...params] = (db.getAllAsync as jest.Mock).mock.calls[0];
    // 「表示範囲ごとに最新200件」ではなく「全体の最新200件のうち表示範囲に入るもの」。
    // 先に範囲で絞ってから200件にすると、設定のラベルと挙動が食い違う
    expect(sql).toMatch(/FROM \(\s*SELECT \* FROM photo_assets\s+ORDER BY taken_at DESC\s+LIMIT \?/);
    expect(params[0]).toBe(200);
    expect(params.slice(1)).toEqual([34, 36, 138, 140, PHOTO_VIEWPORT_SAFETY_LIMIT]);
  });

  it('表示上限つきでも日付変更線をまたぐ場合のOR条件を保つ', async () => {
    await getPhotoAssetsInBounds(bounds({ westLongitude: 170, eastLongitude: -170, crossesAntimeridian: true }), { displayLimit: 1000 });

    const [sql, ...params] = (db.getAllAsync as jest.Mock).mock.calls[0];
    expect(sql).toContain('(longitude >= ? OR longitude <= ?)');
    expect(params).toEqual([1000, 34, 36, 170, -170, PHOTO_VIEWPORT_SAFETY_LIMIT]);
  });

  it('表示上限が安全上限より小さい場合でも安全上限は据え置く(結果は表示上限で決まる)', async () => {
    await getPhotoAssetsInBounds(bounds(), { displayLimit: 200 });

    const [, ...params] = (db.getAllAsync as jest.Mock).mock.calls[0];
    expect(params[params.length - 1]).toBe(PHOTO_VIEWPORT_SAFETY_LIMIT);
  });
});
