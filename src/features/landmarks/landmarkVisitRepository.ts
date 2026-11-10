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
 *
 * @returns 新しく行を追加した場合はtrue。既に到達済みだった場合はfalse。
 *   呼び出し側はこの値で「初回の到達か」を判定し、通知と実績評価の二重実行を防ぐ。
 */
export async function insertLandmarkSpotVisitInCurrentTransaction(
  visit: LandmarkSpotVisit,
  createdAt: string,
  runner: SQLite.SQLiteDatabase,
): Promise<boolean> {
  const result = await runner.runAsync(
    `INSERT OR IGNORE INTO landmark_spot_visits (spot_id, visited_at, visited_local_date, location_point_id, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    visit.spotId,
    visit.visitedAt,
    visit.visitedLocalDate,
    visit.locationPointId,
    createdAt,
  );

  return result.changes > 0;
}

/**
 * 複数地点スポットの地点1つへの到達記録1件。
 *
 * 円1つのスポットでは `areaId` が `spotId` と同値の1地点として扱う。
 */
export type LandmarkAreaVisit = {
  /** 地点ID(円1つのスポットではスポットIDと同値)。 */
  areaId: string;
  /** 地点が属するスポットのUUIDv7。 */
  spotId: string;
  /** 到達確定時刻(ISO8601)。 */
  visitedAt: string;
  /** 到達日のローカル日付。 */
  visitedLocalDate: string;
  /** 到達を確定した根拠GPSポイント。保存されない観測で確定した場合はnull。 */
  locationPointId: number | null;
};

/** 到達済みの地点をすべて取得する。 */
export async function getLandmarkAreaVisits(): Promise<LandmarkAreaVisit[]> {
  return db.getAllAsync<LandmarkAreaVisit>(
    `SELECT area_id AS areaId,
            spot_id AS spotId,
            visited_at AS visitedAt,
            visited_local_date AS visitedLocalDate,
            location_point_id AS locationPointId
     FROM landmark_area_visits`,
  );
}

/** 到達済み地点IDの集合を取得する。 */
export async function getVisitedLandmarkAreaIds(): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ areaId: string }>('SELECT area_id AS areaId FROM landmark_area_visits');
  return new Set(rows.map((row) => row.areaId));
}

/**
 * 現在の排他トランザクション内で地点到達を記録する。
 *
 * スポット到達と同様に INSERT OR IGNORE とし、初回の到達日時を正とする。
 *
 * @returns 新しく行を追加した場合はtrue。既に到達済みだった場合はfalse。
 */
export async function insertLandmarkAreaVisitInCurrentTransaction(
  visit: LandmarkAreaVisit,
  createdAt: string,
  runner: SQLite.SQLiteDatabase,
): Promise<boolean> {
  const result = await runner.runAsync(
    `INSERT OR IGNORE INTO landmark_area_visits (area_id, spot_id, visited_at, visited_local_date, location_point_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    visit.areaId,
    visit.spotId,
    visit.visitedAt,
    visit.visitedLocalDate,
    visit.locationPointId,
    createdAt,
  );

  return result.changes > 0;
}

/**
 * 現在の排他トランザクション内で、スポットの到達済み地点数を数える。
 *
 * 全地点が揃ったか(スポット到達の確定)の判定を、記録と同一トランザクションで行うために使う。
 */
export async function countLandmarkAreaVisitsForSpotInCurrentTransaction(spotId: string, runner: SQLite.SQLiteDatabase): Promise<number> {
  const row = await runner.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM landmark_area_visits WHERE spot_id = ?', spotId);
  return row?.count ?? 0;
}
