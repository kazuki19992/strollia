import { NewLocationPoint } from '../../../types/gps';
import { shouldSaveLocationPoint } from '../locationSaveFilter';

function point(latitude: number, longitude: number, accuracy: number | null = 10): NewLocationPoint {
  return {
    recordedAt: '2026-05-05T00:00:00.000Z',
    localDate: '2026-05-05',
    latitude,
    longitude,
    altitude: null,
    speed: null,
    heading: null,
    accuracy,
    altitudeAccuracy: null,
  };
}

describe('GPSポイント保存判定 shouldSaveLocationPoint', () => {
  it('水平方向の精度が低いポイントは破棄する', () => {
    expect(shouldSaveLocationPoint(point(35, 139, 51), null)).toBe(false);
  });

  it('精度が十分な最初のポイントは保存対象にする', () => {
    expect(shouldSaveLocationPoint(point(35, 139, 50), null)).toBe(true);
  });

  it('最小距離未満しか移動していないポイントは破棄する', () => {
    const previous = point(35, 139);
    const next = point(35.00001, 139);

    expect(shouldSaveLocationPoint(next, previous, { minDistanceMeters: 5 })).toBe(false);
  });

  it('最小距離以上移動したポイントは保存対象にする', () => {
    const previous = point(35, 139);
    const next = point(35.0001, 139);

    expect(shouldSaveLocationPoint(next, previous, { minDistanceMeters: 5 })).toBe(true);
  });
});
