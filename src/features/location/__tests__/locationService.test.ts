import { LocationObject } from 'expo-location';

import { toLocationPoint } from '@/features/location/locationMapper';

describe('保存用GPSポイント変換 toLocationPoint', () => {
  it('Expoの位置情報オブジェクトを保存用ポイントへ変換する', () => {
    const location: LocationObject = {
      timestamp: new Date(2026, 4, 4, 12, 34, 56).getTime(),
      coords: {
        latitude: 35.681236,
        longitude: 139.767125,
        altitude: 10,
        accuracy: 5,
        altitudeAccuracy: 2,
        heading: 90,
        speed: 1.5,
      },
    };

    expect(toLocationPoint(location)).toEqual({
      recordedAt: new Date(2026, 4, 4, 12, 34, 56).toISOString(),
      localDate: '2026-05-04',
      latitude: 35.681236,
      longitude: 139.767125,
      altitude: 10,
      speed: 1.5,
      heading: 90,
      accuracy: 5,
      altitudeAccuracy: 2,
    });
  });
});
