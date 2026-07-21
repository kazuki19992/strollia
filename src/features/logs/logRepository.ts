import { db, withExclusiveTransaction } from '@/db/database';
import { DailyLogSummary, LocationPoint, NewLocationPoint } from '@/types/gps';
import { distanceMeters } from '@/utils/distance';

/** DB列名をアプリ内のcamelCaseプロパティへ揃える共通SELECT句。 */
const pointColumns = `
  id,
  recorded_at as recordedAt,
  local_date as localDate,
  latitude,
  longitude,
  altitude,
  speed,
  heading,
  accuracy,
  altitude_accuracy as altitudeAccuracy
`;

/** GPSポイントを保存し、日別サマリーの点数と距離を同時に更新する。 */
export async function insertLocationPoint(point: NewLocationPoint): Promise<number> {
  const now = new Date().toISOString();
  const previousPoint = await getLatestLocationPointByDate(point.localDate);
  const segmentDistanceMeters = previousPoint ? distanceMeters(previousPoint, point) : 0;
  let insertedLocationPointId = 0;

  await withExclusiveTransaction(async (txn) => {
    const result = await txn.runAsync(
      `INSERT INTO location_points (
        recorded_at,
        local_date,
        latitude,
        longitude,
        altitude,
        speed,
        heading,
        accuracy,
        altitude_accuracy,
        source,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'expo-location', ?)`,
      point.recordedAt,
      point.localDate,
      point.latitude,
      point.longitude,
      point.altitude,
      point.speed,
      point.heading,
      point.accuracy,
      point.altitudeAccuracy,
      now,
    );
    insertedLocationPointId = result.lastInsertRowId;

    await txn.runAsync(
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
        distance_meters = COALESCE(daily_logs.distance_meters, 0) + excluded.distance_meters,
        updated_at = excluded.updated_at`,
      point.localDate,
      point.recordedAt,
      point.recordedAt,
      segmentDistanceMeters,
      now,
      now,
    );
  });

  return insertedLocationPointId;
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

/** 日別距離を差分加算するため、同じ日の最後の保存点を取得する。 */
async function getLatestLocationPointByDate(localDate: string): Promise<LocationPoint | null> {
  const point = await db.getFirstAsync<LocationPoint>(
    `SELECT ${pointColumns}
     FROM location_points
     WHERE local_date = ?
     ORDER BY recorded_at DESC
     LIMIT 1`,
    localDate,
  );

  return point ?? null;
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
      MIN(latitude) as minLatitude,
      MAX(latitude) as maxLatitude,
      MIN(longitude) as minLongitude,
      MAX(longitude) as maxLongitude,
      COUNT(*) as pointCount
     FROM location_points
     WHERE latitude BETWEEN -90 AND 90
       AND longitude BETWEEN -180 AND 180`,
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

/** ユーザー操作による全ユーザーデータ削除を1トランザクションで実行する。 */
export async function deleteAllUserData(): Promise<void> {
  await withExclusiveTransaction(async (txn) => {
    await txn.runAsync('DELETE FROM visited_cells');
    await txn.runAsync('DELETE FROM achievement_notification_queue');
    await txn.runAsync('DELETE FROM achievement_unlocks');
    await txn.runAsync('DELETE FROM visited_admin_areas');
    await txn.runAsync('DELETE FROM location_point_admin_areas');
    await txn.runAsync('DELETE FROM location_points');
    await txn.runAsync('DELETE FROM daily_logs');
  });
}
