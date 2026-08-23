import * as SQLite from 'expo-sqlite';

/** アプリ内に永続化されるStrollia用SQLite接続。 */
export const db = SQLite.openDatabaseSync('strollia.db');

/** ロック競合時に即エラーにせず書き込みを待つ時間(ミリ秒)。 */
const BUSY_TIMEOUT_MS = 5000;

/** 排他トランザクション内で使うDBランナー。expo-sqliteがtaskへ渡すTransactionの型。 */
export type ExclusiveTransaction = Parameters<Parameters<typeof db.withExclusiveTransactionAsync>[0]>[0];

/**
 * busy_timeout付きの排他トランザクションを実行する。
 *
 * expo-sqliteの `withExclusiveTransactionAsync` は内部で新しいDB接続を開くため、
 * バックグラウンドGPS記録(メイン接続)とフォアグラウンドの書き込みが別接続同士で
 * 競合すると即 SQLITE_BUSY(database is locked)になる。busy_timeoutは接続ごとの
 * 設定でメイン接続側のPRAGMAが引き継がれないため、トランザクション先頭で毎回設定する。
 */
export async function withExclusiveTransaction(task: (txn: ExclusiveTransaction) => Promise<void>): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.execAsync(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
    await task(txn);
  });
}

/** initializeDatabase の実行を1回にまとめるためのメモ化Promise。 */
let initializeDatabasePromise: Promise<void> | null = null;

/**
 * アプリ起動時に必要なテーブルとインデックスを作成する。
 *
 * SQLiteには軽量な永続化だけを任せ、スキーマ更新はこの関数に集約する。
 *
 * バックグラウンドGPSタスクなど複数の経路から毎回呼ばれるが、マイグレーションの
 * UPDATE や DDL は書き込みロックを取得するため、プロセス内で1回だけ実行する。
 * 失敗した場合はメモをクリアし、次回呼び出しで再試行する。
 */
export function initializeDatabase(): Promise<void> {
  initializeDatabasePromise ??= runDatabaseInitialization().catch((error: unknown) => {
    initializeDatabasePromise = null;
    throw error;
  });

  return initializeDatabasePromise;
}

/** テスト用: initializeDatabase のメモ化状態を初期化する。 */
export function resetDatabaseInitializationForTest(): void {
  initializeDatabasePromise = null;
}

/** スキーマ作成・マイグレーションの実体。 */
async function runDatabaseInitialization(): Promise<void> {
  await db.execAsync(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS};

    CREATE TABLE IF NOT EXISTS location_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recorded_at TEXT NOT NULL,
      local_date TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      effective_latitude REAL NULL,
      effective_longitude REAL NULL,
      snapped_stay_place_id INTEGER NULL,
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
      unlocked_local_date TEXT NULL,
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

    CREATE TABLE IF NOT EXISTS stay_places (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon_hexcode TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      privacy_radius_meters INTEGER NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS location_recording_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      active_stay_place_id INTEGER NULL,
      candidate_stay_place_id INTEGER NULL,
      candidate_count INTEGER NOT NULL DEFAULT 0,
      outside_count INTEGER NOT NULL DEFAULT 0,
      last_observed_at TEXT NULL,
      last_visited_grid_recorded_at TEXT NULL,
      last_visited_grid_latitude REAL NULL,
      last_visited_grid_longitude REAL NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS photo_assets (
      asset_id TEXT PRIMARY KEY,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      taken_at TEXT NULL,
      uri TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      last_seen_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_location_points_recorded_at
      ON location_points(recorded_at);

    CREATE INDEX IF NOT EXISTS idx_location_points_local_date
      ON location_points(local_date);

    CREATE INDEX IF NOT EXISTS idx_location_points_local_date_recorded_at
      ON location_points(local_date, recorded_at);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_location_points_recorded_at_latitude_longitude
      ON location_points(recorded_at, latitude, longitude);

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

    CREATE INDEX IF NOT EXISTS idx_stay_places_created_at_id
      ON stay_places(created_at, id);

    CREATE INDEX IF NOT EXISTS idx_photo_assets_latitude_longitude
      ON photo_assets(latitude, longitude);

    CREATE INDEX IF NOT EXISTS idx_photo_assets_taken_at
      ON photo_assets(taken_at);
  `);

  await ensureColumn('achievement_unlocks', 'unlocked_local_date', 'TEXT NULL');
  await ensureColumn('location_points', 'effective_latitude', 'REAL NULL');
  await ensureColumn('location_points', 'effective_longitude', 'REAL NULL');
  await ensureColumn('location_points', 'snapped_stay_place_id', 'INTEGER NULL');
  await ensureColumn('location_recording_state', 'last_visited_grid_recorded_at', 'TEXT NULL');
  await ensureColumn('location_recording_state', 'last_visited_grid_latitude', 'REAL NULL');
  await ensureColumn('location_recording_state', 'last_visited_grid_longitude', 'REAL NULL');
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_achievement_unlocks_unlocked_local_date
      ON achievement_unlocks(unlocked_local_date);
  `);
  await db.runAsync(
    `UPDATE achievement_unlocks
     SET unlocked_local_date = substr(unlocked_at, 1, 10)
     WHERE unlocked_local_date IS NULL`,
  );
}

/** 既存ユーザーのDBにも新しい列を追加する軽量マイグレーション。 */
async function ensureColumn(tableName: string, columnName: string, columnDefinition: string): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName})`);
  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
}
