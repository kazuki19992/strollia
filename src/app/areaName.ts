import * as Location from 'expo-location';

/**
 * 逆ジオコーディング結果から現在地ピルに表示する地域名を選ぶ。
 *
 * @param address - Expo Locationの住所情報。取得できなかった場合はnullを渡す。
 * @returns 市区町村相当の表示名。詳細がない場合は「現在地付近」。
 */
export function getAreaNameFromAddress(address: Location.LocationGeocodedAddress | null | undefined): string {
  return address?.city ?? address?.district ?? address?.subregion ?? address?.region ?? '現在地付近';
}
