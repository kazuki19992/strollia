import { db } from '@/db/database';

import {
  countNewAreaBlocks,
  getAchievementUnlockSummary,
  getAnnualReportRoutePoints,
  getDailyDistanceRows,
  getLandmarkSpotVisitSummary,
  getNewAdminAreaSummary,
  getNewAreaBlocks,
  getPreviousAreaBlocks,
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

  test('ルート用ポイントは必要な列だけを、local_date の範囲(インデックスを使う BETWEEN)で日・時刻順に読む', async () => {
    getAllAsync.mockResolvedValue([
      {
        recordedAt: '2026-01-02T00:00:00.000Z',
        localDate: '2026-01-02',
        latitude: 35,
        longitude: 139,
        effectiveLatitude: null,
        effectiveLongitude: null,
      },
    ]);

    const points = await getAnnualReportRoutePoints('2026-01-01', '2026-01-15');

    const [sql, ...params] = getAllAsync.mock.calls[0];
    expect(params).toEqual(['2026-01-01', '2026-01-15']);
    expect(sql).toContain('WHERE local_date BETWEEN ? AND ?');
    expect(sql).toContain('ORDER BY local_date ASC, recorded_at ASC');
    expect(sql).not.toContain('LIKE');
    // 速度・精度などルートと距離に使わない列は読まない
    expect(sql).not.toMatch(/\b(accuracy|altitude|speed|heading)\b/);
    expect(sql).toContain('effective_latitude');
    expect(sql).toContain('effective_longitude');
    expect(points).toEqual([
      expect.objectContaining({
        recordedAt: '2026-01-02T00:00:00.000Z',
        localDate: '2026-01-02',
        latitude: 35,
        longitude: 139,
        effectiveLatitude: null,
        effectiveLongitude: null,
      }),
    ]);
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

  describe('新しく塗ったエリアの地図用ブロック', () => {
    /** 負のセル番号でも floor 除算になる SQLite の式(x 列)。 */
    const floorDivisionX = '(x - ((x % ?) + ?) % ?) / ?';
    const floorDivisionY = '(y - ((y % ?) + ?) % ?) / ?';

    test('countNewAreaBlocks は期間内に初めて塗ったマスを ratio 倍のブロックへまとめた個数を返す', async () => {
      getFirstAsync.mockResolvedValue({ count: 42 });

      const count = await countNewAreaBlocks('2026-01-01T00:00:00.000Z', '2026-12-16T00:00:00.000Z', 5);

      expect(count).toBe(42);
      const [sql, ...params] = getFirstAsync.mock.calls[0];
      expect(sql).toContain('first_visited_at >= ? AND first_visited_at < ?');
      expect(sql).toContain(floorDivisionX);
      expect(sql).toContain(floorDivisionY);
      expect(sql).not.toMatch(/floor\(/i);
      expect(params).toEqual([5, 5, 5, 5, 5, 5, 5, 5, '2026-01-01T00:00:00.000Z', '2026-12-16T00:00:00.000Z']);
    });

    test('countNewAreaBlocks は行が無ければ0を返す', async () => {
      getFirstAsync.mockResolvedValue(null);

      await expect(countNewAreaBlocks('2026-01-01T00:00:00.000Z', '2026-12-16T00:00:00.000Z', 1)).resolves.toBe(0);
    });

    test('getNewAreaBlocks は初めて塗った古い順に limit 件のブロック番号を [x, y] で返す', async () => {
      getAllAsync.mockResolvedValue([
        { blockX: 10, blockY: -3 },
        { blockX: -1, blockY: 4 },
      ]);

      const cells = await getNewAreaBlocks('2026-01-01T00:00:00.000Z', '2026-12-16T00:00:00.000Z', 2, 150);

      expect(cells).toEqual([
        [10, -3],
        [-1, 4],
      ]);
      const [sql, ...params] = getAllAsync.mock.calls[0];
      expect(sql).toContain('first_visited_at >= ? AND first_visited_at < ?');
      expect(sql).toContain(floorDivisionX);
      expect(sql).toMatch(/ORDER BY MIN\(first_visited_at\) ASC, blockY ASC, blockX ASC/);
      expect(sql).toContain('LIMIT ?');
      expect(params).toEqual([2, 2, 2, 2, 2, 2, 2, 2, '2026-01-01T00:00:00.000Z', '2026-12-16T00:00:00.000Z', 150]);
    });

    test('getPreviousAreaBlocks は期間開始前のマスを範囲内で絞り、訪問回数の多い順に limit 件返す', async () => {
      getAllAsync.mockResolvedValue([{ blockX: 3, blockY: 7 }]);

      const cells = await getPreviousAreaBlocks('2026-01-01T00:00:00.000Z', 10, { minX: -20, maxX: 39, minY: 50, maxY: 89 }, 300);

      expect(cells).toEqual([[3, 7]]);
      const [sql, ...params] = getAllAsync.mock.calls[0];
      expect(sql).toContain('first_visited_at < ?');
      expect(sql).toContain('x BETWEEN ? AND ?');
      expect(sql).toContain('y BETWEEN ? AND ?');
      expect(sql).toContain(floorDivisionX);
      expect(sql).toMatch(/ORDER BY SUM\(visit_count\) DESC/);
      expect(sql).toContain('LIMIT ?');
      expect(params).toEqual([10, 10, 10, 10, 10, 10, 10, 10, '2026-01-01T00:00:00.000Z', -20, 39, 50, 89, 300]);
    });
  });
});
