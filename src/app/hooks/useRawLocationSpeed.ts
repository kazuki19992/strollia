/**
 * GPS raw speedを速度メーター表示用のkm/hへ変換する。
 *
 * @param rawSpeedMps - Expo Locationから渡されるm/s単位の速度。
 * @returns 表示に使うkm/h。更新すべき値がない場合はnull。
 */
export function toDisplaySpeedKmh(rawSpeedMps: number | null | undefined): number | null {
  if (rawSpeedMps == null || !Number.isFinite(rawSpeedMps) || rawSpeedMps < 0) {
    return null;
  }

  return rawSpeedMps * 3.6;
}
