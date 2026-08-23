import * as SQLite from 'expo-sqlite';
import { db, withExclusiveTransaction } from '@/db/database';
import { calculateInsertedPointDistanceDeltaMeters } from '@/features/logs/locationDistanceDelta';
import { DailyLogSummary, LocationPoint, NewLocationPoint } from '@/types/gps';

/** DB列名をアプリ内のcamelCaseプロパティへ揃える共通SELECT句。 */
const pointColumns = `
  id,
  recorded_at as recordedAt,
  local_date as localDate,
  latitude,
  longitude,
  effective_latitude as effectiveLatitude,
  effective_longitude as effectiveLongitude,
  snapped_stay_place_id as snappedStayPlaceId,
  altitude,
  speed,
  heading,
  accuracy,
  altitude_accuracy as altitudeAccuracy
`;

/** 1点を挿入して日別距離へ反映したトランザクション内の結果。 */
export type InsertedLocationPointResult = {
  locationPointId: number;
  previousPoint: LocationPoint | null;
  nextPoint: LocationPoint | null;
  distanceDeltaMeters: number;
};

/** 同一トランザクションで最新の保存済みGPSポイントを取得する。 */
export async function getLatestLocationPointInCurrentTransaction(runner: SQLite.SQLiteDatabase): Promise<LocationPoint | null> {
  const point = await runner.getFirstAsync<LocationPoint>(
    `SELECT ${pointColumns}
     FROM location_points
     ORDER BY recorded_at DESC, id DESC
     LIMIT 1`,
  );

  return point ?? null;
}

/**
 * GPSポイントをトランザクション内で挿入し、前後区間を考慮した日別距離を更新する。
 *
 * GPS点の一意制約だけを既存データ優先にし、重複時は日別集計を変更しない。
 * 通常のライブ記録は末尾追加だが、将来トランザクション内から時系列途中へ挿入されても
 * 既存区間との距離差分だけを反映する安全網を維持する。
 */
export async function insertLocationPointInCurrentTransaction(
  point: NewLocationPoint,
  now: string,
  runner: SQLite.SQLiteDatabase,
): Promise<InsertedLocationPointResult | null> {
  const insertResult = await runner.runAsync(
    `INSERT INTO location_points (
      recorded_at,
      local_date,
      latitude,
      longitude,
      effective_latitude,
      effective_longitude,
      snapped_stay_place_id,
      altitude,
      speed,
      heading,
      accuracy,
      altitude_accuracy,
      source,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'expo-location', ?)
    ON CONFLICT(recorded_at, latitude, longitude) DO NOTHING`,
    point.recordedAt,
    point.localDate,
    point.latitude,
    point.longitude,
    point.effectiveLatitude ?? point.latitude,
    point.effectiveLongitude ?? point.longitude,
    point.snappedStayPlaceId ?? null,
    point.altitude,
    point.speed,
    point.heading,
    point.accuracy,
    point.altitudeAccuracy,
    now,
  );

  if ((insertResult.changes ?? 0) === 0) {
    return null;
  }

  const locationPointId = insertResult.lastInsertRowId;
  const previousPoint = await runner.getFirstAsync<LocationPoint>(
    `SELECT ${pointColumns}
     FROM location_points
     WHERE local_date = ?
       AND (recorded_at < ? OR (recorded_at = ? AND id < ?))
     ORDER BY recorded_at DESC, id DESC
     LIMIT 1`,
    point.localDate,
    point.recordedAt,
    point.recordedAt,
    locationPointId,
  );
  const nextPoint = await runner.getFirstAsync<LocationPoint>(
    `SELECT ${pointColumns}
     FROM location_points
     WHERE local_date = ?
       AND (recorded_at > ? OR (recorded_at = ? AND id > ?))
     ORDER BY recorded_at ASC, id ASC
     LIMIT 1`,
    point.localDate,
    point.recordedAt,
    point.recordedAt,
    locationPointId,
  );
  const distanceDeltaMeters = calculateInsertedPointDistanceDeltaMeters(previousPoint ?? null, point, nextPoint ?? null);

  await runner.runAsync(
    `INSERT INTO daily_logs (
      local_date,
      started_at,
      ended_at,
      point_count,
      distance_meters,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, 1, ?, ?, ?)
    ON CONFLICT(local_date) DO UPDATE SET
      started_at = CASE
        WHEN daily_logs.started_at IS NULL OR excluded.started_at < daily_logs.started_at
        THEN excluded.started_at
        ELSE daily_logs.started_at
      END,
      ended_at = CASE
        WHEN daily_logs.ended_at IS NULL OR excluded.ended_at > daily_logs.ended_at
        THEN excluded.ended_at
        ELSE daily_logs.ended_at
      END,
      point_count = daily_logs.point_count + 1,
      distance_meters = CASE
        WHEN daily_logs.distance_meters IS NULL THEN NULL
        ELSE daily_logs.distance_meters + excluded.distance_meters
      END,
      updated_at = excluded.updated_at`,
    point.localDate,
    point.recordedAt,
    point.recordedAt,
    distanceDeltaMeters,
    now,
    now,
  );

  return { locationPointId, previousPoint: previousPoint ?? null, nextPoint: nextPoint ?? null, distanceDeltaMeters };
}

/** 日別ログの一覧表示に使うサマリーを新しい日付順で取得する。 */
export async function getDailyLogs(): Promise<DailyLogSummary[]> {
  return db.getAllAsync<DailyLogSummary>(
    `SELECT
      local_date as localDate,
      point_count as pointCount,
      started_at as startedAt,
      ended_at as endedAt,
      distance_meters as distanceMeters,
      (
        SELECT id
        FROM location_points
        WHERE location_points.local_date = daily_logs.local_date
        ORDER BY recorded_at ASC
        LIMIT 1
      ) as startLocationPointId,
      (
        SELECT id
        FROM location_points
        WHERE location_points.local_date = daily_logs.local_date
        ORDER BY recorded_at DESC
        LIMIT 1
      ) as endLocationPointId
    FROM daily_logs
    ORDER BY local_date DESC`,
  );
}

/** バックグラウンドタスクの保存フィルタで使う直近の保存済みGPS点を取得する。 */
export async function getLatestLocationPoint(): Promise<LocationPoint | null> {
  const point = await db.getFirstAsync<LocationPoint>(
    `SELECT ${pointColumns}
     FROM location_points
     ORDER BY recorded_at DESC
     LIMIT 1`,
  );

  return point ?? null;
}

/** 有効な緯度経度を持つ全ポイントの外接境界と件数。 */
export type LocationPointsBounds = {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
  /** 境界計算に使った有効ポイント件数。 */
  pointCount: number;
};

/** 全ポイントの緯度経度境界と件数をSQLで集計する。有効ポイントが0件ならnull。 */
export async function getLocationPointsBounds(): Promise<LocationPointsBounds | null> {
  const row = await db.getFirstAsync<{
    minLatitude: number | null;
    maxLatitude: number | null;
    minLongitude: number | null;
    maxLongitude: number | null;
    pointCount: number;
  }>(
    `SELECT
      MIN(CASE WHEN effective_latitude BETWEEN -90 AND 90 AND effective_longitude BETWEEN -180 AND 180 THEN effective_latitude ELSE latitude END) as minLatitude,
      MAX(CASE WHEN effective_latitude BETWEEN -90 AND 90 AND effective_longitude BETWEEN -180 AND 180 THEN effective_latitude ELSE latitude END) as maxLatitude,
      MIN(CASE WHEN effective_latitude BETWEEN -90 AND 90 AND effective_longitude BETWEEN -180 AND 180 THEN effective_longitude ELSE longitude END) as minLongitude,
      MAX(CASE WHEN effective_latitude BETWEEN -90 AND 90 AND effective_longitude BETWEEN -180 AND 180 THEN effective_longitude ELSE longitude END) as maxLongitude,
      COUNT(*) as pointCount
     FROM location_points
     WHERE (effective_latitude BETWEEN -90 AND 90 AND effective_longitude BETWEEN -180 AND 180)
        OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)`,
  );

  if (
    !row ||
    row.pointCount === 0 ||
    row.minLatitude == null ||
    row.maxLatitude == null ||
    row.minLongitude == null ||
    row.maxLongitude == null
  ) {
    return null;
  }

  return {
    minLatitude: row.minLatitude,
    maxLatitude: row.maxLatitude,
    minLongitude: row.minLongitude,
    maxLongitude: row.maxLongitude,
    pointCount: row.pointCount,
  };
}

/** 指定月(`"YYYY-MM"`形式)のポイントを時系列で取得する。月次レポート画面で使う。 */
export async function getLocationPointsByMonth(yearMonth: string): Promise<LocationPoint[]> {
  return db.getAllAsync<LocationPoint>(
    `SELECT ${pointColumns}
     FROM location_points
     WHERE local_date LIKE ?
     ORDER BY recorded_at ASC`,
    `${yearMonth}-%`,
  );
}

/** 日別ログ画面で使う指定日のGPSポイントを時系列で取得する。総距離フォールバック計算でも1日ずつ呼ばれる。 */
export async function getLocationPointsByDate(localDate: string): Promise<LocationPoint[]> {
  return db.getAllAsync<LocationPoint>(
    `SELECT ${pointColumns}
     FROM location_points
     WHERE local_date = ?
     ORDER BY recorded_at ASC`,
    localDate,
  );
}

/**
 * ユーザー操作による全ユーザーデータ削除を1トランザクションで実行する。
 *
 * ジオタグ付き写真のメタデータ(`photo_assets`)も対象に含める。写真本体は複製していないが、
 * 撮影位置は端末内に残る個人データであるため、全削除の取りこぼしを作らない。
 */
export async function deleteAllUserData(): Promise<void> {
  await withExclusiveTransaction(async (txn) => {
    await txn.runAsync('DELETE FROM location_recording_state');
    await txn.runAsync('DELETE FROM visited_cells');
    await txn.runAsync('DELETE FROM achievement_notification_queue');
    await txn.runAsync('DELETE FROM achievement_unlocks');
    await txn.runAsync('DELETE FROM visited_admin_areas');
    await txn.runAsync('DELETE FROM location_point_admin_areas');
    await txn.runAsync('DELETE FROM stay_places');
    await txn.runAsync('DELETE FROM location_points');
    await txn.runAsync('DELETE FROM daily_logs');
    await txn.runAsync('DELETE FROM photo_assets');
  });
}
