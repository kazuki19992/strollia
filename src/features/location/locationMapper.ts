import * as Location from 'expo-location';

import { NewLocationPoint } from '@/types/gps';
import { toLocalDate } from '@/utils/date';

/** Expo Locationの取得結果をSQLite保存用のGPSポイントへ変換する。 */
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
