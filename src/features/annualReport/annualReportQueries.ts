import { db } from '@/db/database';

/** ハイライトとして返す最大件数。 */
const HIGHLIGHT_LIMIT = 3;

/** 日別の記録点数と距離。距離が未計算の日は distanceMeters が null になる。 */
export type DailyDistanceRow = { localDate: string; pointCount: number; distanceMeters: number | null };

/**
 * 期間内の記録がある日(point_count > 0)を日別ログから取得する。
 * 集計中にアプリを固めないため、GPSポイントは読まず daily_logs の値だけを返す。
 */
export async function getDailyDistanceRows(fromDate: string, toDate: string): Promise<DailyDistanceRow[]> {
  const rows = await db.getAllAsync<{ local_date: string; point_count: number; distance_meters: number | null }>(
    `SELECT local_date, point_count, distance_meters
     FROM daily_logs
     WHERE local_date BETWEEN ? AND ? AND point_count > 0
     ORDER BY local_date ASC`,
    fromDate,
    toDate,
  );
  return rows.map((row) => ({ localDate: row.local_date, pointCount: row.point_count, distanceMeters: row.distance_meters }));
}

/** 期間内に記録した地点が属する都道府県名(重複なし)を返す。 */
export async function getVisitedPrefectureNames(fromDate: string, toDate: string): Promise<string[]> {
  const rows = await db.getAllAsync<{ prefecture_name: string }>(
    `SELECT DISTINCT prefecture_name
     FROM location_point_admin_areas
     WHERE local_date BETWEEN ? AND ?
     ORDER BY prefecture_name ASC`,
    fromDate,
    toDate,
  );
  return rows.map((row) => row.prefecture_name);
}

/** 期間内に初訪問した都道府県名と市区町村数。範囲は [fromIso, toIsoExclusive)。 */
export async function getNewAdminAreaSummary(
  fromIso: string,
  toIsoExclusive: string,
): Promise<{ newPrefectures: string[]; newMunicipalityCount: number }> {
  const prefectures = await db.getAllAsync<{ prefecture_name: string }>(
    `SELECT prefecture_name
     FROM visited_admin_areas
     WHERE area_type = 'prefecture' AND first_visited_at >= ? AND first_visited_at < ?
     ORDER BY first_visited_at ASC`,
    fromIso,
    toIsoExclusive,
  );
  const municipalities = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM visited_admin_areas
     WHERE area_type = 'municipality' AND first_visited_at >= ? AND first_visited_at < ?`,
    fromIso,
    toIsoExclusive,
  );
  return {
    newPrefectures: prefectures.map((row) => row.prefecture_name),
    newMunicipalityCount: municipalities?.count ?? 0,
  };
}

/** 期間内に初めて塗られたエリア数と、期間開始前までに塗られていたエリア数。範囲は [fromIso, toIsoExclusive)。 */
export async function getVisitedCellCounts(
  fromIso: string,
  toIsoExclusive: string,
): Promise<{ newCellCount: number; previousCellCount: number }> {
  const fresh = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM visited_cells WHERE first_visited_at >= ? AND first_visited_at < ?`,
    fromIso,
    toIsoExclusive,
  );
  const previous = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM visited_cells WHERE first_visited_at < ?`,
    fromIso,
  );
  return { newCellCount: fresh?.count ?? 0, previousCellCount: previous?.count ?? 0 };
}

/** 期間内に解除された実績の件数と、新しい順のハイライト(最大3件)。 */
export async function getAchievementUnlockSummary(
  fromDate: string,
  toDate: string,
): Promise<{ count: number; highlights: { id: string; unlockedLocalDate: string }[] }> {
  const total = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM achievement_unlocks WHERE unlocked_local_date BETWEEN ? AND ?`,
    fromDate,
    toDate,
  );
  const rows = await db.getAllAsync<{ achievement_id: string; unlocked_local_date: string }>(
    `SELECT achievement_id, unlocked_local_date
     FROM achievement_unlocks
     WHERE unlocked_local_date BETWEEN ? AND ?
     ORDER BY unlocked_local_date DESC, unlocked_at DESC
     LIMIT ${HIGHLIGHT_LIMIT}`,
    fromDate,
    toDate,
  );
  return {
    count: total?.count ?? 0,
    highlights: rows.map((row) => ({ id: row.achievement_id, unlockedLocalDate: row.unlocked_local_date })),
  };
}

/** 期間内に到達したスポットの件数と、新しい順のハイライト(最大3件)。 */
export async function getLandmarkSpotVisitSummary(
  fromDate: string,
  toDate: string,
): Promise<{ count: number; highlights: { id: string; visitedLocalDate: string }[] }> {
  const total = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM landmark_spot_visits WHERE visited_local_date BETWEEN ? AND ?`,
    fromDate,
    toDate,
  );
  const rows = await db.getAllAsync<{ spot_id: string; visited_local_date: string }>(
    `SELECT spot_id, visited_local_date
     FROM landmark_spot_visits
     WHERE visited_local_date BETWEEN ? AND ?
     ORDER BY visited_local_date DESC, visited_at DESC
     LIMIT ${HIGHLIGHT_LIMIT}`,
    fromDate,
    toDate,
  );
  return {
    count: total?.count ?? 0,
    highlights: rows.map((row) => ({ id: row.spot_id, visitedLocalDate: row.visited_local_date })),
  };
}

/**
 * その日(YYYY-MM-DD)の端末ローカル0:00をISO文字列にする。
 * first_visited_at はISO(UTC)で保存されているため、ローカル日の境界へ変換して範囲比較に使う。
 * 終端は periodEnd の翌日0:00を排他で渡す。
 */
export function toLocalDayStartIso(localDate: string): string {
  const [year, month, day] = localDate.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
}
