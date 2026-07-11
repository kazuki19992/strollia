import { db, withExclusiveTransaction } from '@/db/database';
import { importLocationPointsFromGpx } from '@/features/import/importRepository';

let mockActiveTransactionDepth = 0;

export const mockTxn = {
  runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 101 }),
  getFirstAsync: jest.fn(),
};

jest.mock('@/db/database', () => {
  const mockDb = {
    getFirstAsync: jest.fn(),
    runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 101 }),
    withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => {
      if (mockActiveTransactionDepth > 0) {
        throw new Error('cannot rollback - no transaction is active');
      }

      mockActiveTransactionDepth += 1;

      try {
        await callback();
      } finally {
        mockActiveTransactionDepth -= 1;
      }
    }),
  };

  const mockWithExclusiveTransaction = jest.fn(async (callback: (txn: typeof mockTxn) => Promise<void>) => {
    mockActiveTransactionDepth += 1;

    try {
      await callback(mockTxn);
    } finally {
      mockActiveTransactionDepth -= 1;
    }
  });

  return { db: mockDb, withExclusiveTransaction: mockWithExclusiveTransaction };
});

const point = {
  recordedAt: '2026-05-25T16:11:36.072Z',
  localDate: '2026-05-26',
  latitude: 35.720892715462945,
  longitude: 139.9792199073953,
  altitude: 26.912135388426215,
  speed: null,
  heading: null,
  accuracy: null,
  altitudeAccuracy: null,
};

describe('GPXインポート保存 transaction境界', () => {
  beforeEach(() => {
    mockActiveTransactionDepth = 0;
    jest.clearAllMocks();
    (db.getFirstAsync as jest.Mock).mockResolvedValue(null);
  });

  it('visited cell更新でtransactionをネストしない', async () => {
    await expect(importLocationPointsFromGpx([point], 'strollia-all.gpx')).resolves.toEqual({
      importedPointCount: 1,
      skippedPointCount: 0,
    });
  });

  it('並行するDB操作に割り込まれないよう排他トランザクションを使用する', async () => {
    await importLocationPointsFromGpx([point], 'strollia-all.gpx');

    expect(withExclusiveTransaction).toHaveBeenCalledTimes(1);
    expect(db.withTransactionAsync).not.toHaveBeenCalled();
  });

  it('トランザクション内の書き込みはすべて txn 経由で行う', async () => {
    await importLocationPointsFromGpx([point], 'strollia-all.gpx');

    expect(mockTxn.runAsync).toHaveBeenCalled();
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  it('500件を超えるポイントはトランザクションを分割する(バックグラウンドGPS記録の書き込みを長時間ブロックしないため)', async () => {
    const manyPoints = Array.from({ length: 501 }, (_, index) => ({
      ...point,
      recordedAt: `2026-05-25T16:${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}.000Z`,
    }));

    await expect(importLocationPointsFromGpx(manyPoints, 'strollia-all.gpx')).resolves.toEqual({
      importedPointCount: 501,
      skippedPointCount: 0,
    });

    // 501件 = 500 + 1 で2トランザクションに分割される
    expect(withExclusiveTransaction).toHaveBeenCalledTimes(2);

    // インポート履歴は最後のチャンクで1回だけ記録する
    const historyInsertCalls = mockTxn.runAsync.mock.calls.filter((call) => String(call[0]).includes('import_history'));
    expect(historyInsertCalls).toHaveLength(1);
  });

  it('500件以下のポイントは1トランザクションで取り込む', async () => {
    const fewPoints = Array.from({ length: 500 }, (_, index) => ({
      ...point,
      recordedAt: `2026-05-25T16:${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}.000Z`,
    }));

    await importLocationPointsFromGpx(fewPoints, 'strollia-all.gpx');

    expect(withExclusiveTransaction).toHaveBeenCalledTimes(1);
  });
});
