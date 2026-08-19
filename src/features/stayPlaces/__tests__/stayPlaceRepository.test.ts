import { db, withExclusiveTransaction } from '@/db/database';
import { createStayPlace, deleteStayPlace, getStayPlaces, updateStayPlace } from '@/features/stayPlaces/stayPlaceRepository';

const mockTxn = {
  runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 42 }),
};

jest.mock('@/db/database', () => ({
  db: {
    getAllAsync: jest.fn(),
  },
  withExclusiveTransaction: jest.fn(async (callback: (txn: typeof mockTxn) => Promise<void>) => callback(mockTxn)),
}));

const validInput = {
  name: '自宅',
  iconHexcode: '1F3E0',
  latitude: 35.681236,
  longitude: 139.767125,
  privacyRadiusMeters: null,
};

describe('滞在場所リポジトリ stayPlaceRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('作成日時とIDの昇順で滞在場所を取得する', async () => {
    const oldest = {
      id: 1,
      name: '自宅',
      iconHexcode: '1F3E0',
      latitude: 35,
      longitude: 139,
      privacyRadiusMeters: null,
      createdAt: '2026-08-19T00:00:00.000Z',
      updatedAt: '2026-08-19T00:00:00.000Z',
    };
    const newest = { ...oldest, id: 2, name: '職場', createdAt: '2026-08-20T00:00:00.000Z' };
    (db.getAllAsync as jest.Mock).mockResolvedValue([oldest, newest]);

    await expect(getStayPlaces()).resolves.toEqual([oldest, newest]);
    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('ORDER BY created_at ASC, id ASC'));
  });

  it.each([
    ['空の名称', { ...validInput, name: '' }, '滞在場所名'],
    ['空白だけの名称', { ...validInput, name: '   ' }, '滞在場所名'],
    ['未登録のicon_hexcode', { ...validInput, iconHexcode: 'UNKNOWN' }, 'アイコン'],
    ['直接入力した絵文字', { ...validInput, iconHexcode: '🏠' }, 'アイコン'],
    ['小文字のicon_hexcode', { ...validInput, iconHexcode: '1f3e0' }, 'アイコン'],
    ['無限の緯度', { ...validInput, latitude: Infinity }, '緯度'],
    ['NaNの経度', { ...validInput, longitude: Number.NaN }, '経度'],
    ['上限を超える有限の緯度', { ...validInput, latitude: 90.000001 }, '緯度'],
    ['下限を下回る有限の緯度', { ...validInput, latitude: -90.000001 }, '緯度'],
    ['上限を超える有限の経度', { ...validInput, longitude: 180.000001 }, '経度'],
    ['下限を下回る有限の経度', { ...validInput, longitude: -180.000001 }, '経度'],
    ['許可されない半径', { ...validInput, privacyRadiusMeters: 400 }, '共有時の非表示範囲'],
  ])('%sはSQLを実行せず拒否する', async (_label, input, message) => {
    await expect(createStayPlace(input)).rejects.toThrow(message);

    expect(withExclusiveTransaction).not.toHaveBeenCalled();
    expect(mockTxn.runAsync).not.toHaveBeenCalled();
  });

  it.each([50, 100, 200, 300, 500])('許可済みの非表示半径 %dm を作成できる', async (privacyRadiusMeters) => {
    await expect(createStayPlace({ ...validInput, privacyRadiusMeters })).resolves.toBe(42);

    expect(withExclusiveTransaction).toHaveBeenCalledTimes(1);
    expect(mockTxn.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO stay_places'),
      validInput.name,
      validInput.iconHexcode,
      validInput.latitude,
      validInput.longitude,
      privacyRadiusMeters,
      expect.any(String),
      expect.any(String),
    );
  });

  it.each([
    ['緯度と経度の上限', 90, 180],
    ['緯度と経度の下限', -90, -180],
  ])('%sは保存できる', async (_label, latitude, longitude) => {
    await expect(createStayPlace({ ...validInput, latitude, longitude })).resolves.toBe(42);

    expect(withExclusiveTransaction).toHaveBeenCalledTimes(1);
  });

  it('登録を排他トランザクション内で実行してIDを返す', async () => {
    await expect(createStayPlace(validInput)).resolves.toBe(42);

    expect(withExclusiveTransaction).toHaveBeenCalledTimes(1);
    expect(mockTxn.runAsync).toHaveBeenCalledTimes(1);
  });

  it('更新を排他トランザクション内で実行し作成日時を変更しない', async () => {
    await expect(updateStayPlace(7, { ...validInput, name: '新しい自宅', privacyRadiusMeters: 100 })).resolves.toBeUndefined();

    expect(withExclusiveTransaction).toHaveBeenCalledTimes(1);
    expect(mockTxn.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE stay_places'),
      '新しい自宅',
      validInput.iconHexcode,
      validInput.latitude,
      validInput.longitude,
      100,
      expect.any(String),
      7,
    );
    expect(mockTxn.runAsync.mock.calls[0][0]).not.toContain('created_at');
  });

  it('削除を排他トランザクション内で実行する', async () => {
    await expect(deleteStayPlace(7)).resolves.toBeUndefined();

    expect(withExclusiveTransaction).toHaveBeenCalledTimes(1);
    expect(mockTxn.runAsync).toHaveBeenCalledWith('DELETE FROM stay_places WHERE id = ?', 7);
  });
});
