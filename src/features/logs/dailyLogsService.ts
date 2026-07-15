import { getLocationPointAdminAreaNames } from '@/features/achievements/adminAreaRepository';

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
