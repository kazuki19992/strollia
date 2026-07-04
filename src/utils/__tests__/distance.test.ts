import { LocationPoint } from '@/types/gps';
import { distanceMeters, totalDistanceMeters } from '@/utils/distance';

function point(latitude: number, longitude: number): LocationPoint {
  return {
    id: 1,
    recordedAt: '2026-05-04T00:00:00.000Z',
    localDate: '2026-05-04',
    latitude,
    longitude,
    altitude: null,
    speed: null,
    heading: null,
    accuracy: null,
    altitudeAccuracy: null,
  };
}

describe('距離計算ユーティリティ', () => {
  it('同じ地点同士の距離は0mになる', () => {
    const a = point(35.681236, 139.767125);

    expect(distanceMeters(a, a)).toBeCloseTo(0);
  });

  it('隣接する地点間の距離を合計できる', () => {
    const points = [point(35, 139), point(35.001, 139), point(35.002, 139)];

    expect(totalDistanceMeters(points)).toBeGreaterThan(200);
    expect(totalDistanceMeters(points)).toBeLessThan(230);
  });
});
