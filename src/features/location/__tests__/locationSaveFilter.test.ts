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

describe('shouldSaveLocationPoint', () => {
  it('rejects points with poor horizontal accuracy', () => {
    expect(shouldSaveLocationPoint(point(35, 139, 51), null)).toBe(false);
  });

  it('keeps the first accurate point', () => {
    expect(shouldSaveLocationPoint(point(35, 139, 50), null)).toBe(true);
  });

  it('rejects points that moved less than the minimum distance', () => {
    const previous = point(35, 139);
    const next = point(35.00001, 139);

    expect(shouldSaveLocationPoint(next, previous, { minDistanceMeters: 5 })).toBe(false);
  });

  it('keeps points that moved beyond the minimum distance', () => {
    const previous = point(35, 139);
    const next = point(35.0001, 139);

    expect(shouldSaveLocationPoint(next, previous, { minDistanceMeters: 5 })).toBe(true);
  });
});
