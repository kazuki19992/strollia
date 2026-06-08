import { db } from '../../../db/database';
import { importLocationPointsFromGpx } from '../importRepository';

let mockActiveTransactionDepth = 0;

jest.mock('../../../db/database', () => {
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
    withExclusiveTransactionAsync: jest.fn(async (callback: (txn: typeof mockDb) => Promise<void>) => {
      mockActiveTransactionDepth += 1;

      try {
        await callback(mockDb);
      } finally {
        mockActiveTransactionDepth -= 1;
      }
    }),
  };

  return { db: mockDb };
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

    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(db.withTransactionAsync).not.toHaveBeenCalled();
  });
});
