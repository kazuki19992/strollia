import { createUserCenteredRegion, isValidMapCoordinate, shouldRestoreMapRegionOnMapOpen, USER_LOCATION_REGION_DELTA } from '../mapRegion';

describe('地図表示範囲 mapRegion', () => {
  test('現在地中心の通常縮尺Regionを作る', () => {
    expect(createUserCenteredRegion({ latitude: 35.681236, longitude: 139.767125 })).toEqual({
      latitude: 35.681236,
      longitude: 139.767125,
      latitudeDelta: USER_LOCATION_REGION_DELTA,
      longitudeDelta: USER_LOCATION_REGION_DELTA,
    });
  });

  test('地図復帰時は現在地取得済みかつ追従中の場合だけRegionを復元する', () => {
    const userCoordinate = { latitude: 35.681236, longitude: 139.767125 };

    expect(shouldRestoreMapRegionOnMapOpen({ userCoordinate, isFollowingUserLocation: true })).toBe(true);
    expect(shouldRestoreMapRegionOnMapOpen({ userCoordinate, isFollowingUserLocation: false })).toBe(false);
    expect(shouldRestoreMapRegionOnMapOpen({ userCoordinate: null, isFollowingUserLocation: true })).toBe(false);
  });

  test('MapKitへ渡せない現在地座標を不正として扱う', () => {
    expect(isValidMapCoordinate({ latitude: Number.NaN, longitude: 139.767125 })).toBe(false);
    expect(isValidMapCoordinate({ latitude: 35.681236, longitude: Number.POSITIVE_INFINITY })).toBe(false);
    expect(isValidMapCoordinate({ latitude: 91, longitude: 139.767125 })).toBe(false);
    expect(isValidMapCoordinate({ latitude: 35.681236, longitude: 181 })).toBe(false);
    expect(isValidMapCoordinate({ latitude: 35.681236, longitude: 139.767125 })).toBe(true);
  });

  test('不正な現在地座標ではRegionを作らない', () => {
    expect(() => createUserCenteredRegion({ latitude: Number.NaN, longitude: 139.767125 })).toThrow();
    expect(() => createUserCenteredRegion({ latitude: 35.681236, longitude: Number.POSITIVE_INFINITY })).toThrow();
    expect(() => createUserCenteredRegion({ latitude: 91, longitude: 139.767125 })).toThrow();
    expect(() => createUserCenteredRegion({ latitude: 35.681236, longitude: 181 })).toThrow();
  });

  test('有効な現在地座標ではRegionを作る', () => {
    expect(() => createUserCenteredRegion({ latitude: 35.681236, longitude: 139.767125 })).not.toThrow();
    expect(createUserCenteredRegion({ latitude: 35.681236, longitude: 139.767125 })).toEqual({
      latitude: 35.681236,
      longitude: 139.767125,
      latitudeDelta: USER_LOCATION_REGION_DELTA,
      longitudeDelta: USER_LOCATION_REGION_DELTA,
    });
  });
});
