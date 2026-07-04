import { db } from '@/db/database';
import { NewLocationPoint } from '@/types/gps';
import { deleteAllUserData, getDailyLogs, insertLocationPoint } from '@/features/logs/logRepository';

const mockTxn = {
  runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 100 }),
};

jest.mock('@/db/database', () => ({
  db: {
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    withExclusiveTransactionAsync: jest.fn(async (callback: (txn: typeof mockTxn) => Promise<void>) => callback(mockTxn)),
    runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 100 }),
  },
}));

function point(latitude: number, longitude: number): NewLocationPoint {
  return {
    recordedAt: '2026-05-05T00:00:00.000Z',
    localDate: '2026-05-05',
    latitude,
    longitude,
    altitude: null,
    speed: null,
    heading: null,
    accuracy: 10,
    altitudeAccuracy: null,
  };
}

describe('GPSポイント保存 insertLocationPoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('日別サマリーへ区間距離を累積保存する', async () => {
    (db.getFirstAsync as jest.Mock).mockResolvedValue({
      ...point(35, 139),
      id: 1,
    });

    await expect(insertLocationPoint(point(35.001, 139))).resolves.toBe(100);

    expect(mockTxn.runAsync).toHaveBeenCalledTimes(2);
    const dailySummaryArgs = mockTxn.runAsync.mock.calls[1];
    expect(dailySummaryArgs[4]).toBeGreaterThan(100);
    expect(dailySummaryArgs[4]).toBeLessThan(120);
  });
});

describe('日別ログ一覧 getDailyLogs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('開始地点と終了地点のGPSポイントIDを含めて取得する', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValue([
      {
        localDate: '2026-05-31',
        pointCount: 2,
        startedAt: '2026-05-31T00:00:00.000Z',
        endedAt: '2026-05-31T00:30:00.000Z',
        distanceMeters: 100,
        startLocationPointId: 10,
        endLocationPointId: 20,
      },
    ]);

    await expect(getDailyLogs()).resolves.toEqual([
      expect.objectContaining({
        localDate: '2026-05-31',
        startLocationPointId: 10,
        endLocationPointId: 20,
      }),
    ]);
    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('startLocationPointId'));
    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('endLocationPointId'));
  });
});

describe('全ユーザーデータ削除 deleteAllUserData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GPSログ、行政区域履歴、実績関連データを1つのトランザクションで削除する', async () => {
    await deleteAllUserData();

    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(mockTxn.runAsync).toHaveBeenNthCalledWith(1, 'DELETE FROM visited_cells');
    expect(mockTxn.runAsync).toHaveBeenNthCalledWith(2, 'DELETE FROM achievement_notification_queue');
    expect(mockTxn.runAsync).toHaveBeenNthCalledWith(3, 'DELETE FROM achievement_unlocks');
    expect(mockTxn.runAsync).toHaveBeenNthCalledWith(4, 'DELETE FROM visited_admin_areas');
    expect(mockTxn.runAsync).toHaveBeenNthCalledWith(5, 'DELETE FROM location_point_admin_areas');
    expect(mockTxn.runAsync).toHaveBeenNthCalledWith(6, 'DELETE FROM location_points');
    expect(mockTxn.runAsync).toHaveBeenNthCalledWith(7, 'DELETE FROM daily_logs');
  });
});
