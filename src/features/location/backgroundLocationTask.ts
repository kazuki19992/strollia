import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { initializeDatabase } from '../../db/database';
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

    for (const location of locations) {
      const point = toLocationPoint(location);

      if (!shouldSaveLocationPoint(point, previousPoint)) {
        continue;
      }

      await insertLocationPoint(point);
      previousPoint = point;
    }
  });
}
