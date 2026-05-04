import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('strollia.db');

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

    CREATE INDEX IF NOT EXISTS idx_location_points_recorded_at
      ON location_points(recorded_at);

    CREATE INDEX IF NOT EXISTS idx_location_points_local_date
      ON location_points(local_date);

    CREATE INDEX IF NOT EXISTS idx_location_points_local_date_recorded_at
      ON location_points(local_date, recorded_at);
  `);
}
