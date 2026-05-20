import { db } from '../../db/database';
import { formatReportMonth, ReportMonth } from './monthlyReport';

/** 月次レポートで表示する都道府県ランキング項目。 */
export type MonthlyPrefectureRankingItem = {
  /** 都道府県名。 */
  name: string;
  /** 対象月内に訪問済みとして扱えた市区町村数。 */
  count: number;
};

/** 月次レポートで表示する行政区域サマリー。 */
export type MonthlyAreaReport = {
  /** よくいた都道府県ランキング。 */
  prefectureRanking: MonthlyPrefectureRankingItem[];
  /** 代表市区町村名。 */
  topMunicipalityName: string | null;
};

type PrefectureRankingRow = {
  name: string;
  count: number;
};

type MunicipalityRow = {
  prefectureName: string;
  municipalityName: string;
};

/** 月次レポート対象月の開始・終了境界をISO文字列で作る。 */
function getMonthRange(month: ReportMonth): { from: string; to: string } {
  const from = new Date(month.year, month.month - 1, 1).toISOString();
  const to = new Date(month.year, month.month, 1).toISOString();
  return { from, to };
}

/** 訪問済み行政区域から月次レポート用の行政区域サマリーを取得する。 */
export async function getMonthlyAreaReport(month: ReportMonth): Promise<MonthlyAreaReport> {
  const { from, to } = getMonthRange(month);
  const monthLabel = formatReportMonth(month);
  const municipalityRows = await db.getAllAsync<PrefectureRankingRow>(
    `SELECT prefecture_name as name, COUNT(*) as count
     FROM visited_admin_areas
     WHERE area_type = 'municipality'
       AND first_visited_at < ?
       AND last_visited_at >= ?
     GROUP BY prefecture_name
     ORDER BY count DESC, prefecture_name ASC
     LIMIT 3`,
    to,
    from,
  );
  const fallbackPrefectureRows =
    municipalityRows.length > 0
      ? []
      : await db.getAllAsync<PrefectureRankingRow>(
          `SELECT prefecture_name as name, 1 as count
           FROM visited_admin_areas
           WHERE area_type = 'prefecture'
             AND substr(first_visited_at, 1, 7) <= ?
             AND substr(last_visited_at, 1, 7) >= ?
           ORDER BY last_visited_at DESC, prefecture_name ASC
           LIMIT 3`,
          monthLabel,
          monthLabel,
        );
  const topMunicipality = await db.getFirstAsync<MunicipalityRow>(
    `SELECT prefecture_name as prefectureName, municipality_name as municipalityName
     FROM visited_admin_areas
     WHERE area_type = 'municipality'
       AND municipality_name IS NOT NULL
       AND first_visited_at < ?
       AND last_visited_at >= ?
     ORDER BY last_visited_at DESC, municipality_name ASC
     LIMIT 1`,
    to,
    from,
  );

  return {
    prefectureRanking: municipalityRows.length > 0 ? municipalityRows : fallbackPrefectureRows,
    topMunicipalityName: topMunicipality ? `${topMunicipality.prefectureName}${topMunicipality.municipalityName}` : null,
  };
}
