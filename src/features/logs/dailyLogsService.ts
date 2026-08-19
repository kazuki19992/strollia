import { getLocationPointAdminAreaNames } from '@/features/achievements/adminAreaRepository';
import { getLocationPointsByDate } from '@/features/logs/logRepository';
import { toEffectiveLocationPoint } from '@/features/location/effectiveLocationPoint';
import { totalDistanceMeters } from '@/utils/distance';

/**
 * 日別ログ一覧画面で必要な行政区域名をまとめて取得する。
 *
 * GPSポイントIDのリストを渡し、各IDに対応する「市町村名、または都道府県名」を返す。
 * 直接リポジトリを参照しても同じ結果だが、UIコンポーネントからDB操作を分離するため
 * サービス層を経由させる。
 *
 * @param locationPointIds 行政区域名を取得したいGPSポイントIDの配列。
 * @returns ポイントIDをキー、行政区域名を値とするマップ。
 */
export async function fetchAreaNamesByPointIds(locationPointIds: number[]): Promise<Map<number, string>> {
  return getLocationPointAdminAreaNames(locationPointIds);
}

/** 総移動距離計算に必要な最小限の日別距離情報。 */
export type DailyDistanceEntry = {
  localDate: string;
  distanceMeters: number | null;
};

/**
 * Calculates total travel distance from stored daily distances and GPS points for dates without stored distances.
 *
 * @param dailyLogs - Daily records containing local dates and optional stored distances.
 * @returns The total travel distance in meters.
 */
export async function calculateTotalDistanceMeters(dailyLogs: DailyDistanceEntry[]): Promise<number> {
  const fixedDistance = dailyLogs.reduce((total, log) => total + (log.distanceMeters ?? 0), 0);
  const fallbackDates = dailyLogs.filter((log) => log.distanceMeters == null).map((log) => log.localDate);

  let fallbackDistance = 0;
  for (const localDate of fallbackDates) {
    const points = await getLocationPointsByDate(localDate);
    fallbackDistance += totalDistanceMeters(points.map(toEffectiveLocationPoint));
  }

  return fixedDistance + fallbackDistance;
}
