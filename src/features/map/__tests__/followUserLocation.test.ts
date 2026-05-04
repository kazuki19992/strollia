import { isRegionCenteredOnCoordinate } from '../followUserLocation';

describe('isRegionCenteredOnCoordinate', () => {
  const region = {
    latitude: 35,
    longitude: 139,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  it('returns true when the coordinate is near the region center', () => {
    expect(isRegionCenteredOnCoordinate(region, { latitude: 35.001, longitude: 139.001 })).toBe(true);
  });

  it('returns false when the coordinate is away from the region center', () => {
    expect(isRegionCenteredOnCoordinate(region, { latitude: 35.01, longitude: 139.01 })).toBe(false);
  });
});
