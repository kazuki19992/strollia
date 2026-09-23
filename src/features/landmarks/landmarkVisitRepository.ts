import type * as SQLite from 'expo-sqlite';

import { db } from '@/db/database';

/** スポットへの到達記録1件。 */
export type LandmarkSpotVisit = {
  /** マスタのUUIDv7。 */
  spotId: string;
  /** 到達確定時刻(ISO8601)。 */
  visitedAt: string;
  /** 日別記録詳細への遷移に使うローカル日付。 */
  visitedLocalDate: string;
  /** 到達を確定した根拠GPSポイント。保存されない観測で確定した場合はnull。 */
  locationPointId: number | null;
};

/** 到達済みのスポットをすべて取得する。 */
export async function getLandmarkSpotVisits(): Promise<LandmarkSpotVisit[]> {
  return db.getAllAsync<LandmarkSpotVisit>(
    `SELECT spot_id AS spotId,
            visited_at AS visitedAt,
            visited_local_date AS visitedLocalDate,
            location_point_id AS locationPointId
     FROM landmark_spot_visits`,
  );
}

/** 到達済みスポットIDの集合を取得する。 */
export async function getVisitedLandmarkSpotIds(): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ spotId: string }>('SELECT spot_id AS spotId FROM landmark_spot_visits');
  return new Set(rows.map((row) => row.spotId));
}

/**
 * 現在の排他トランザクション内で到達を記録する。
 *
 * INSERT OR IGNORE とすることで、同じスポットの再到達で初回の到達日時を上書きしない。
 * 実績は「一度達成したら取り消さない」方針であり、初回の記録が正となる。
 */
export async function insertLandmarkSpotVisitInCurrentTransaction(
  visit: LandmarkSpotVisit,
  createdAt: string,
  runner: SQLite.SQLiteDatabase,
): Promise<void> {
  await runner.runAsync(
    `INSERT OR IGNORE INTO landmark_spot_visits (spot_id, visited_at, visited_local_date, location_point_id, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    visit.spotId,
    visit.visitedAt,
    visit.visitedLocalDate,
    visit.locationPointId,
    createdAt,
  );
}
