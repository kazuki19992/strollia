import { db } from '@/db/database';

import {
  ANNUAL_REPORT_PAYLOAD_VERSION,
  type AnnualReportPayloadV1,
  type AnnualReportProgress,
  type AnnualReportRecord,
} from './annualReportTypes';

/** `annual_reports` テーブルの生の行。 */
type AnnualReportRow = {
  year: number;
  payload_version: number;
  status: string;
  progress_json: string | null;
  payload_json: string | null;
  notification_scheduled_at: string | null;
};

/**
 * 対象年のレポートを読み込む。
 * JSONが壊れている・payload_versionが未知・statusに対して中身が欠けている場合は、表示側を壊さないようnullを返す
 * (Sentryへの記録は呼び出し側で行う)。
 */
export async function getAnnualReport(year: number): Promise<AnnualReportRecord | null> {
  const row = await db.getFirstAsync<AnnualReportRow>(
    `SELECT year, payload_version, status, progress_json, payload_json, notification_scheduled_at
     FROM annual_reports WHERE year = ?`,
    year,
  );
  if (!row || row.payload_version !== ANNUAL_REPORT_PAYLOAD_VERSION) {
    return null;
  }

  try {
    if (row.status === 'completed' && row.payload_json) {
      const payload = JSON.parse(row.payload_json) as AnnualReportPayloadV1;
      return { year: row.year, status: 'completed', payload, notificationScheduledAt: row.notification_scheduled_at };
    }
    if (row.status === 'in_progress' && row.progress_json) {
      const progress = JSON.parse(row.progress_json) as AnnualReportProgress;
      return { year: row.year, status: 'in_progress', progress, notificationScheduledAt: row.notification_scheduled_at };
    }
  } catch {
    return null;
  }
  return null;
}

/** 集計途中の進捗を `in_progress` としてUPSERTする。 */
export async function saveAnnualReportProgress(year: number, progress: AnnualReportProgress): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO annual_reports (year, payload_version, status, progress_json, payload_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, ?, ?)
     ON CONFLICT(year) DO UPDATE SET
       payload_version = excluded.payload_version,
       status = excluded.status,
       progress_json = excluded.progress_json,
       payload_json = NULL,
       updated_at = excluded.updated_at`,
    year,
    ANNUAL_REPORT_PAYLOAD_VERSION,
    'in_progress',
    JSON.stringify(progress),
    now,
    now,
  );
}

/** レポートを完成として保存する。途中経過は不要になるためprogress_jsonはNULLにする。 */
export async function completeAnnualReport(year: number, payload: AnnualReportPayloadV1): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO annual_reports (year, payload_version, status, progress_json, payload_json, created_at, updated_at)
     VALUES (?, ?, ?, NULL, ?, ?, ?)
     ON CONFLICT(year) DO UPDATE SET
       payload_version = excluded.payload_version,
       status = excluded.status,
       progress_json = NULL,
       payload_json = excluded.payload_json,
       updated_at = excluded.updated_at`,
    year,
    ANNUAL_REPORT_PAYLOAD_VERSION,
    'completed',
    JSON.stringify(payload),
    now,
    now,
  );
}

/** 通知を予約した日時を記録する(重複予約を防ぐ)。 */
export async function markAnnualReportNotificationScheduled(year: number, scheduledAt: string): Promise<void> {
  await db.runAsync(
    `UPDATE annual_reports SET notification_scheduled_at = ?, updated_at = ? WHERE year = ?`,
    scheduledAt,
    new Date().toISOString(),
    year,
  );
}

/** 対象年の行を削除する。開発用フラグ有効時の作り直し(保存データなしからの再集計)に使う。 */
export async function deleteAnnualReport(year: number): Promise<void> {
  await db.runAsync('DELETE FROM annual_reports WHERE year = ?', year);
}
