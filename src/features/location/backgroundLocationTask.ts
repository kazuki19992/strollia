import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { initializeDatabase } from '../../db/database';
import { CoordinateLike } from '../../utils/distance';
import { getLatestLocationPoint, insertLocationPoint } from '../logs/logRepository';
import { BACKGROUND_LOCATION_TASK_NAME } from './locationTrackingConfig';
import { toLocationPoint } from './locationMapper';
import { shouldSaveLocationPoint } from './locationSaveFilter';

type BackgroundLocationTaskData = {
  locations?: Location.LocationObject[];
};

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
