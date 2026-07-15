import { getLocationPointAdminAreaNames } from '@/features/achievements/adminAreaRepository';
import { getLocationPointsByDates } from '@/features/logs/logRepository';
import { LocationPoint } from '@/types/gps';
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
 * 日別距離の合計を優先し、距離が欠落している日だけGPSポイントから再計算する。
 *
 * 全期間のGPSポイントをメモリへロードせず、欠落している日付だけをまとめて取得することで
 * データ量に依存しない総距離計算にする(2026-07-14のメモリ超過クラッシュ対策の一部)。
 * `achievementRepository.getAchievementProgress` と `useLocationRecordingSync` の
 * 両方から使う共通ヘルパー。
 *
 * @param dailyLogs - 日付と距離のペア一覧(`DailyLogSummary` 等、この形を満たす配列を渡せる)。
 * @returns 総移動距離メートル。
 */
export async function calculateTotalDistanceMeters(dailyLogs: DailyDistanceEntry[]): Promise<number> {
  const fixedDistance = dailyLogs.reduce((total, log) => total + (log.distanceMeters ?? 0), 0);
  const fallbackDates = dailyLogs.filter((log) => log.distanceMeters == null).map((log) => log.localDate);

  if (fallbackDates.length === 0) {
    return fixedDistance;
  }

  const points = await getLocationPointsByDates(fallbackDates);
  const pointsByDate = new Map<string, LocationPoint[]>();

  for (const point of points) {
    const datePoints = pointsByDate.get(point.localDate) ?? [];
    datePoints.push(point);
    pointsByDate.set(point.localDate, datePoints);
  }

  const fallbackDistance = fallbackDates.reduce((total, localDate) => total + totalDistanceMeters(pointsByDate.get(localDate) ?? []), 0);

  return fixedDistance + fallbackDistance;
}
