import * as Location from 'expo-location';

import { NewLocationPoint } from '@/types/gps';
import { toLocalDate } from '@/utils/date';

/**
 * Expo Location の取得結果を SQLite 保存用の GPS ポイントへ変換する純粋関数。
 *
 * timestamp はミリ秒 Unix 時刻なので `new Date()` で ISO 8601 文字列へ変換する。
 * localDate は端末のローカルタイムゾーンで確定させるため `toLocalDate` を使う（UTC 換算では日跨ぎが発生する）。
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
