import { db } from '@/db/database';

import {
  getAchievementUnlockSummary,
  getDailyDistanceRows,
  getLandmarkSpotVisitSummary,
  getNewAdminAreaSummary,
  getVisitedCellCounts,
  getVisitedPrefectureNames,
  toLocalDayStartIso,
} from '@/features/annualReport/annualReportQueries';

jest.mock('@/db/database', () => ({
  db: {
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
  },
}));

const getAllAsync = db.getAllAsync as jest.Mock;
const getFirstAsync = db.getFirstAsync as jest.Mock;

describe('年次レポートの集計クエリ', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('日別距離は期間を引数に渡し、camelCaseへ変換する', async () => {
    getAllAsync.mockResolvedValue([{ local_date: '2026-01-02', point_count: 10, distance_meters: 1234.5 }]);

    const rows = await getDailyDistanceRows('2026-01-01', '2026-12-15');

    expect(rows).toEqual([{ localDate: '2026-01-02', pointCount: 10, distanceMeters: 1234.5 }]);
    expect(getAllAsync).toHaveBeenCalledWith(expect.stringContaining('point_count > 0'), '2026-01-01', '2026-12-15');
  });

  test('訪問した都道府県名を期間で絞って返す', async () => {
    getAllAsync.mockResolvedValue([{ prefecture_name: '東京都' }, { prefecture_name: '神奈川県' }]);

    await expect(getVisitedPrefectureNames('2026-01-01', '2026-12-15')).resolves.toEqual(['東京都', '神奈川県']);
    expect(getAllAsync).toHaveBeenCalledWith(expect.stringContaining('DISTINCT prefecture_name'), '2026-01-01', '2026-12-15');
  });

  test('新規行政区域は都道府県名と市区町村数を返す', async () => {
    getAllAsync.mockResolvedValue([{ prefecture_name: '北海道' }]);
    getFirstAsync.mockResolvedValue({ count: 7 });

    const result = await getNewAdminAreaSummary('2026-01-01T00:00:00.000Z', '2026-12-16T00:00:00.000Z');

    expect(result).toEqual({ newPrefectures: ['北海道'], newMunicipalityCount: 7 });
    expect(getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("area_type = 'prefecture'"),
      '2026-01-01T00:00:00.000Z',
      '2026-12-16T00:00:00.000Z',
    );
    expect(getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining("area_type = 'municipality'"),
      '2026-01-01T00:00:00.000Z',
      '2026-12-16T00:00:00.000Z',
    );
  });

  test('エリア数は期間内の新規数と期間開始前の累計を返す', async () => {
    getFirstAsync.mockResolvedValueOnce({ count: 30 }).mockResolvedValueOnce({ count: 100 });

    const result = await getVisitedCellCounts('2026-01-01T00:00:00.000Z', '2026-12-16T00:00:00.000Z');

    expect(result).toEqual({ newCellCount: 30, previousCellCount: 100 });
    expect(getFirstAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('visited_cells'),
      '2026-01-01T00:00:00.000Z',
      '2026-12-16T00:00:00.000Z',
    );
    expect(getFirstAsync).toHaveBeenNthCalledWith(2, expect.stringContaining('visited_cells'), '2026-01-01T00:00:00.000Z');
  });

  test('実績の解除は件数と新しい順の3件を返す', async () => {
    getFirstAsync.mockResolvedValue({ count: 5 });
    getAllAsync.mockResolvedValue([{ achievement_id: 'a', unlocked_local_date: '2026-03-01' }]);

    const result = await getAchievementUnlockSummary('2026-01-01', '2026-12-15');

    expect(result).toEqual({ count: 5, highlights: [{ id: 'a', unlockedLocalDate: '2026-03-01' }] });
    expect(getAllAsync).toHaveBeenCalledWith(
      expect.stringMatching(/ORDER BY unlocked_local_date DESC[\s\S]*LIMIT 3/),
      '2026-01-01',
      '2026-12-15',
    );
  });

  test('スポット訪問は件数と新しい順の3件を返す', async () => {
    getFirstAsync.mockResolvedValue({ count: 2 });
    getAllAsync.mockResolvedValue([{ spot_id: 's1', visited_local_date: '2026-05-05' }]);

    const result = await getLandmarkSpotVisitSummary('2026-01-01', '2026-12-15');

    expect(result).toEqual({ count: 2, highlights: [{ id: 's1', visitedLocalDate: '2026-05-05' }] });
    expect(getAllAsync).toHaveBeenCalledWith(
      expect.stringMatching(/ORDER BY visited_local_date DESC[\s\S]*LIMIT 3/),
      '2026-01-01',
      '2026-12-15',
    );
  });

  test('ローカル日の開始時刻をISO文字列にする', () => {
    expect(toLocalDayStartIso('2026-12-16')).toBe(new Date(2026, 11, 16, 0, 0, 0, 0).toISOString());
  });
});
