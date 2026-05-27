import { db } from '../../db/database';
import { NewLocationPoint } from '../../types/gps';
import { distanceMeters } from '../../utils/distance';
import { getVisitedCellsForLocationPoint } from '../location/grid/gridInterpolation';
import { upsertVisitedCellsInCurrentTransaction } from '../location/visitedCellRepository';

export type GpxImportResult = {
  importedPointCount: number;
  skippedPointCount: number;
};

/** GPX由来のGPSポイントを既存データ優先でSQLiteへ取り込む。 */
export async function importLocationPointsFromGpx(points: NewLocationPoint[], fileName: string): Promise<GpxImportResult> {
  const sortedPoints = [...points].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const now = new Date().toISOString();
  let importedPointCount = 0;
  let skippedPointCount = 0;
  let previousImportedPoint: NewLocationPoint | null = null;

  await db.withTransactionAsync(async () => {
    for (const point of sortedPoints) {
      if (await hasExistingPoint(point)) {
        skippedPointCount += 1;
        continue;
      }

      await insertImportedLocationPoint(point, previousImportedPoint, now);
      const visitedCells = getVisitedCellsForLocationPoint(previousImportedPoint, point);
      await upsertVisitedCellsInCurrentTransaction(visitedCells, point.recordedAt);
      previousImportedPoint = point;
      importedPointCount += 1;
    }

    await insertImportHistory(sortedPoints, fileName, importedPointCount, skippedPointCount, now);
  });

  return { importedPointCount, skippedPointCount };
}

async function hasExistingPoint(point: NewLocationPoint): Promise<boolean> {
  const existing = await db.getFirstAsync<{ id: number }>(
    `SELECT id
     FROM location_points
     WHERE recorded_at = ?
       AND latitude = ?
       AND longitude = ?
     LIMIT 1`,
    point.recordedAt,
    point.latitude,
    point.longitude,
  );

  return existing != null;
}

async function insertImportedLocationPoint(point: NewLocationPoint, previousPoint: NewLocationPoint | null, now: string): Promise<void> {
  const segmentDistanceMeters = previousPoint?.localDate === point.localDate ? distanceMeters(previousPoint, point) : 0;

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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'gpx-import', ?)`,
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
}

async function insertImportHistory(
  points: NewLocationPoint[],
  fileName: string,
  importedPointCount: number,
  skippedPointCount: number,
  now: string,
): Promise<void> {
  const rangeFrom = points[0]?.recordedAt ?? null;
  const rangeTo = points.at(-1)?.recordedAt ?? null;

  await db.runAsync(
    `INSERT INTO import_history (
      format,
      file_name,
      range_from,
      range_to,
      imported_point_count,
      skipped_point_count,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    'gpx',
    fileName,
    rangeFrom,
    rangeTo,
    importedPointCount,
    skippedPointCount,
    now,
  );
}
