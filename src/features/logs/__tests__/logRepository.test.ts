import { db } from '../../../db/database';
import { NewLocationPoint } from '../../../types/gps';
import { deleteAllLogData, insertLocationPoint } from '../logRepository';

jest.mock('../../../db/database', () => ({
  db: {
    getFirstAsync: jest.fn(),
    withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => callback()),
    runAsync: jest.fn(),
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

    await insertLocationPoint(point(35.001, 139));

    expect(db.runAsync).toHaveBeenCalledTimes(2);
    const dailySummaryArgs = (db.runAsync as jest.Mock).mock.calls[1];
    expect(dailySummaryArgs[4]).toBeGreaterThan(100);
    expect(dailySummaryArgs[4]).toBeLessThan(120);
  });
});

describe('全ログ削除 deleteAllLogData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('位置情報ポイントと日別サマリーを1つのトランザクションで削除する', async () => {
    await deleteAllLogData();

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(db.runAsync).toHaveBeenNthCalledWith(1, 'DELETE FROM location_points');
    expect(db.runAsync).toHaveBeenNthCalledWith(2, 'DELETE FROM daily_logs');
  });
});
