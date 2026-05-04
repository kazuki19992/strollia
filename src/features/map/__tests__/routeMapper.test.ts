import { LocationPoint } from '../../../types/gps';
import { createInitialRegion, toRouteCoordinates } from '../routeMapper';

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

describe('routeMapper', () => {
  it('converts stored points to map coordinates', () => {
    expect(toRouteCoordinates([point(35.1, 139.1)])).toEqual([
      { latitude: 35.1, longitude: 139.1 },
    ]);
  });

  it('creates a region that includes all points', () => {
    const region = createInitialRegion([point(35, 139), point(36, 140)]);

    expect(region.latitude).toBeCloseTo(35.5);
    expect(region.longitude).toBeCloseTo(139.5);
    expect(region.latitudeDelta).toBeGreaterThan(1);
    expect(region.longitudeDelta).toBeGreaterThan(1);
  });
});
