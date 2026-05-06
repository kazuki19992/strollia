import { isRegionCenteredOnCoordinate } from '../followUserLocation';

describe('isRegionCenteredOnCoordinate', () => {
  const region = {
    latitude: 35,
    longitude: 139,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  it('座標が表示範囲の中心付近にある場合はtrueを返す', () => {
    expect(isRegionCenteredOnCoordinate(region, { latitude: 35.001, longitude: 139.001 })).toBe(true);
  });

  it('座標が表示範囲の中心から離れている場合はfalseを返す', () => {
    expect(isRegionCenteredOnCoordinate(region, { latitude: 35.01, longitude: 139.01 })).toBe(false);
  });
});
