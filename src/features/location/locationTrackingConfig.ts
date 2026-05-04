import * as Location from 'expo-location';

export const BACKGROUND_LOCATION_TASK_NAME = 'strollia-background-location-task';
export const LOCATION_UPDATE_INTERVAL_MS = 10_000;

export function getLocationTaskOptions(): Location.LocationTaskOptions {
  return {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: LOCATION_UPDATE_INTERVAL_MS,
    distanceInterval: 0,
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
