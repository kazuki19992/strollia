import { db, withExclusiveTransaction } from '@/db/database';
import { NewLocationPoint } from '@/types/gps';
import {
  deleteAllUserData,
  getDailyLogs,
  getLocationPointsBounds,
  getLocationPointsByMonth,
  insertLocationPoint,
} from '@/features/logs/logRepository';

const mockTxn = {
  runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 100 }),
};

jest.mock('@/db/database', () => ({
  db: {
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 100 }),
  },
  withExclusiveTransaction: jest.fn(async (callback: (txn: typeof mockTxn) => Promise<void>) => callback(mockTxn)),
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

  it('日別距離は記録時の有効座標で計算する', async () => {
    (db.getFirstAsync as jest.Mock).mockResolvedValue({
      ...point(35, 139),
      id: 1,
      effectiveLatitude: 35,
      effectiveLongitude: 139,
      snappedStayPlaceId: 1,
    });
    const snappedPoint = {
      ...point(35.001, 139.001),
      effectiveLatitude: 35,
      effectiveLongitude: 139,
      snappedStayPlaceId: 1,
    } as NewLocationPoint;

    await insertLocationPoint(snappedPoint);

    const dailySummaryArgs = mockTxn.runAsync.mock.calls[1];
    expect(dailySummaryArgs[4]).toBe(0);
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

  it('GPSログ、滞在場所、行政区域履歴、実績関連データを1つのトランザクションで削除する', async () => {
    await deleteAllUserData();

    expect(withExclusiveTransaction).toHaveBeenCalledTimes(1);
    expect(mockTxn.runAsync).toHaveBeenNthCalledWith(1, 'DELETE FROM visited_cells');
    expect(mockTxn.runAsync).toHaveBeenNthCalledWith(2, 'DELETE FROM achievement_notification_queue');
    expect(mockTxn.runAsync).toHaveBeenNthCalledWith(3, 'DELETE FROM achievement_unlocks');
    expect(mockTxn.runAsync).toHaveBeenNthCalledWith(4, 'DELETE FROM visited_admin_areas');
    expect(mockTxn.runAsync).toHaveBeenNthCalledWith(5, 'DELETE FROM location_point_admin_areas');
    expect(mockTxn.runAsync).toHaveBeenNthCalledWith(6, 'DELETE FROM stay_places');
    expect(mockTxn.runAsync).toHaveBeenNthCalledWith(7, 'DELETE FROM location_points');
    expect(mockTxn.runAsync).toHaveBeenNthCalledWith(8, 'DELETE FROM daily_logs');
  });
});

describe('GPSポイント境界 getLocationPointsBounds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('有効な座標の範囲と件数を返す', async () => {
    (db.getFirstAsync as jest.Mock).mockResolvedValue({
      minLatitude: 35,
      maxLatitude: 36,
      minLongitude: 139,
      maxLongitude: 140,
      pointCount: 5,
    });

    await expect(getLocationPointsBounds()).resolves.toEqual({
      minLatitude: 35,
      maxLatitude: 36,
      minLongitude: 139,
      maxLongitude: 140,
      pointCount: 5,
    });
  });

  it('有効ポイントが0件の場合はnullを返す', async () => {
    (db.getFirstAsync as jest.Mock).mockResolvedValue({
      minLatitude: null,
      maxLatitude: null,
      minLongitude: null,
      maxLongitude: null,
      pointCount: 0,
    });

    await expect(getLocationPointsBounds()).resolves.toBeNull();
  });
});

describe('月別ポイント取得 getLocationPointsByMonth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('指定月のプレフィックスでポイントを絞り込む', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValue([]);

    await getLocationPointsByMonth('2026-05');

    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('local_date LIKE ?'), '2026-05-%');
  });
});
