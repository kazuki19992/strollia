import * as Location from 'expo-location';

export type LocationPermissionState = {
  foregroundGranted: boolean;
  backgroundGranted: boolean;
  canAskForeground: boolean;
  canAskBackground: boolean;
};

export function hasRequiredLocationPermission(state: LocationPermissionState): boolean {
  return state.foregroundGranted && state.backgroundGranted;
}

export function canRequestLocationPermissionInApp(state: LocationPermissionState): boolean {
  return !state.foregroundGranted ? state.canAskForeground : state.canAskBackground;
}

export async function getLocationPermissionState(): Promise<LocationPermissionState> {
  const [foreground, background] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
  ]);

  return {
    foregroundGranted: foreground.granted,
    backgroundGranted: background.granted,
    canAskForeground: foreground.canAskAgain,
    canAskBackground: background.canAskAgain,
  };
}
