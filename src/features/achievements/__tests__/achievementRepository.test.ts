import { db } from '../../../db/database';
import { evaluateAndStoreAchievementUnlocks, getAchievementProgress } from '../achievementRepository';

jest.mock('../../../db/database', () => ({
  db: {
    getFirstAsync: jest.fn(),
    getAllAsync: jest.fn(),
    withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => callback()),
    runAsync: jest.fn(),
  },
}));

describe('実績リポジトリ achievementRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('SQLite集計から実績進捗を取得する', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValueOnce([{ localDate: '2026-05-07', distanceMeters: 1500 }]);
    (db.getFirstAsync as jest.Mock)
      .mockResolvedValueOnce({ logDays: 7 })
      .mockResolvedValueOnce({ count: 5 })
      .mockResolvedValueOnce({ count: 50 });

    await expect(getAchievementProgress()).resolves.toEqual({
      totalDistanceMeters: 1500,
      logDays: 7,
      prefectureCount: 5,
      municipalityCount: 50,
    });
  });


  it('距離がNULLの日はGPSポイントから距離をフォールバック計算する', async () => {
    (db.getAllAsync as jest.Mock)
      .mockResolvedValueOnce([{ localDate: '2026-05-07', distanceMeters: null }])
      .mockResolvedValueOnce([
        {
          id: 1,
          recordedAt: '2026-05-07T00:00:00.000Z',
          localDate: '2026-05-07',
          latitude: 35,
          longitude: 139,
          altitude: null,
          speed: null,
          heading: null,
          accuracy: 10,
          altitudeAccuracy: null,
          source: 'expo-location',
          createdAt: '2026-05-07T00:00:00.000Z',
        },
        {
          id: 2,
          recordedAt: '2026-05-07T00:01:00.000Z',
          localDate: '2026-05-07',
          latitude: 35.001,
          longitude: 139,
          altitude: null,
          speed: null,
          heading: null,
          accuracy: 10,
          altitudeAccuracy: null,
          source: 'expo-location',
          createdAt: '2026-05-07T00:01:00.000Z',
        },
      ]);
    (db.getFirstAsync as jest.Mock)
      .mockResolvedValueOnce({ logDays: 1 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });

    const progress = await getAchievementProgress();

    expect(progress.totalDistanceMeters).toBeGreaterThan(100);
    expect(progress.totalDistanceMeters).toBeLessThan(120);
  });

  it('達成済みで未解除の実績を保存して通知キューに積む', async () => {
    (db.getAllAsync as jest.Mock)
      .mockResolvedValueOnce([{ localDate: '2026-05-07', distanceMeters: 100000 }])
      .mockResolvedValueOnce([]);
    (db.getFirstAsync as jest.Mock)
      .mockResolvedValueOnce({ logDays: 1 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });
    (db.runAsync as jest.Mock).mockResolvedValue({ changes: 1 });

    const unlocked = await evaluateAndStoreAchievementUnlocks({ now: '2026-05-07T00:00:00.000Z' });

    expect(unlocked.map((definition) => definition.id)).toEqual(expect.arrayContaining(['distance-100', 'log-days-1']));
    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR IGNORE INTO achievement_unlocks'),
      'distance-100',
      '2026-05-07T00:00:00.000Z',
      100000,
      '2026-05-07T00:00:00.000Z',
    );
  });
});
