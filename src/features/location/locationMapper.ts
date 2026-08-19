import * as Location from 'expo-location';

import { NewLocationPoint } from '@/types/gps';
import { toLocalDate } from '@/utils/date';

/**
 * Converts an Expo Location result into a GPS point for SQLite storage.
 *
 * @returns A location point with ISO 8601 recording time, device-local date, coordinates, and location metadata.
 */
export function toLocationPoint(location: Location.LocationObject): NewLocationPoint {
  const recordedDate = new Date(location.timestamp);
  const coords = location.coords;

  return {
    recordedAt: recordedDate.toISOString(),
    localDate: toLocalDate(recordedDate),
    latitude: coords.latitude,
    longitude: coords.longitude,
    effectiveLatitude: coords.latitude,
    effectiveLongitude: coords.longitude,
    snappedStayPlaceId: null,
    altitude: coords.altitude,
    speed: coords.speed,
    heading: coords.heading,
    accuracy: coords.accuracy,
    altitudeAccuracy: coords.altitudeAccuracy,
  };
}
