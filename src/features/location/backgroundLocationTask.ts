import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { initializeDatabase } from '../../db/database';
import { processAchievementsForSavedPoint } from '../achievements/achievementService';
import { getRecentLocationPoints, insertLocationPoint } from '../logs/logRepository';
import { BACKGROUND_LOCATION_TASK_NAME } from './locationTrackingConfig';
import { toLocationPoint } from './locationMapper';
import { advanceLocationQualityContext, createLocationQualityContext } from './locationQualityFilter';

/** Expo Locationのバックグラウンドタスクから渡される位置情報ペイロード。 */
type BackgroundLocationTaskData = {
  locations?: Location.LocationObject[];
};

/** バッチ境界をまたいで短い保留軌道を確認するメモリ内窓。 */
let pendingProvisionalPoints: ReturnType<typeof toLocationPoint>[] = [];

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

    // 同一バッチ内でも品質判定コンテキストを進め、accepted点だけを保存する。
    const acceptedSeed = await getRecentLocationPoints(6);
    let qualityContext = createLocationQualityContext(acceptedSeed, pendingProvisionalPoints);
    const savedPoints: { point: ReturnType<typeof toLocationPoint>; locationPointId: number }[] = [];

    for (const location of locations) {
      const point = toLocationPoint(location);
      const advance = advanceLocationQualityContext(point, qualityContext);
      qualityContext = advance.context;

      for (const acceptedPoint of advance.acceptedPoints) {
        const locationPointId = await insertLocationPoint(acceptedPoint);
        savedPoints.push({ point: acceptedPoint, locationPointId });
      }
    }

    pendingProvisionalPoints = qualityContext.provisionalPoints;

    // GPSポイント保存を先に完了させ、逆ジオコーディングを含む実績処理は後段で行う。
    for (const { point, locationPointId } of savedPoints) {
      await processAchievementsForSavedPoint(point, locationPointId).catch((achievementError: unknown) => {
        console.warn('Achievement processing failed:', achievementError);
      });
    }
  });
}
