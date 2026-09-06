import { toEffectiveLocationPoint } from '@/features/location/effectiveLocationPoint';
import { calculateInsertedPointDistanceDeltaMeters } from '@/features/logs/locationDistanceDelta';
import { LocationPoint, NewLocationPoint } from '@/types/gps';
import { distanceMeters } from '@/utils/distance';

/** 保存済みGPSポイントのテストデータを作る。 */
function savedPoint(id: number, latitude: number, longitude: number): LocationPoint {
  return {
    ...newPoint(latitude, longitude),
    id,
  };
}

/** 新規GPSポイントのテストデータを作る。 */
function newPoint(latitude: number, longitude: number): NewLocationPoint {
  return {
    recordedAt: '2026-08-23T00:00:00.000Z',
    localDate: '2026-08-23',
    latitude,
    longitude,
    altitude: null,
    speed: null,
    heading: null,
    accuracy: 10,
    altitudeAccuracy: null,
  };
}

describe('挿入GPSポイントの日別距離差分', () => {
  it('末尾挿入では直前点からの区間距離を返す', () => {
    const previous = savedPoint(1, 35, 139);
    const inserted = newPoint(35.001, 139.001);

    expect(calculateInsertedPointDistanceDeltaMeters(previous, inserted, null)).toBeCloseTo(
      distanceMeters(toEffectiveLocationPoint(previous), toEffectiveLocationPoint(inserted)),
    );
  });

  it('先頭挿入では直後点までの区間距離を返す', () => {
    const inserted = newPoint(35.001, 139.001);
    const next = savedPoint(2, 35.002, 139.002);

    expect(calculateInsertedPointDistanceDeltaMeters(null, inserted, next)).toBeCloseTo(
      distanceMeters(toEffectiveLocationPoint(inserted), toEffectiveLocationPoint(next)),
    );
  });

  it('途中挿入では既存区間を置き換える差分だけを返す', () => {
    const previous = savedPoint(1, 35, 139);
    const inserted = newPoint(35.001, 139.001);
    const next = savedPoint(2, 35.002, 139.002);

    const expected =
      distanceMeters(toEffectiveLocationPoint(previous), toEffectiveLocationPoint(inserted)) +
      distanceMeters(toEffectiveLocationPoint(inserted), toEffectiveLocationPoint(next)) -
      distanceMeters(toEffectiveLocationPoint(previous), toEffectiveLocationPoint(next));

    expect(calculateInsertedPointDistanceDeltaMeters(previous, inserted, next)).toBeCloseTo(Math.max(0, expected));
  });

  it('丸め誤差を含んでも日別距離の差分を負にしない', () => {
    const previous = savedPoint(1, 35, 139);
    const inserted = newPoint(35, 139);
    const next = savedPoint(2, 35, 139);

    expect(calculateInsertedPointDistanceDeltaMeters(previous, inserted, next)).toBeGreaterThanOrEqual(0);
  });

  it('同日の最初の1点は距離を増やさない', () => {
    expect(calculateInsertedPointDistanceDeltaMeters(null, newPoint(35, 139), null)).toBe(0);
  });
});
