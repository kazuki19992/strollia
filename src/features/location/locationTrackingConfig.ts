import * as Location from 'expo-location';
import { Platform } from 'react-native';

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

/**
 * バックグラウンドGPS記録でExpo Locationへ渡すプラットフォーム別の監視設定を作る。
 *
 * iOS 16.4以降では、位置情報インジケーターを非表示にした状態でネイティブの
 * 距離フィルターを併用すると背景更新がサスペンドされ得るため、iOSでは
 * `distanceInterval` を省略する。Androidではforeground serviceの更新頻度と
 * 電池消費を抑えるため、5mの距離フィルターを維持する。
 *
 * @returns 現在のプラットフォームに適したExpo Locationのタスクoptions。
 */
export function getLocationTaskOptions(): Location.LocationTaskOptions {
  return {
    accuracy: Location.Accuracy.High,
    timeInterval: LOCATION_UPDATE_INTERVAL_MS,
    // iOS 16.4以降はインジケーター非表示とdistanceFilterを併用すると背景更新が
    // サスペンドされ得るため、iOSではプロパティ自体を渡さない。Androidは従来値を維持する。
    ...(Platform.OS === 'ios' ? {} : { distanceInterval: LOCATION_UPDATE_DISTANCE_METERS }),
    deferredUpdatesInterval: LOCATION_UPDATE_INTERVAL_MS,
    pausesUpdatesAutomatically: false,
    // Dynamic Island等の位置情報インジケータを表示しない（フォアグラウンドサービス通知で記録中を示すため）。
    showsBackgroundLocationIndicator: false,
    foregroundService: {
      notificationTitle: 'すとろりあで記録中',
      notificationBody: 'GPSログをバックグラウンドで保存しています。',
      notificationColor: '#1f7a5c',
      killServiceOnDestroy: false,
    },
  };
}

/**
 * 登録済みタスクにStrollia管理対象の最新オプションが反映済みか返す。
 *
 * 起動ごとの不要な同名タスク更新を避けつつ、監視設定の変更だけを
 * 既存ユーザーへ反映するために、登録値を `getLocationTaskOptions()` の
 * プラットフォーム別期待値と比較する。iOSでは `distanceInterval` の省略を、
 * Androidでは5mの指定を最新状態として扱い、管理対象外の追加項目は無視する。
 *
 * @param current 現在登録されている位置情報タスクoptions。未登録ならnull。
 * @returns Strollia管理対象の全項目が現在の期待値と一致する場合はtrue。
 */
export function hasCurrentLocationTaskOptions(
  current: Location.LocationTaskOptions | null,
): boolean {
  if (!current) {
    return false;
  }

  const expected = getLocationTaskOptions();

  return current.accuracy === expected.accuracy
    && current.timeInterval === expected.timeInterval
    && current.distanceInterval === expected.distanceInterval
    && current.deferredUpdatesInterval === expected.deferredUpdatesInterval
    && current.pausesUpdatesAutomatically === expected.pausesUpdatesAutomatically
    && current.showsBackgroundLocationIndicator === expected.showsBackgroundLocationIndicator
    && current.foregroundService?.notificationTitle === expected.foregroundService?.notificationTitle
    && current.foregroundService?.notificationBody === expected.foregroundService?.notificationBody
    && current.foregroundService?.notificationColor === expected.foregroundService?.notificationColor
    && current.foregroundService?.killServiceOnDestroy === expected.foregroundService?.killServiceOnDestroy;
}
