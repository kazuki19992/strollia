import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { initializeDatabase } from '../../db/database';
import { processAchievementsForSavedPoint } from '../achievements/achievementService';
import { getLatestLocationPoint, insertLocationPoint } from '../logs/logRepository';
import { BACKGROUND_LOCATION_TASK_NAME } from './locationTrackingConfig';
import { toLocationPoint } from './locationMapper';
import { getVisitedCellsForLocationPoint } from './grid/gridInterpolation';
import { shouldSaveLocationPoint } from './locationSaveFilter';
import { upsertVisitedCells } from './visitedCellRepository';

/** Expo Locationのバックグラウンドタスクから渡される位置情報ペイロード。 */
type BackgroundLocationTaskData = {
  locations?: Location.LocationObject[];
};

// タスク定義はアプリ起動時にトップレベルで登録しておく必要がある。
if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK_NAME)) {
  TaskManager.defineTask<BackgroundLocationTaskData>(BACKGROUND_LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
      console.warn('Background location task failed:', error.message);
      return;
    }

    const locations = data?.locations ?? [];

    if (locations.length === 0) {
      return;
    }

    await initializeDatabase();

    // VisitedCellはraw観測寄り、Polyline/ODO用ログは軽量保存判定で別々に扱う。
    const latestSavedPoint = await getLatestLocationPoint();
    let previousSavedPoint: Parameters<typeof shouldSaveLocationPoint>[1] = latestSavedPoint;
    let previousVisitedCellPoint: ReturnType<typeof toLocationPoint> | null = latestSavedPoint;
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

    // GPSポイント保存を先に完了させ、逆ジオコーディングを含む実績処理は後段で行う。
    for (const { point, locationPointId } of savedPoints) {
      await processAchievementsForSavedPoint(point, locationPointId).catch((achievementError: unknown) => {
        console.warn('Achievement processing failed:', achievementError);
      });
    }
  });
}
