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
    PRAGMA foreign_keys = ON;
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

    CREATE TABLE IF NOT EXISTS visited_admin_areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      area_type TEXT NOT NULL,
      area_code TEXT NULL,
      prefecture_name TEXT NOT NULL,
      municipality_name TEXT NULL,
      normalized_name TEXT NOT NULL,
      first_visited_at TEXT NOT NULL,
      last_visited_at TEXT NOT NULL,
      first_location_point_id INTEGER NULL REFERENCES location_points(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(area_type, normalized_name)
    );

    CREATE TABLE IF NOT EXISTS location_point_admin_areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location_point_id INTEGER NOT NULL REFERENCES location_points(id) ON DELETE CASCADE,
      recorded_at TEXT NOT NULL,
      local_date TEXT NOT NULL,
      prefecture_name TEXT NOT NULL,
      municipality_name TEXT NULL,
      normalized_prefecture_name TEXT NOT NULL,
      normalized_municipality_name TEXT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(location_point_id)
    );

    CREATE TABLE IF NOT EXISTS achievement_unlocks (
      achievement_id TEXT PRIMARY KEY,
      unlocked_at TEXT NOT NULL,
      progress_value REAL NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS achievement_notification_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      achievement_id TEXT NOT NULL,
      queued_at TEXT NOT NULL,
      delivered_push_at TEXT NULL,
      shown_in_app_at TEXT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(achievement_id)
    );

    CREATE TABLE IF NOT EXISTS visited_cells (
      cell_id TEXT PRIMARY KEY,
      cell_size_meters INTEGER NOT NULL,
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      first_visited_at TEXT NOT NULL,
      last_visited_at TEXT NOT NULL,
      visit_count INTEGER NOT NULL DEFAULT 1,
      source TEXT NOT NULL DEFAULT 'gps',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS import_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      format TEXT NOT NULL,
      file_name TEXT NOT NULL,
      range_from TEXT NULL,
      range_to TEXT NULL,
      imported_point_count INTEGER NOT NULL,
      skipped_point_count INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_location_points_recorded_at
      ON location_points(recorded_at);

    CREATE INDEX IF NOT EXISTS idx_location_points_local_date
      ON location_points(local_date);

    CREATE INDEX IF NOT EXISTS idx_location_points_local_date_recorded_at
      ON location_points(local_date, recorded_at);

    CREATE INDEX IF NOT EXISTS idx_visited_admin_areas_area_type_normalized_name
      ON visited_admin_areas(area_type, normalized_name);

    CREATE INDEX IF NOT EXISTS idx_location_point_admin_areas_local_date_prefecture
      ON location_point_admin_areas(local_date, normalized_prefecture_name);

    CREATE INDEX IF NOT EXISTS idx_location_point_admin_areas_local_date_municipality
      ON location_point_admin_areas(local_date, normalized_municipality_name);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_achievement_notification_queue_achievement_id
      ON achievement_notification_queue(achievement_id);

    CREATE INDEX IF NOT EXISTS idx_achievement_notification_queue_shown
      ON achievement_notification_queue(shown_in_app_at, queued_at);

    CREATE INDEX IF NOT EXISTS idx_achievement_notification_queue_delivered_push
      ON achievement_notification_queue(delivered_push_at);

    CREATE INDEX IF NOT EXISTS idx_visited_cells_xy
      ON visited_cells(x, y);

    CREATE INDEX IF NOT EXISTS idx_visited_cells_last_visited_at
      ON visited_cells(last_visited_at);
  `);
}
