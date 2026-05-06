import * as SQLite from 'expo-sqlite';

/** アプリ内に永続化されるStrollia用SQLite接続。 */
export const db = SQLite.openDatabaseSync('strollia.db');

/**
 * アプリ起動時に必要なテーブルとインデックスを作成する。
 *
 * SQLiteには軽量な永続化だけを任せ、スキーマ更新はこの関数に集約する。
 */
export async function initializeDatabase(): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS location_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recorded_at TEXT NOT NULL,
      local_date TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      altitude REAL NULL,
      speed REAL NULL,
      heading REAL NULL,
      accuracy REAL NULL,
      altitude_accuracy REAL NULL,
      source TEXT NOT NULL DEFAULT 'expo-location',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      local_date TEXT NOT NULL UNIQUE,
      started_at TEXT NULL,
      ended_at TEXT NULL,
      point_count INTEGER NOT NULL DEFAULT 0,
      distance_meters REAL NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_location_points_recorded_at
      ON location_points(recorded_at);

    CREATE INDEX IF NOT EXISTS idx_location_points_local_date
      ON location_points(local_date);

    CREATE INDEX IF NOT EXISTS idx_location_points_local_date_recorded_at
      ON location_points(local_date, recorded_at);
  `);
}
