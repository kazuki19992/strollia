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
    (db.getFirstAsync as jest.Mock)
      .mockResolvedValueOnce({ totalDistanceMeters: 1500 })
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

  it('達成済みで未解除の実績を保存して通知キューに積む', async () => {
    (db.getFirstAsync as jest.Mock)
      .mockResolvedValueOnce({ totalDistanceMeters: 100 })
      .mockResolvedValueOnce({ logDays: 1 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });
    (db.getAllAsync as jest.Mock).mockResolvedValue([]);

    const unlocked = await evaluateAndStoreAchievementUnlocks('2026-05-07T00:00:00.000Z');

    expect(unlocked.map((definition) => definition.id)).toEqual(expect.arrayContaining(['distance-100', 'log-days-1']));
    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR IGNORE INTO achievement_unlocks'),
      'distance-100',
      '2026-05-07T00:00:00.000Z',
      100,
      '2026-05-07T00:00:00.000Z',
    );
  });
});
