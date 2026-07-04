import * as SQLite from 'expo-sqlite';

import { db } from '@/db/database';
import { NewLocationPoint } from '@/types/gps';
import { distanceMeters } from '@/utils/distance';
import { getVisitedCellsForLocationPoint } from '@/features/location/grid/gridInterpolation';
import { upsertVisitedCellsInCurrentTransaction } from '@/features/location/visitedCellRepository';

/** GPX インポートの実行結果。 */
export type GpxImportResult = {
  /** 新規に取り込んだポイント数。 */
  importedPointCount: number;
  /** 既存データと重複してスキップしたポイント数。 */
  skippedPointCount: number;
};

/**
 * GPX 由来の GPS ポイントを既存データ優先で SQLite へ取り込む。
 *
 * - ポイントは `recorded_at` 昇順にソートしてから挿入する。
 * - `INSERT OR IGNORE` で既存ポイント（同じ recorded_at / latitude / longitude）はスキップする。
 * - 日別ログ（daily_logs）と訪問セル（visited_cells）も同一トランザクション内で更新する。
 * - インポート履歴（import_history）に記録を残す。
 * - すべての操作は排他トランザクション（withExclusiveTransactionAsync）で囲み、
 *   途中失敗時にロールバックする。
 */
export async function importLocationPointsFromGpx(points: NewLocationPoint[], fileName: string): Promise<GpxImportResult> {
  const sortedPoints = [...points].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const now = new Date().toISOString();
  let importedPointCount = 0;
  let skippedPointCount = 0;
  let previousImportedPoint: NewLocationPoint | null = null;

  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const point of sortedPoints) {
      const wasInserted = await insertImportedLocationPoint(point, previousImportedPoint, now, txn);
      if (!wasInserted) {
        skippedPointCount += 1;
        continue;
      }

      const visitedCells = getVisitedCellsForLocationPoint(previousImportedPoint, point);
      await upsertVisitedCellsInCurrentTransaction(visitedCells, point.recordedAt, txn);
      previousImportedPoint = point;
      importedPointCount += 1;
    }

    await insertImportHistory(sortedPoints, fileName, importedPointCount, skippedPointCount, now, txn);
  });

  return { importedPointCount, skippedPointCount };
}

/**
 * 1ポイントをトランザクション内に挿入し、挿入できたかどうかを返す。
 *
 * daily_logs は UPSERT（ON CONFLICT DO UPDATE）で集計値を更新する。
 * 同一日付の前のポイントとの距離を distance_meters に累積する。
 */
async function insertImportedLocationPoint(
  point: NewLocationPoint,
  previousPoint: NewLocationPoint | null,
  now: string,
  txn: SQLite.SQLiteDatabase,
): Promise<boolean> {
  const segmentDistanceMeters = previousPoint?.localDate === point.localDate ? distanceMeters(previousPoint, point) : 0;

  const insertResult = await txn.runAsync(
    `INSERT OR IGNORE INTO location_points (
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

  if ((insertResult.changes ?? 1) === 0) {
    return false;
  }

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

  return true;
}

/**
 * インポート実行履歴を import_history テーブルに記録する。
 *
 * ポイントが存在しない場合は range_from / range_to を null とする。
 */
async function insertImportHistory(
  points: NewLocationPoint[],
  fileName: string,
  importedPointCount: number,
  skippedPointCount: number,
  now: string,
  txn: SQLite.SQLiteDatabase,
): Promise<void> {
  const rangeFrom = points[0]?.recordedAt ?? null;
  const rangeTo = points.at(-1)?.recordedAt ?? null;

  await txn.runAsync(
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
