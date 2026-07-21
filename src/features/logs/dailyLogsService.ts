import { getLocationPointAdminAreaNames } from '@/features/achievements/adminAreaRepository';
import { getLocationPointsByDate } from '@/features/logs/logRepository';
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
 * 欠落日のGPSポイントは1日ずつ逐次取得して距離計算後すぐに手放し、まとめて1配列へ
 * ロードしない。`distance_meters` が未保存のまま残っている既存ユーザー(distance
 * トラッキング導入前に記録した日が多いユーザー)ほど欠落日数が多くなりやすく、
 * 一括取得だと結局ほぼ全GPSポイントをJSメモリに載せてしまい、2026-07-14の
 * メモリ超過クラッシュを再発させる。1日単位の逐次処理にすることで、欠落日数に
 * 依存せずメモリ使用量を「その日のポイント数」分だけに有界化する。
 * `achievementRepository.getAchievementProgress` と `useLocationRecordingSync` の
 * 両方から使う共通ヘルパー(起動時 + フォアグラウンド中10秒ごとに呼ばれる)。
 *
 * @param dailyLogs - 日付と距離のペア一覧(`DailyLogSummary` 等、この形を満たす配列を渡せる)。
 * @returns 総移動距離メートル。
 */
export async function calculateTotalDistanceMeters(dailyLogs: DailyDistanceEntry[]): Promise<number> {
  const fixedDistance = dailyLogs.reduce((total, log) => total + (log.distanceMeters ?? 0), 0);
  const fallbackDates = dailyLogs.filter((log) => log.distanceMeters == null).map((log) => log.localDate);

  let fallbackDistance = 0;
  for (const localDate of fallbackDates) {
    const points = await getLocationPointsByDate(localDate);
    fallbackDistance += totalDistanceMeters(points);
  }

  return fixedDistance + fallbackDistance;
}
