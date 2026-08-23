import { db, withExclusiveTransaction } from '@/db/database';
import { LocationPoint, NewLocationPoint } from '@/types/gps';
import {
  deleteAllUserData,
  getDailyLogs,
  getLocationPointsBounds,
  getLocationPointsByMonth,
  insertLocationPointInCurrentTransaction,
} from '@/features/logs/logRepository';

const mockTxn = {
  getFirstAsync: jest.fn(),
  runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 100, changes: 1 }),
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

describe('GPSポイント保存 insertLocationPointInCurrentTransaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('日別サマリーへ区間距離を累積保存する', async () => {
    mockTxn.getFirstAsync.mockResolvedValueOnce({
      ...point(35, 139),
      id: 1,
    });
    mockTxn.getFirstAsync.mockResolvedValueOnce(null);

    await expect(
      insertLocationPointInCurrentTransaction(point(35.001, 139), '2026-08-23T00:00:30.000Z', mockTxn as never),
    ).resolves.toEqual(expect.objectContaining({ locationPointId: 100 }));

    expect(mockTxn.runAsync).toHaveBeenCalledTimes(2);
    const dailySummaryArgs = mockTxn.runAsync.mock.calls[1];
    expect(dailySummaryArgs[4]).toBeGreaterThan(100);
    expect(dailySummaryArgs[4]).toBeLessThan(120);
  });

  it('日別距離は記録時の有効座標で計算する', async () => {
    mockTxn.getFirstAsync.mockResolvedValueOnce({
      ...point(35, 139),
      id: 1,
      effectiveLatitude: 35,
      effectiveLongitude: 139,
      snappedStayPlaceId: 1,
    });
    mockTxn.getFirstAsync.mockResolvedValueOnce(null);
    const snappedPoint = {
      ...point(35.001, 139.001),
      effectiveLatitude: 35,
      effectiveLongitude: 139,
      snappedStayPlaceId: 1,
    } as NewLocationPoint;

    await insertLocationPointInCurrentTransaction(snappedPoint, '2026-08-23T00:00:30.000Z', mockTxn as never);

    const dailySummaryArgs = mockTxn.runAsync.mock.calls[1];
    expect(dailySummaryArgs[4]).toBe(0);
  });

  it('前後点の読取・GPS挿入・日別距離更新を同じrunnerで行う', async () => {
    const previousPoint: LocationPoint = { ...point(35, 139), id: 1 };
    const nextPoint: LocationPoint = { ...point(35.002, 139.002), id: 2 };
    const newPoint = point(35.001, 139.001);
    mockTxn.runAsync.mockResolvedValueOnce({ lastInsertRowId: 100, changes: 1 }).mockResolvedValueOnce({ changes: 1 });
    mockTxn.getFirstAsync.mockResolvedValueOnce(previousPoint).mockResolvedValueOnce(nextPoint);

    const result = await insertLocationPointInCurrentTransaction(newPoint, '2026-08-23T00:00:30.000Z', mockTxn as never);

    expect(result).toEqual(expect.objectContaining({ locationPointId: 100, previousPoint, nextPoint }));
    expect(mockTxn.getFirstAsync).toHaveBeenCalledTimes(2);
    const insertSql = mockTxn.runAsync.mock.calls[0][0] as string;
    const dailySql = mockTxn.runAsync.mock.calls[1][0] as string;
    const normalizedDailySql = dailySql.replace(/\s+/g, ' ').trim();
    expect(insertSql).not.toContain('INSERT OR IGNORE');
    expect(insertSql).toContain('ON CONFLICT(recorded_at, latitude, longitude) DO NOTHING');
    expect(normalizedDailySql).toContain('WHEN daily_logs.distance_meters IS NULL THEN NULL');
    expect(normalizedDailySql).toContain('ELSE daily_logs.distance_meters + excluded.distance_meters');
    expect(mockTxn.runAsync.mock.calls[1][4]).toBe(result?.distanceDeltaMeters);
    expect(db.getFirstAsync).not.toHaveBeenCalled();
  });

  it('GPS点のNOT NULL制約違反は呼び出し元へ伝播する', async () => {
    mockTxn.runAsync.mockRejectedValueOnce(new Error('NOT NULL constraint failed'));
    const invalidPoint = { ...point(35, 139), latitude: null as unknown as number };

    await expect(insertLocationPointInCurrentTransaction(invalidPoint, '2026-08-23T00:00:30.000Z', mockTxn as never)).rejects.toThrow(
      'NOT NULL constraint failed',
    );

    expect(mockTxn.runAsync).toHaveBeenCalledTimes(1);
    expect(mockTxn.getFirstAsync).not.toHaveBeenCalled();
  });

  it('重複点のINSERTが無視された場合は日別集計を更新しない', async () => {
    mockTxn.runAsync.mockResolvedValueOnce({ lastInsertRowId: 0, changes: 0 });

    await expect(insertLocationPointInCurrentTransaction(point(35, 139), '2026-08-23T00:00:30.000Z', mockTxn as never)).resolves.toBeNull();

    expect(mockTxn.runAsync).toHaveBeenCalledTimes(1);
    expect(mockTxn.getFirstAsync).not.toHaveBeenCalled();
  });

  it('INSERT結果のchangesが不明な場合は挿入成功と推測せず日別集計を更新しない', async () => {
    mockTxn.runAsync.mockResolvedValueOnce({ lastInsertRowId: 100 });

    await expect(insertLocationPointInCurrentTransaction(point(35, 139), '2026-08-23T00:00:30.000Z', mockTxn as never)).resolves.toBeNull();

    expect(mockTxn.runAsync).toHaveBeenCalledTimes(1);
    expect(mockTxn.getFirstAsync).not.toHaveBeenCalled();
  });

  it('同じrunnerの前後点SELECTは直前点の解決後に直後点を取得する', async () => {
    const previousPoint: LocationPoint = { ...point(35, 139), id: 1 };
    let resolvePreviousPoint: (value: LocationPoint | null) => void = () => undefined;
    const previousPointPromise = new Promise<LocationPoint | null>((resolve) => {
      resolvePreviousPoint = resolve;
    });
    mockTxn.getFirstAsync.mockImplementationOnce(() => previousPointPromise).mockResolvedValueOnce(null);

    const insertion = insertLocationPointInCurrentTransaction(point(35.001, 139), '2026-08-23T00:00:30.000Z', mockTxn as never);
    await Promise.resolve();
    await Promise.resolve();

    expect(mockTxn.getFirstAsync).toHaveBeenCalledTimes(1);

    resolvePreviousPoint(previousPoint);
    await insertion;

    expect(mockTxn.getFirstAsync).toHaveBeenCalledTimes(2);
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
    expect(mockTxn.runAsync).toHaveBeenNthCalledWith(1, 'DELETE FROM location_recording_state');
    expect(mockTxn.runAsync).toHaveBeenNthCalledWith(2, 'DELETE FROM visited_cells');
    expect(mockTxn.runAsync).toHaveBeenNthCalledWith(3, 'DELETE FROM achievement_notification_queue');
    expect(mockTxn.runAsync).toHaveBeenNthCalledWith(4, 'DELETE FROM achievement_unlocks');
    expect(mockTxn.runAsync).toHaveBeenNthCalledWith(5, 'DELETE FROM visited_admin_areas');
    expect(mockTxn.runAsync).toHaveBeenNthCalledWith(6, 'DELETE FROM location_point_admin_areas');
    expect(mockTxn.runAsync).toHaveBeenNthCalledWith(7, 'DELETE FROM stay_places');
    expect(mockTxn.runAsync).toHaveBeenNthCalledWith(8, 'DELETE FROM location_points');
    expect(mockTxn.runAsync).toHaveBeenNthCalledWith(9, 'DELETE FROM daily_logs');
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
