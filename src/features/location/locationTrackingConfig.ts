import * as Location from 'expo-location';

/** expo-task-managerに登録するバックグラウンド位置情報タスク名。 */
export const BACKGROUND_LOCATION_TASK_NAME = 'strollia-background-location-task';
/** OSへ要求する位置情報更新の目安間隔。実際の頻度はOSにより調整される。 */
export const LOCATION_UPDATE_INTERVAL_MS = 10_000;
/** 停止中の不要なコールバックを抑えるための距離更新閾値。 */
export const LOCATION_UPDATE_DISTANCE_METERS = 5;
/** 保存対象とする水平方向精度の上限。 */
export const LOCATION_MAX_ACCURACY_METERS = 50;
/** 前回保存点からこれ未満の移動であれば保存しない距離。 */
export const LOCATION_MIN_SAVE_DISTANCE_METERS = 5;

/** バックグラウンドGPS記録でExpo Locationへ渡す監視設定を作る。 */
export function getLocationTaskOptions(): Location.LocationTaskOptions {
  return {
    accuracy: Location.Accuracy.High,
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
