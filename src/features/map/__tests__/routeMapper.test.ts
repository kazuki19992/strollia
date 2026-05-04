import { LocationPoint } from '../../../types/gps';
import {
  createInitialRegion,
  filterRouteCoordinatesByRegion,
  simplifyRouteCoordinates,
  toRenderRouteCoordinates,
  toRouteCoordinates,
} from '../routeMapper';

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

  it('simplifies nearly straight route coordinates while keeping endpoints', () => {
    const route = [
      { latitude: 35, longitude: 139 },
      { latitude: 35.00001, longitude: 139.00001 },
      { latitude: 35.00002, longitude: 139.00002 },
      { latitude: 35.001, longitude: 139.001 },
    ];

    expect(simplifyRouteCoordinates(route, 10)).toEqual([route[0], route[3]]);
  });

  it('keeps shape points that exceed the simplification tolerance', () => {
    const route = [
      { latitude: 35, longitude: 139 },
      { latitude: 35.001, longitude: 139.002 },
      { latitude: 35.002, longitude: 139 },
    ];

    expect(simplifyRouteCoordinates(route, 10)).toEqual(route);
  });

  it('creates render coordinates from stored points', () => {
    const coordinates = toRenderRouteCoordinates([point(35, 139), point(35.00001, 139), point(35.001, 139)], 10);

    expect(coordinates[0]).toEqual({ latitude: 35, longitude: 139 });
    expect(coordinates.at(-1)).toEqual({ latitude: 35.001, longitude: 139 });
  });

  it('filters route coordinates to a padded visible region', () => {
    const route = [
      { latitude: 34, longitude: 138 },
      { latitude: 35, longitude: 139 },
      { latitude: 35.01, longitude: 139.01 },
      { latitude: 36, longitude: 140 },
      { latitude: 37, longitude: 141 },
    ];
    const region = {
      latitude: 35,
      longitude: 139,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };

    expect(filterRouteCoordinatesByRegion(route, region, 0)).toEqual([route[0], route[1], route[2], route[3]]);
  });

  it('creates a region that includes all points', () => {
    const region = createInitialRegion([point(35, 139), point(36, 140)]);

    expect(region.latitude).toBeCloseTo(35.5);
    expect(region.longitude).toBeCloseTo(139.5);
    expect(region.latitudeDelta).toBeGreaterThan(1);
    expect(region.longitudeDelta).toBeGreaterThan(1);
  });
});
