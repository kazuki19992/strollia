import { fetchDailyLogDetailData } from '@/features/logs/dailyLogDetailService';

// ---- リポジトリ・サービス層のモック ----

jest.mock('@/features/logs/logRepository', () => ({
  getLocationPointsByDate: jest.fn(),
}));

jest.mock('@/features/location/visitedCellRepository', () => ({
  getVisitedCellsByIds: jest.fn(),
}));

jest.mock('@/features/achievements/achievementRepository', () => ({
  getAchievementUnlocksByDate: jest.fn(),
}));

jest.mock('@/features/achievements/adminAreaRepository', () => ({
  getLocationPointAdminAreaName: jest.fn(),
}));

jest.mock('@/features/achievements/achievementDefinitions', () => ({
  getAchievementDefinition: jest.fn(),
}));

jest.mock('@/features/reports/dailyReport', () => ({
  createDailyDetailReport: jest.fn(),
}));

import { getLocationPointsByDate } from '@/features/logs/logRepository';
import { getVisitedCellsByIds } from '@/features/location/visitedCellRepository';
import { getAchievementUnlocksByDate } from '@/features/achievements/achievementRepository';
import { getLocationPointAdminAreaName } from '@/features/achievements/adminAreaRepository';
import { getAchievementDefinition } from '@/features/achievements/achievementDefinitions';
import { createDailyDetailReport } from '@/features/reports/dailyReport';
import { coordinateToGridCell } from '@/features/location/grid/gridCell';

const basePoint = {
  id: 1,
  recordedAt: '2026-05-31T00:00:00.000Z',
  localDate: '2026-05-31',
  latitude: 35.681,
  longitude: 139.767,
  altitude: null,
  speed: null,
  heading: null,
  accuracy: 10,
  altitudeAccuracy: null,
};

const mockReport = {
  localDate: '2026-05-31',
  visitedAreaCount: 1,
  newAreaCount: 0,
  pointCount: 1,
  unlockedAchievements: [],
};

describe('dailyLogDetailService fetchDailyLogDetailData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('正常系', () => {
    it('GPSポイント・レポート・エリア名ラベルを返す', async () => {
      (getLocationPointsByDate as jest.Mock).mockResolvedValue([basePoint]);
      (getVisitedCellsByIds as jest.Mock).mockResolvedValue([]);
      (getAchievementUnlocksByDate as jest.Mock).mockResolvedValue([]);
      (getLocationPointAdminAreaName as jest.Mock).mockResolvedValue({ locationPointId: 1, areaName: '船橋市' });
      (createDailyDetailReport as jest.Mock).mockReturnValue(mockReport);

      const result = await fetchDailyLogDetailData('2026-05-31');

      expect(result.points).toEqual([basePoint]);
      expect(result.report).toEqual(mockReport);
      // 出発地点と到着地点が同じ場合は「船橋市 ▶ 船橋市」
      expect(result.routeEndpointsLabel).toBe('船橋市 ▶ 船橋市');
    });

    it('getLocationPointsByDate を指定日付で呼ぶ', async () => {
      (getLocationPointsByDate as jest.Mock).mockResolvedValue([]);
      (getVisitedCellsByIds as jest.Mock).mockResolvedValue([]);
      (getAchievementUnlocksByDate as jest.Mock).mockResolvedValue([]);
      (createDailyDetailReport as jest.Mock).mockReturnValue(mockReport);

      await fetchDailyLogDetailData('2026-06-01');

      expect(getLocationPointsByDate).toHaveBeenCalledWith('2026-06-01');
      expect(getAchievementUnlocksByDate).toHaveBeenCalledWith('2026-06-01');
    });

    it('GPSポイントがない場合は getLocationPointAdminAreaName を呼ばない', async () => {
      (getLocationPointsByDate as jest.Mock).mockResolvedValue([]);
      (getVisitedCellsByIds as jest.Mock).mockResolvedValue([]);
      (getAchievementUnlocksByDate as jest.Mock).mockResolvedValue([]);
      (createDailyDetailReport as jest.Mock).mockReturnValue(mockReport);

      await fetchDailyLogDetailData('2026-05-31');

      expect(getLocationPointAdminAreaName).not.toHaveBeenCalled();
    });

    it('訪問エリア照会には保存済みの有効座標から導いたセルIDを使う', async () => {
      const snappedPoint = { ...basePoint, effectiveLatitude: 35.5, effectiveLongitude: 139.5 };
      (getLocationPointsByDate as jest.Mock).mockResolvedValue([snappedPoint]);
      (getVisitedCellsByIds as jest.Mock).mockResolvedValue([]);
      (getAchievementUnlocksByDate as jest.Mock).mockResolvedValue([]);
      (getLocationPointAdminAreaName as jest.Mock).mockResolvedValue(null);
      (createDailyDetailReport as jest.Mock).mockReturnValue(mockReport);

      await fetchDailyLogDetailData('2026-05-31');

      expect(getVisitedCellsByIds).toHaveBeenCalledWith([coordinateToGridCell({ latitude: 35.5, longitude: 139.5 }).cellId]);
    });

    it('GPSポイントがある場合は最初と最後のポイントIDで getLocationPointAdminAreaName を呼ぶ', async () => {
      const points = [
        { ...basePoint, id: 10 },
        { ...basePoint, id: 20 },
        { ...basePoint, id: 30 },
      ];
      (getLocationPointsByDate as jest.Mock).mockResolvedValue(points);
      (getVisitedCellsByIds as jest.Mock).mockResolvedValue([]);
      (getAchievementUnlocksByDate as jest.Mock).mockResolvedValue([]);
      (getLocationPointAdminAreaName as jest.Mock).mockResolvedValue(null);
      (createDailyDetailReport as jest.Mock).mockReturnValue(mockReport);

      await fetchDailyLogDetailData('2026-05-31');

      expect(getLocationPointAdminAreaName).toHaveBeenCalledWith(10);
      expect(getLocationPointAdminAreaName).toHaveBeenCalledWith(30);
      expect(getLocationPointAdminAreaName).toHaveBeenCalledTimes(2);
    });

    it('解除済み実績がある場合は定義と紐付けて createDailyDetailReport へ渡す', async () => {
      const unlock = {
        achievementId: 'distance-100',
        unlockedAt: '2026-05-31T09:00:00.000Z',
        unlockedLocalDate: '2026-05-31',
        progressValue: 100000,
      };
      const definition = { id: 'distance-100', title: '100km移動した', trophyImage: { uri: 'badge.png' } };

      (getLocationPointsByDate as jest.Mock).mockResolvedValue([]);
      (getVisitedCellsByIds as jest.Mock).mockResolvedValue([]);
      (getAchievementUnlocksByDate as jest.Mock).mockResolvedValue([unlock]);
      (getAchievementDefinition as jest.Mock).mockReturnValue(definition);
      (createDailyDetailReport as jest.Mock).mockReturnValue(mockReport);

      await fetchDailyLogDetailData('2026-05-31');

      expect(createDailyDetailReport).toHaveBeenCalledWith(
        expect.objectContaining({
          unlockedAchievements: [
            { id: 'distance-100', title: '100km移動した', unlockedAt: '2026-05-31T09:00:00.000Z', trophyImage: { uri: 'badge.png' } },
          ],
        }),
      );
    });

    it('定義が存在しない実績は unlockedAchievements に含めない', async () => {
      const unlock = {
        achievementId: 'unknown-id',
        unlockedAt: '2026-05-31T09:00:00.000Z',
        unlockedLocalDate: '2026-05-31',
        progressValue: 0,
      };

      (getLocationPointsByDate as jest.Mock).mockResolvedValue([]);
      (getVisitedCellsByIds as jest.Mock).mockResolvedValue([]);
      (getAchievementUnlocksByDate as jest.Mock).mockResolvedValue([unlock]);
      (getAchievementDefinition as jest.Mock).mockReturnValue(undefined);
      (createDailyDetailReport as jest.Mock).mockReturnValue(mockReport);

      await fetchDailyLogDetailData('2026-05-31');

      expect(createDailyDetailReport).toHaveBeenCalledWith(expect.objectContaining({ unlockedAchievements: [] }));
    });

    it('getLocationPointAdminAreaName が null を返す場合は「--」のラベルになる', async () => {
      (getLocationPointsByDate as jest.Mock).mockResolvedValue([basePoint]);
      (getVisitedCellsByIds as jest.Mock).mockResolvedValue([]);
      (getAchievementUnlocksByDate as jest.Mock).mockResolvedValue([]);
      (getLocationPointAdminAreaName as jest.Mock).mockResolvedValue(null);
      (createDailyDetailReport as jest.Mock).mockReturnValue(mockReport);

      const result = await fetchDailyLogDetailData('2026-05-31');

      expect(result.routeEndpointsLabel).toBe('-- ▶ --');
    });

    it('visitedCells と achievementUnlocks と adminArea を並列で取得する', async () => {
      // 出発・到着が別ポイントになるよう2点用意する。
      const points = [
        { ...basePoint, id: 10 },
        { ...basePoint, id: 20 },
      ];
      const order: string[] = [];
      (getLocationPointsByDate as jest.Mock).mockResolvedValue(points);
      (getVisitedCellsByIds as jest.Mock).mockImplementation(async () => {
        order.push('visitedCells');
        return [];
      });
      (getAchievementUnlocksByDate as jest.Mock).mockImplementation(async () => {
        order.push('achievementUnlocks');
        return [];
      });
      (getLocationPointAdminAreaName as jest.Mock).mockImplementation(async () => {
        order.push('adminArea');
        return null;
      });
      (createDailyDetailReport as jest.Mock).mockReturnValue(mockReport);

      await fetchDailyLogDetailData('2026-05-31');

      // visitedCells・achievementUnlocks・adminArea(出発)・adminArea(到着) の計4件が呼ばれる。
      expect(order).toHaveLength(4);
      expect(order.filter((x) => x === 'adminArea')).toHaveLength(2);
      expect(order).toContain('visitedCells');
      expect(order).toContain('achievementUnlocks');
    });
  });

  describe('エラー伝播', () => {
    it('getLocationPointsByDate がエラーを投げると Promise が reject される', async () => {
      (getLocationPointsByDate as jest.Mock).mockRejectedValue(new Error('DB エラー'));

      await expect(fetchDailyLogDetailData('2026-05-31')).rejects.toThrow('DB エラー');
    });
  });
});
