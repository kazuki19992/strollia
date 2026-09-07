import { toEffectiveLocationPoint } from '@/features/location/effectiveLocationPoint';
import { LocationPoint } from '@/types/gps';

type LocationPointWithEffectiveCoordinates = LocationPoint & {
  effectiveLatitude: number | null;
  effectiveLongitude: number | null;
};

/** 有効座標を含む位置情報のfixtureを作る。 */
function point(overrides: Partial<LocationPointWithEffectiveCoordinates> = {}): LocationPointWithEffectiveCoordinates {
  return {
    id: 1,
    recordedAt: '2026-08-19T00:00:00.000Z',
    localDate: '2026-08-19',
    latitude: 35,
    longitude: 139,
    altitude: null,
    speed: null,
    heading: null,
    accuracy: null,
    altitudeAccuracy: null,
    effectiveLatitude: null,
    effectiveLongitude: null,
    ...overrides,
  };
}

describe('有効座標への変換 toEffectiveLocationPoint', () => {
  it('有効緯度と有効経度がともに有効な場合は両方を採用する', () => {
    const source = point({ effectiveLatitude: 35.1, effectiveLongitude: 139.1 });

    expect(toEffectiveLocationPoint(source)).toEqual({ ...source, latitude: 35.1, longitude: 139.1 });
  });

  it('有効座標が片方だけの場合は生座標へフォールバックする', () => {
    const source = point({ effectiveLatitude: 35.1, effectiveLongitude: null });

    expect(toEffectiveLocationPoint(source)).toEqual(source);
  });

  it('範囲外または非有限の有効座標の場合は生座標へフォールバックする', () => {
    const invalidLatitude = point({ effectiveLatitude: 91, effectiveLongitude: 139.1 });
    const invalidLongitude = point({ effectiveLatitude: 35.1, effectiveLongitude: Number.NaN });

    expect(toEffectiveLocationPoint(invalidLatitude)).toEqual(invalidLatitude);
    expect(toEffectiveLocationPoint(invalidLongitude)).toEqual(invalidLongitude);
  });
});
