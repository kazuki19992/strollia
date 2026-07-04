import * as Location from 'expo-location';

/** UI表示と記録可否判定に必要な位置情報権限の状態。 */
export type LocationPermissionState = {
  foregroundGranted: boolean;
  backgroundGranted: boolean;
  canAskForeground: boolean;
  canAskBackground: boolean;
};

/** バックグラウンド記録に必要な権限が揃っているか返す。 */
export function hasRequiredLocationPermission(state: LocationPermissionState): boolean {
  return state.foregroundGranted && state.backgroundGranted;
}

/**
 * 「アプリ起動中のみ記録」モードかどうかを返す。
 * フォアグラウンド権限はあるがバックグラウンド権限がない状態を指す。
 */
export function isWhileInUseOnlyMode(state: LocationPermissionState): boolean {
  return state.foregroundGranted && !state.backgroundGranted;
}

/** アプリ内ダイアログで追加権限を要求できる余地があるか返す。 */
export function canRequestLocationPermissionInApp(state: LocationPermissionState): boolean {
  return !state.foregroundGranted ? state.canAskForeground : state.canAskBackground;
}

/** 現在のフォアグラウンド/バックグラウンド位置情報権限を取得する。 */
export async function getLocationPermissionState(): Promise<LocationPermissionState> {
  const [foreground, background] = await Promise.all([Location.getForegroundPermissionsAsync(), Location.getBackgroundPermissionsAsync()]);

  return {
    foregroundGranted: foreground.granted,
    backgroundGranted: background.granted,
    canAskForeground: foreground.canAskAgain,
    canAskBackground: background.canAskAgain,
  };
}
