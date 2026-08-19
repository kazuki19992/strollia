/** 滞在場所の共有時に選べる非表示半径（メートル）。 */
export const STAY_PLACE_PRIVACY_RADIUS_METERS = [100, 200, 500, 1000, 2000, 3000, 5000, 10000] as const;

/**
 * Determines whether a privacy radius can be selected when sharing a stay place.
 *
 * @param value - The privacy radius in meters, or `null` for no radius
 * @returns `true` if the value is `null` or an allowed privacy radius, `false` otherwise
 */
export function isStayPlacePrivacyRadiusMeters(value: number | null): boolean {
  return value === null || STAY_PLACE_PRIVACY_RADIUS_METERS.some((radius) => radius === value);
}

/** SQLiteに保存する滞在場所。 */
export type StayPlace = {
  id: number;
  name: string;
  iconHexcode: string;
  latitude: number;
  longitude: number;
  privacyRadiusMeters: number | null;
  createdAt: string;
  updatedAt: string;
};

/** 滞在場所を新規作成・更新するときの保存入力。 */
export type SaveStayPlaceInput = Omit<StayPlace, 'id' | 'createdAt' | 'updatedAt'>;
