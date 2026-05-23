import { db } from '../../../db/database';
import { NewLocationPoint } from '../../../types/gps';
import { deleteAllUserData, getRecentLocationPoints, insertLocationPoint } from '../logRepository';

jest.mock('../../../db/database', () => ({
  db: {
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => callback()),
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

    expect(db.runAsync).toHaveBeenCalledTimes(2);
    const dailySummaryArgs = (db.runAsync as jest.Mock).mock.calls[1];
    expect(dailySummaryArgs[4]).toBeGreaterThan(100);
    expect(dailySummaryArgs[4]).toBeLessThan(120);
  });
});

describe('全ユーザーデータ削除 deleteAllUserData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GPSログ、行政区域履歴、実績関連データを1つのトランザクションで削除する', async () => {
    await deleteAllUserData();

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(db.runAsync).toHaveBeenNthCalledWith(1, 'DELETE FROM achievement_notification_queue');
    expect(db.runAsync).toHaveBeenNthCalledWith(2, 'DELETE FROM achievement_unlocks');
    expect(db.runAsync).toHaveBeenNthCalledWith(3, 'DELETE FROM visited_admin_areas');
    expect(db.runAsync).toHaveBeenNthCalledWith(4, 'DELETE FROM location_point_admin_areas');
    expect(db.runAsync).toHaveBeenNthCalledWith(5, 'DELETE FROM location_points');
    expect(db.runAsync).toHaveBeenNthCalledWith(6, 'DELETE FROM daily_logs');
  });
});

describe('最近のGPSポイント取得 getRecentLocationPoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('品質判定の初期窓として古い順に直近点を返す', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValue([
      { ...point(35.0002, 139), id: 3, recordedAt: '2026-05-23T00:00:20.000Z' },
      { ...point(35.0001, 139), id: 2, recordedAt: '2026-05-23T00:00:10.000Z' },
    ]);

    const recentPoints = await getRecentLocationPoints(2);

    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('ORDER BY recorded_at DESC, id DESC'), 2);
    expect(recentPoints.map((item) => item.recordedAt)).toEqual([
      '2026-05-23T00:00:10.000Z',
      '2026-05-23T00:00:20.000Z',
    ]);
  });
});
