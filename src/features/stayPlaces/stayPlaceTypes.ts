/** 滞在場所の共有時に選べる非表示半径（メートル）。 */
export const STAY_PLACE_PRIVACY_RADIUS_METERS = [50, 100, 200, 300, 500] as const;

/** 共有時に選べる非表示半径かを判定する。 */
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
