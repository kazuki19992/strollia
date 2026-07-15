import { db } from '@/db/database';
import { ReportMonth } from './monthlyReport';

/** 月次レポートで表示する都道府県ランキング項目。 */
export type MonthlyPrefectureRankingItem = {
  /** 都道府県名。 */
  name: string;
  /** 対象月内にその都道府県として保存されたGPSポイント数。 */
  count: number;
};

/** 月次レポートで表示する行政区域サマリー。 */
export type MonthlyAreaReport = {
  /** よくいた都道府県ランキング。 */
  prefectureRanking: MonthlyPrefectureRankingItem[];
  /** 代表市区町村名。 */
  topMunicipalityName: string | null;
};

/**
 * 月次都道府県ランキング集計クエリの内部行。
 *
 * @property name 都道府県名。
 * @property count 対象月内に保存されたGPSポイント数。
 */
type PrefectureRankingRow = {
  name: string;
  count: number;
};

/**
 * 月次代表市区町村集計クエリの内部行。
 *
 * @property prefectureName 都道府県名。
 * @property municipalityName 市区町村名。
 * @property count 対象月内に保存されたGPSポイント数。
 */
type MunicipalityRow = {
  prefectureName: string;
  municipalityName: string;
  count: number;
};

/** 月次レポート対象月の開始・終了境界をlocal_date文字列で作る。 */
function getMonthRange(month: ReportMonth): { from: string; to: string } {
  const fromDate = new Date(month.year, month.month - 1, 1);
  const toDate = new Date(month.year, month.month, 1);
  return { from: toLocalDate(fromDate), to: toLocalDate(toDate) };
}

/** DateをSQLiteのlocal_dateと同じYYYY-MM-DDへ変換する。 */
function toLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** GPSポイント単位の行政区域履歴から月次レポート用サマリーを取得する。 */
export async function getMonthlyAreaReport(month: ReportMonth): Promise<MonthlyAreaReport> {
  const { from, to } = getMonthRange(month);
  const prefectureRows = await db.getAllAsync<PrefectureRankingRow>(
    `SELECT prefecture_name as name, COUNT(*) as count
     FROM location_point_admin_areas
     WHERE local_date >= ?
       AND local_date < ?
     GROUP BY normalized_prefecture_name
     ORDER BY count DESC, prefecture_name ASC
     LIMIT 3`,
    from,
    to,
  );
  const topMunicipality = await db.getFirstAsync<MunicipalityRow>(
    `SELECT prefecture_name as prefectureName, municipality_name as municipalityName, COUNT(*) as count
     FROM location_point_admin_areas
     WHERE local_date >= ?
       AND local_date < ?
       AND municipality_name IS NOT NULL
     GROUP BY normalized_prefecture_name, normalized_municipality_name
     ORDER BY count DESC, prefecture_name ASC, municipality_name ASC
     LIMIT 1`,
    from,
    to,
  );

  return {
    prefectureRanking: prefectureRows,
    topMunicipalityName: topMunicipality ? `${topMunicipality.prefectureName}${topMunicipality.municipalityName}` : null,
  };
}
