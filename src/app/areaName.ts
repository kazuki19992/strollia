import * as Location from 'expo-location';

/**
 * 逆ジオコーディング結果から現在地ピルに表示する地域名を選ぶ。
 *
 * @param address - Expo Locationの住所情報。取得できなかった場合はnullを渡す。
 * @returns 市区町村相当の表示名。地名が得られない場合はnull。
 */
export function getAreaNameFromAddress(address: Location.LocationGeocodedAddress | null | undefined): string | null {
  return address?.city ?? address?.district ?? address?.subregion ?? address?.region ?? null;
}

/** 現在地パネルに表示する地域名。 */
export type AreaLabel = {
  /** 大きく表示する市区町村名。 */
  primary: string;
  /** 小さく添える町名・大字など。 */
  secondary: string | null;
};

/**
 * 逆ジオコーディング結果から現在地パネル用の地域名を組み立てる。
 *
 * @param address - Expo Locationの住所情報。取得できなかった場合はnullを渡す。
 * @returns 市区町村名を主表示、町名・大字などを副表示にしたラベル。地名が得られない場合はnull。
 */
export function getAreaLabelFromAddress(address: Location.LocationGeocodedAddress | null | undefined): AreaLabel | null {
  const primary = getAreaNameFromAddress(address);
  if (primary === null) {
    return null;
  }
  const secondaryCandidates = [address?.district, address?.name, address?.street, address?.subregion].filter((value): value is string =>
    Boolean(value && value !== primary),
  );

  return { primary, secondary: secondaryCandidates[0] ?? null };
}
