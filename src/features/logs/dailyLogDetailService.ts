import { getLocationPointAdminAreaName } from '@/features/achievements/adminAreaRepository';
import { getAchievementDefinition } from '@/features/achievements/achievementDefinitions';
import { getAchievementUnlocksByDate } from '@/features/achievements/achievementRepository';
import { coordinateToGridCell } from '@/features/location/grid/gridCell';
import { toEffectiveLocationPoint } from '@/features/location/effectiveLocationPoint';
import { getVisitedCellsByIds } from '@/features/location/visitedCellRepository';
import { createDailyDetailReport, DailyDetailReport } from '@/features/reports/dailyReport';
import type { LocationPoint } from '@/types/gps';
import { formatRouteEndpoints } from '@/ui/dailyLogDisplay';
import { getLocationPointsByDate } from './logRepository';

/** 日別詳細画面で必要なデータの集約結果。 */
export type DailyLogDetailData = {
  /** 対象日のGPSポイント一覧。 */
  points: LocationPoint[];
  /** Plus向け日別詳細レポート。 */
  report: DailyDetailReport;
  /** 出発・到着地点のエリア名ラベル。例: 「船橋市 ▶ 千代田区」。 */
  routeEndpointsLabel: string;
};

/**
 * Aggregates the data required for the daily log detail screen.
 *
 * @param localDate - The target date in `YYYY-MM-DD` format
 * @returns The daily log points, detail report, and route endpoint label
 */
export async function fetchDailyLogDetailData(localDate: string): Promise<DailyLogDetailData> {
  const points = await getLocationPointsByDate(localDate);
  const firstPoint = points[0] ?? null;
  const lastPoint = points.at(-1) ?? null;
  const cellIds = [...new Set(points.map(toEffectiveLocationPoint).map((point) => coordinateToGridCell(point).cellId))];

  const [visitedCells, achievementUnlocks, startArea, endArea] = await Promise.all([
    getVisitedCellsByIds(cellIds),
    getAchievementUnlocksByDate(localDate),
    firstPoint ? getLocationPointAdminAreaName(firstPoint.id) : Promise.resolve(null),
    lastPoint ? getLocationPointAdminAreaName(lastPoint.id) : Promise.resolve(null),
  ]);

  const unlockedAchievements = achievementUnlocks.flatMap((unlock) => {
    const definition = getAchievementDefinition(unlock.achievementId);
    return definition
      ? [{ id: definition.id, title: definition.title, unlockedAt: unlock.unlockedAt, trophyImage: definition.trophyImage }]
      : [];
  });

  const report = createDailyDetailReport({ localDate, points, visitedCells, unlockedAchievements });
  const routeEndpointsLabel = formatRouteEndpoints(startArea?.areaName, endArea?.areaName);

  return { points, report, routeEndpointsLabel };
}
