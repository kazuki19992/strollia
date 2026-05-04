import * as Location from 'expo-location';

export const BACKGROUND_LOCATION_TASK_NAME = 'strollia-background-location-task';
export const LOCATION_UPDATE_INTERVAL_MS = 10_000;
export const LOCATION_UPDATE_DISTANCE_METERS = 5;
export const LOCATION_MAX_ACCURACY_METERS = 50;
export const LOCATION_MIN_SAVE_DISTANCE_METERS = 5;

export function getLocationTaskOptions(): Location.LocationTaskOptions {
  return {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: LOCATION_UPDATE_INTERVAL_MS,
    distanceInterval: LOCATION_UPDATE_DISTANCE_METERS,
    deferredUpdatesInterval: LOCATION_UPDATE_INTERVAL_MS,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'すとろりあで記録中',
      notificationBody: 'GPSログをバックグラウンドで保存しています。',
      notificationColor: '#1f7a5c',
      killServiceOnDestroy: false,
    },
  };
}
