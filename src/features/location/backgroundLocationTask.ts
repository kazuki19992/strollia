import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { BACKGROUND_LOCATION_TASK_NAME } from './locationTrackingConfig';
import { createLocationRecordingSession } from './locationRecordingSession';

/** Expo Locationのバックグラウンドタスクから渡される位置情報ペイロード。 */
type BackgroundLocationTaskData = {
  locations?: Location.LocationObject[];
};

/**
 * バックグラウンドGPS記録タスクをアプリ起動時にトップレベルで登録する。
 *
 * expo-task-manager の仕様上、タスク定義はアプリの JavaScript バンドル実行時（= モジュールロード時）に
 * 完了していなければならない。関数内に閉じると「タスクが未定義」エラーになるため、
 * このファイルを import するだけでタスクが登録されるようモジュールトップレベルに配置している。
 *
 * 二重登録を防ぐため、isTaskDefined で確認してから defineTask を呼ぶ。
 */
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

    const session = await createLocationRecordingSession();
    await session.recordLocations(locations);
  });
}
