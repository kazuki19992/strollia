import type { LatLng, Region } from 'react-native-maps';

/** 現在地へ戻るときの地図表示範囲。 */
export const USER_LOCATION_REGION_DELTA = 0.01;

type MapRegionRestoreState = {
  /** 現在地座標。 */
  userCoordinate: LatLng | null;
  /** 現在地追従中か。 */
  isFollowingUserLocation: boolean;
};

/**
 * 指定座標を中心にした通常利用向けの地図表示範囲を作る。
 *
 * @param coordinate - 中心にする緯度経度。
 * @returns 現在地追従や地図復帰で使う表示範囲。
 */
export function createUserCenteredRegion(coordinate: LatLng): Region {
  return {
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    latitudeDelta: USER_LOCATION_REGION_DELTA,
    longitudeDelta: USER_LOCATION_REGION_DELTA,
  };
}

/**
 * 別画面から地図へ戻るときに現在地中心へ復元するか判定する。
 *
 * @param state - 現在地と追従状態。
 * @returns 現在地中心へ復元する場合はtrue。
 */
export function shouldRestoreMapRegionOnMapOpen(state: MapRegionRestoreState): boolean {
  return Boolean(state.userCoordinate && state.isFollowingUserLocation);
}
