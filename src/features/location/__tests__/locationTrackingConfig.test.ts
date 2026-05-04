import {
  BACKGROUND_LOCATION_TASK_NAME,
  getLocationTaskOptions,
  LOCATION_MAX_ACCURACY_METERS,
  LOCATION_MIN_SAVE_DISTANCE_METERS,
  LOCATION_UPDATE_DISTANCE_METERS,
  LOCATION_UPDATE_INTERVAL_MS,
} from '../locationTrackingConfig';

describe('locationTrackingConfig', () => {
  it('uses a stable background task name', () => {
    expect(BACKGROUND_LOCATION_TASK_NAME).toBe('strollia-background-location-task');
  });

  it('targets 10 second updates with distance gating', () => {
    const options = getLocationTaskOptions();

    expect(LOCATION_UPDATE_INTERVAL_MS).toBe(10000);
    expect(options.timeInterval).toBe(10000);
    expect(LOCATION_UPDATE_DISTANCE_METERS).toBe(5);
    expect(LOCATION_MAX_ACCURACY_METERS).toBe(50);
    expect(LOCATION_MIN_SAVE_DISTANCE_METERS).toBe(5);
    expect(options.distanceInterval).toBe(5);
    expect(options.deferredUpdatesInterval).toBe(10000);
    expect(options.foregroundService?.notificationTitle).toBe('すとろりあで記録中');
  });
});
