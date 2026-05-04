import * as Location from 'expo-location';

import { NewLocationPoint } from '../../types/gps';
import { toLocalDate } from '../../utils/date';

export async function ensureForegroundLocationPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();

  if (current.granted) {
    return true;
  }

  const requested = await Location.requestForegroundPermissionsAsync();
  return requested.granted;
}

export function toLocationPoint(location: Location.LocationObject): NewLocationPoint {
  const recordedDate = new Date(location.timestamp);
  const coords = location.coords;

  return {
    recordedAt: recordedDate.toISOString(),
    localDate: toLocalDate(recordedDate),
    latitude: coords.latitude,
    longitude: coords.longitude,
    altitude: coords.altitude,
    speed: coords.speed,
    heading: coords.heading,
    accuracy: coords.accuracy,
    altitudeAccuracy: coords.altitudeAccuracy,
  };
}
