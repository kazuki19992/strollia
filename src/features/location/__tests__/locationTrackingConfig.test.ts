import * as Location from 'expo-location';

import {
  BACKGROUND_LOCATION_TASK_NAME,
  getLocationTaskOptions,
  LOCATION_MAX_ACCURACY_METERS,
  LOCATION_MIN_SAVE_DISTANCE_METERS,
  LOCATION_UPDATE_DISTANCE_METERS,
  LOCATION_UPDATE_INTERVAL_MS,
} from '../locationTrackingConfig';

describe('位置情報追跡設定', () => {
  it('安定したバックグラウンドタスク名を使う', () => {
    expect(BACKGROUND_LOCATION_TASK_NAME).toBe('strollia-background-location-task');
  });

  it('10秒間隔と距離条件を位置情報更新の目安にする', () => {
    const options = getLocationTaskOptions();

    expect(LOCATION_UPDATE_INTERVAL_MS).toBe(10000);
    expect(options.timeInterval).toBe(10000);
    expect(options.accuracy).toBe(Location.Accuracy.High);
    expect(LOCATION_UPDATE_DISTANCE_METERS).toBe(5);
    expect(LOCATION_MAX_ACCURACY_METERS).toBe(50);
    expect(LOCATION_MIN_SAVE_DISTANCE_METERS).toBe(5);
    expect(options.distanceInterval).toBe(5);
    expect(options.deferredUpdatesInterval).toBe(10000);
    expect(options.foregroundService?.notificationTitle).toBe('すとろりあで記録中');
  });

  it('Dynamic Island等の位置情報インジケータを表示しない', () => {
    const options = getLocationTaskOptions();

    expect(options.showsBackgroundLocationIndicator).toBe(false);
  });
});
