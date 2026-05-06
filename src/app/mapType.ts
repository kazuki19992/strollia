import type { MapType } from 'react-native-maps';

/**
 * 標準地図とラベル付き航空写真を交互に切り替える。
 *
 * @param currentMapType - 現在MapViewに設定している地図種別。
 * @returns 次に設定する地図種別。
 */
export function getNextMapType(currentMapType: MapType): MapType {
  return currentMapType === 'standard' ? 'hybrid' : 'standard';
}
