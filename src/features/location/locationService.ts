import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { BACKGROUND_LOCATION_TASK_NAME, getLocationTaskOptions } from './locationTrackingConfig';

export async function ensureForegroundLocationPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();

  if (current.granted) {
    return true;
  }

  const requested = await Location.requestForegroundPermissionsAsync();
  return requested.granted;
}


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

export async function stopBackgroundLocationRecording(): Promise<void> {
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME);

  if (!alreadyStarted) {
    return;
  }

  await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME);
}

export async function isBackgroundLocationRecording(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME);
}
