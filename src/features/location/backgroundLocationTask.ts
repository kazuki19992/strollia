import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { initializeDatabase } from '../../db/database';
import { processAchievementsForSavedPoint } from '../achievements/achievementService';
import { CoordinateLike } from '../../utils/distance';
import { getLatestLocationPoint, insertLocationPoint } from '../logs/logRepository';
import { BACKGROUND_LOCATION_TASK_NAME } from './locationTrackingConfig';
import { toLocationPoint } from './locationMapper';
import { shouldSaveLocationPoint } from './locationSaveFilter';

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

    // 同一バッチ内でも直前保存点を更新し、細かすぎる連続点を保存しない。
    let previousPoint: CoordinateLike | null = await getLatestLocationPoint();
    const savedPoints: { point: ReturnType<typeof toLocationPoint>; locationPointId: number }[] = [];

    for (const location of locations) {
      const point = toLocationPoint(location);

      if (!shouldSaveLocationPoint(point, previousPoint)) {
        continue;
      }

      const locationPointId = await insertLocationPoint(point);
      savedPoints.push({ point, locationPointId });
      previousPoint = point;
    }

    // GPSポイント保存を先に完了させ、逆ジオコーディングを含む実績処理は後段で行う。
    for (const { point, locationPointId } of savedPoints) {
      await processAchievementsForSavedPoint(point, locationPointId).catch((achievementError: unknown) => {
        console.warn('Achievement processing failed:', achievementError);
      });
    }
  });
}
