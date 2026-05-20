import { db } from '../../db/database';
import { DailyLogSummary, LocationPoint, NewLocationPoint } from '../../types/gps';
import { distanceMeters } from '../../utils/distance';

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
export async function insertLocationPoint(point: NewLocationPoint): Promise<void> {
  const now = new Date().toISOString();
  const previousPoint = await getLatestLocationPointByDate(point.localDate);
  const segmentDistanceMeters = previousPoint ? distanceMeters(previousPoint, point) : 0;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
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

    await db.runAsync(
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
}

/** 日別ログの一覧表示に使うサマリーを新しい日付順で取得する。 */
export async function getDailyLogs(): Promise<DailyLogSummary[]> {
  return db.getAllAsync<DailyLogSummary>(
    `SELECT
      local_date as localDate,
      point_count as pointCount,
      started_at as startedAt,
      ended_at as endedAt,
      distance_meters as distanceMeters
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

/** メインマップに表示する全期間のGPSポイントを時系列で取得する。 */
export async function getAllLocationPoints(): Promise<LocationPoint[]> {
  return db.getAllAsync<LocationPoint>(
    `SELECT ${pointColumns}
     FROM location_points
     ORDER BY recorded_at ASC`,
  );
}

/** 日別ログ画面で使う指定日のGPSポイントを時系列で取得する。 */
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
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM achievement_notification_queue');
    await db.runAsync('DELETE FROM achievement_unlocks');
    await db.runAsync('DELETE FROM visited_admin_areas');
    await db.runAsync('DELETE FROM location_points');
    await db.runAsync('DELETE FROM daily_logs');
  });
}
