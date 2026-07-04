import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { BACKGROUND_LOCATION_TASK_NAME, getLocationTaskOptions, hasCurrentLocationTaskOptions } from './locationTrackingConfig';

/** フォアグラウンド位置情報権限を確認し、必要ならOSダイアログで要求する。 */
export async function ensureForegroundLocationPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();

  if (current.granted) {
    return true;
  }

  const requested = await Location.requestForegroundPermissionsAsync();
  return requested.granted;
}

/** バックグラウンド位置情報権限を確認し、前提となるフォアグラウンド権限から順に要求する。 */
export async function ensureBackgroundLocationPermission(): Promise<boolean> {
  const foregroundGranted = await ensureForegroundLocationPermission();

  if (!foregroundGranted) {
    return false;
  }

  const current = await Location.getBackgroundPermissionsAsync();

  if (current.granted) {
    return true;
  }

  const requested = await Location.requestBackgroundPermissionsAsync();
  return requested.granted;
}

/** バックグラウンドGPS記録を開始する。すでに開始済みの場合は何もしない。 */
export async function startBackgroundLocationRecording(): Promise<void> {
  const available = await TaskManager.isAvailableAsync();

  if (!available) {
    throw new Error('この環境ではバックグラウンド位置情報を利用できません。previewビルドまたは開発ビルドで確認してください。');
  }

  const granted = await ensureBackgroundLocationPermission();

  if (!granted) {
    throw new Error('バックグラウンド位置情報の権限がないため、記録を開始できません。');
  }

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME);

  if (alreadyStarted) {
    return;
  }

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME, getLocationTaskOptions());
}

/**
 * 記録中タスクの設定が古い場合だけ、同名タスクへ最新オプションを適用する。
 *
 * Expo TaskManagerは同名・同consumerへのstartを既存タスクの設定更新として扱う。
 * 明示的なstopは記録を中断するため行わない。
 */
export async function updateBackgroundLocationTaskOptionsIfNeeded(): Promise<void> {
  if (!(await TaskManager.isAvailableAsync())) {
    return;
  }

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME);

  if (!alreadyStarted) {
    return;
  }

  const currentOptions = await TaskManager.getTaskOptionsAsync<Location.LocationTaskOptions>(BACKGROUND_LOCATION_TASK_NAME);

  if (hasCurrentLocationTaskOptions(currentOptions)) {
    return;
  }

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME, getLocationTaskOptions());
}

/** バックグラウンドGPS記録を停止する。未開始の場合は何もしない。 */
export async function stopBackgroundLocationRecording(): Promise<void> {
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME);

  if (!alreadyStarted) {
    return;
  }

  await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME);
}

/** Expo Locationのバックグラウンドタスクが開始済みか返す。 */
export async function isBackgroundLocationRecording(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME);
}
