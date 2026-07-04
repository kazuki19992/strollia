import type * as Location from 'expo-location';

import { initializeDatabase } from '@/db/database';
import { processAchievementsForSavedPoint } from '@/features/achievements/achievementService';
import { getLatestLocationPoint, insertLocationPoint } from '@/features/logs/logRepository';
import { getVisitedCellsForLocationPoint } from './grid/gridInterpolation';
import { toLocationPoint } from './locationMapper';
import { shouldSaveLocationPoint } from './locationSaveFilter';
import { upsertVisitedCells } from './visitedCellRepository';

/** 前景・背景の位置情報を同じ保存規則で処理するセッション。 */
export type LocationRecordingSession = {
  /** 位置情報を受信順に処理し、前回点を次回呼び出しへ引き継ぐ。 */
  recordLocations: (locations: Location.LocationObject[]) => Promise<void>;
};

/**
 * 最新保存点を一度だけ読み込み、位置情報を継続的に保存するセッションを作る。
 *
 * 前景監視では位置情報が1件ずつ届くため、呼び出し間で前回点を保持して
 * 距離・時系列判定とVisited Grid補間を背景タスクの一括処理と一致させる。
 */
export async function createLocationRecordingSession(): Promise<LocationRecordingSession> {
  await initializeDatabase();

  const latestSavedPoint = await getLatestLocationPoint();
  let previousSavedPoint: Parameters<typeof shouldSaveLocationPoint>[1] = latestSavedPoint;
  let previousVisitedCellPoint: ReturnType<typeof toLocationPoint> | null = latestSavedPoint;

  return {
    async recordLocations(locations) {
      const savedPoints: { point: ReturnType<typeof toLocationPoint>; locationPointId: number }[] = [];

      for (const location of locations) {
        const point = toLocationPoint(location);
        const visitedCells = getVisitedCellsForLocationPoint(previousVisitedCellPoint, point);

        if (visitedCells.length > 0) {
          await upsertVisitedCells(visitedCells, point.recordedAt);
          previousVisitedCellPoint = point;
        }

        if (shouldSaveLocationPoint(point, previousSavedPoint)) {
          const locationPointId = await insertLocationPoint(point);
          savedPoints.push({ point, locationPointId });
          previousSavedPoint = point;
        }
      }

      // GPSポイントを確定してから、逆ジオコーディングを含む実績処理を行う。
      for (const { point, locationPointId } of savedPoints) {
        await processAchievementsForSavedPoint(point, locationPointId).catch((error: unknown) => {
          console.warn('Achievement processing failed:', error);
        });
      }
    },
  };
}
