import { db } from '@/db/database';
import {
  getLandmarkSpotVisits,
  getVisitedLandmarkSpotIds,
  insertLandmarkSpotVisitInCurrentTransaction,
} from '@/features/landmarks/landmarkVisitRepository';

jest.mock('@/db/database', () => ({
  db: {
    getAllAsync: jest.fn(),
  },
}));

/** 訪問記録の挿入に使うSQLiteランナーのモック。 */
const mockRunner = {
  runAsync: jest.fn(),
};

describe('スポット訪問リポジトリ landmarkVisitRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('保存済みの訪問を取得する', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValue([
      {
        spotId: '01a0c450-6c00-7000-8000-000000000101',
        visitedAt: '2026-04-12T02:00:00.000Z',
        visitedLocalDate: '2026-04-12',
        locationPointId: 42,
      },
    ]);

    await expect(getLandmarkSpotVisits()).resolves.toEqual([
      {
        spotId: '01a0c450-6c00-7000-8000-000000000101',
        visitedAt: '2026-04-12T02:00:00.000Z',
        visitedLocalDate: '2026-04-12',
        locationPointId: 42,
      },
    ]);
  });

  it('到達済みスポットIDの集合を返す', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValue([
      { spotId: '01a0c450-6c00-7000-8000-000000000101' },
      { spotId: '01a0c450-6c00-7000-8000-000000000103' },
    ]);

    const ids = await getVisitedLandmarkSpotIds();

    expect(ids.has('01a0c450-6c00-7000-8000-000000000101')).toBe(true);
    expect(ids.has('01a0c450-6c00-7000-8000-000000000102')).toBe(false);
  });

  it('同じスポットの再INSERTは既存行を書き換えない', async () => {
    mockRunner.runAsync.mockResolvedValue({ changes: 0 });

    await insertLandmarkSpotVisitInCurrentTransaction(
      {
        spotId: '01a0c450-6c00-7000-8000-000000000101',
        visitedAt: '2026-04-12T02:00:00.000Z',
        visitedLocalDate: '2026-04-12',
        locationPointId: null,
      },
      '2026-04-12T02:00:00.000Z',
      mockRunner as unknown as Parameters<typeof insertLandmarkSpotVisitInCurrentTransaction>[2],
    );

    expect(mockRunner.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR IGNORE INTO landmark_spot_visits'),
      '01a0c450-6c00-7000-8000-000000000101',
      '2026-04-12T02:00:00.000Z',
      '2026-04-12',
      null,
      '2026-04-12T02:00:00.000Z',
    );
  });

  it('行を追加できた場合はtrueを返す', async () => {
    mockRunner.runAsync.mockResolvedValue({ changes: 1 });

    await expect(
      insertLandmarkSpotVisitInCurrentTransaction(
        {
          spotId: '01a0c450-6c00-7000-8000-000000000101',
          visitedAt: '2026-04-12T02:00:00.000Z',
          visitedLocalDate: '2026-04-12',
          locationPointId: 42,
        },
        '2026-04-12T02:00:00.000Z',
        mockRunner as unknown as Parameters<typeof insertLandmarkSpotVisitInCurrentTransaction>[2],
      ),
    ).resolves.toBe(true);
  });

  it('既に到達済みで行が増えなかった場合はfalseを返す', async () => {
    // 呼び出し側はこの戻り値で通知と実績評価の二重実行を防ぐ
    mockRunner.runAsync.mockResolvedValue({ changes: 0 });

    await expect(
      insertLandmarkSpotVisitInCurrentTransaction(
        {
          spotId: '01a0c450-6c00-7000-8000-000000000101',
          visitedAt: '2026-04-12T02:00:00.000Z',
          visitedLocalDate: '2026-04-12',
          locationPointId: null,
        },
        '2026-04-12T02:00:00.000Z',
        mockRunner as unknown as Parameters<typeof insertLandmarkSpotVisitInCurrentTransaction>[2],
      ),
    ).resolves.toBe(false);
  });
});
