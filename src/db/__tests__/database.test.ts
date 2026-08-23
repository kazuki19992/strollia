/**
 * database.ts のテスト。
 *
 * ■ テスト困難な点と代替検証方法
 * - expo-sqlite はネイティブモジュールであり、実際の SQLite エンジンを Jest 環境で動かせない。
 *   そのため、`expo-sqlite` をモジュールモックし、`db.execAsync` / `db.getAllAsync` / `db.runAsync`
 *   への呼び出し内容（SQL文字列・引数）を検証する形式をとる。
 * - SQL 文法の正確さや実際のテーブル生成・インデックス生成は、Expo Go または本番ビルドで
 *   以下の手順で手動確認すること:
 *   1. アプリをクリーンインストールして起動し、クラッシュしないことを確認する
 *   2. expo-sqlite の DevTools や DB Browser for SQLite を使って `strollia.db` を開き、
 *      テーブルとインデックスが正しく作成されていることを確認する
 *   3. 既存インストール環境でアップデートしたときに ensureColumn が正しく動作し、
 *      `achievement_unlocks.unlocked_local_date` 列が追加されることを確認する
 */

// jest.mock は hoisting されるため、ファクトリ内で module スコープの変数を参照できない。
// expo-sqlite のモックオブジェクトは module load 時に確定する。
// beforeEach での clear には db から直接参照する。
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({
    execAsync: jest.fn().mockResolvedValue(undefined),
    getAllAsync: jest.fn(),
    runAsync: jest.fn().mockResolvedValue(undefined),
    withExclusiveTransactionAsync: jest.fn(),
  })),
}));

import { db, initializeDatabase, resetDatabaseInitializationForTest, withExclusiveTransaction } from '@/db/database';

describe('database initializeDatabase マイグレーション', () => {
  beforeEach(() => {
    // initializeDatabase はプロセス内1回にメモ化されるため、各テスト前に状態を初期化する
    resetDatabaseInitializationForTest();
    // db は openDatabaseSync が返すモックオブジェクト。各テスト前に mock 状態をクリアする
    (db.execAsync as jest.Mock).mockClear();
    (db.execAsync as jest.Mock).mockResolvedValue(undefined);
    (db.getAllAsync as jest.Mock).mockClear();
    (db.runAsync as jest.Mock).mockClear();
    (db.runAsync as jest.Mock).mockResolvedValue(undefined);
  });

  it('2回呼んでも初期化処理は1回だけ実行される(バックグラウンドタスクから毎回呼ばれるため)', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValue([]);

    await initializeDatabase();
    const execCallCount = (db.execAsync as jest.Mock).mock.calls.length;
    await initializeDatabase();

    expect((db.execAsync as jest.Mock).mock.calls.length).toBe(execCallCount);
  });

  it('初期化に失敗した場合は次回呼び出しで再試行する', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValue([]);
    (db.execAsync as jest.Mock).mockRejectedValueOnce(new Error('disk I/O error'));

    await expect(initializeDatabase()).rejects.toThrow('disk I/O error');
    await expect(initializeDatabase()).resolves.toBeUndefined();
  });

  it('db が存在する（openDatabaseSync が "strollia.db" で呼ばれた結果として取得済み）', () => {
    // clearMocks: true により openDatabaseSync の呼び出し履歴は消えるが、
    // db オブジェクトは module load 時にすでに確定しているため、存在確認で代替する。
    expect(db).toBeDefined();
    expect(typeof db.execAsync).toBe('function');
  });

  describe('テーブル作成 SQL', () => {
    it('execAsync が最初の CREATE TABLE ブロックで呼ばれる', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValue([]);

      await initializeDatabase();

      expect(db.execAsync).toHaveBeenCalled();
    });

    it('location_points テーブル作成 SQL が含まれる', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValue([]);

      await initializeDatabase();

      const firstCall: string = (db.execAsync as jest.Mock).mock.calls[0][0] as string;
      expect(firstCall).toContain('CREATE TABLE IF NOT EXISTS location_points');
    });

    it('daily_logs テーブル作成 SQL が含まれる', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValue([]);

      await initializeDatabase();

      const firstCall: string = (db.execAsync as jest.Mock).mock.calls[0][0] as string;
      expect(firstCall).toContain('CREATE TABLE IF NOT EXISTS daily_logs');
    });

    it('app_settings テーブル作成 SQL が含まれる', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValue([]);

      await initializeDatabase();

      const firstCall: string = (db.execAsync as jest.Mock).mock.calls[0][0] as string;
      expect(firstCall).toContain('CREATE TABLE IF NOT EXISTS app_settings');
    });

    it('visited_admin_areas テーブル作成 SQL が含まれる', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValue([]);

      await initializeDatabase();

      const firstCall: string = (db.execAsync as jest.Mock).mock.calls[0][0] as string;
      expect(firstCall).toContain('CREATE TABLE IF NOT EXISTS visited_admin_areas');
    });

    it('achievement_unlocks テーブル作成 SQL が含まれる', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValue([]);

      await initializeDatabase();

      const firstCall: string = (db.execAsync as jest.Mock).mock.calls[0][0] as string;
      expect(firstCall).toContain('CREATE TABLE IF NOT EXISTS achievement_unlocks');
    });

    it('visited_cells テーブル作成 SQL が含まれる', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValue([]);

      await initializeDatabase();

      const firstCall: string = (db.execAsync as jest.Mock).mock.calls[0][0] as string;
      expect(firstCall).toContain('CREATE TABLE IF NOT EXISTS visited_cells');
    });

    it('import_history テーブル作成 SQL が含まれる', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValue([]);

      await initializeDatabase();

      const firstCall: string = (db.execAsync as jest.Mock).mock.calls[0][0] as string;
      expect(firstCall).toContain('CREATE TABLE IF NOT EXISTS import_history');
    });

    it('photo_assets テーブルと検索用インデックスが含まれる', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValue([]);

      await initializeDatabase();

      const firstCall: string = (db.execAsync as jest.Mock).mock.calls[0][0] as string;
      expect(firstCall).toContain('CREATE TABLE IF NOT EXISTS photo_assets');
      expect(firstCall).toContain('asset_id TEXT PRIMARY KEY');
      // ビューポート絞り込み(緯度経度のBETWEEN)を効かせるための複合インデックス
      expect(firstCall).toContain('idx_photo_assets_latitude_longitude');
      expect(firstCall).toContain('ON photo_assets(latitude, longitude)');
      // taken_at のインデックスは 2-c 以降の期間絞り込みに向けた準備工事
      expect(firstCall).toContain('idx_photo_assets_taken_at');
      expect(firstCall).toContain('ON photo_assets(taken_at)');
    });

    it('stay_places テーブルと作成順インデックスが含まれる', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValue([]);

      await initializeDatabase();

      const firstCall: string = (db.execAsync as jest.Mock).mock.calls[0][0] as string;
      expect(firstCall).toContain('CREATE TABLE IF NOT EXISTS stay_places');
      expect(firstCall).toContain('idx_stay_places_created_at_id');
      expect(firstCall).toContain('ON stay_places(created_at, id)');
    });

    it('ライブ記録の吸着状態を保持する単一行テーブルを作成する', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValue([]);

      await initializeDatabase();

      const createSql = (db.execAsync as jest.Mock).mock.calls[0][0] as string;
      expect(createSql).toContain('CREATE TABLE IF NOT EXISTS location_recording_state');
      expect(createSql).toContain('CHECK (id = 1)');
      expect(createSql).toContain('last_observed_at TEXT NULL');
      expect(createSql).toContain('last_visited_grid_recorded_at TEXT NULL');
      expect(createSql).toContain('last_visited_grid_latitude REAL NULL');
      expect(createSql).toContain('last_visited_grid_longitude REAL NULL');
    });

    it('記録状態テーブル追加時に既存距離と実績を更新しない', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValue([]);

      await initializeDatabase();

      const sql = [...(db.execAsync as jest.Mock).mock.calls, ...(db.runAsync as jest.Mock).mock.calls]
        .map(([statement]) => String(statement))
        .join('\n');
      expect(sql).not.toMatch(/UPDATE\s+daily_logs/i);
      expect(sql).not.toMatch(/UPDATE\s+achievement_unlocks[\s\S]*progress_value/i);
    });
  });

  describe('PRAGMA 設定', () => {
    it('PRAGMA foreign_keys = ON が含まれる', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValue([]);

      await initializeDatabase();

      const firstCall: string = (db.execAsync as jest.Mock).mock.calls[0][0] as string;
      expect(firstCall).toContain('PRAGMA foreign_keys = ON');
    });

    it('PRAGMA journal_mode = WAL が含まれる', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValue([]);

      await initializeDatabase();

      const firstCall: string = (db.execAsync as jest.Mock).mock.calls[0][0] as string;
      expect(firstCall).toContain('PRAGMA journal_mode = WAL');
    });

    it('PRAGMA busy_timeout が含まれる(バックグラウンド記録との書き込み競合で即 SQLITE_BUSY にしない)', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValue([]);

      await initializeDatabase();

      const firstCall: string = (db.execAsync as jest.Mock).mock.calls[0][0] as string;
      expect(firstCall).toContain('PRAGMA busy_timeout = 5000');
    });
  });

  describe('withExclusiveTransaction(busy_timeout付き排他トランザクション)', () => {
    it('トランザクション先頭でbusy_timeoutを設定してからtaskを実行する(新規接続にPRAGMAが引き継がれないため)', async () => {
      const mockTxn = { execAsync: jest.fn().mockResolvedValue(undefined), runAsync: jest.fn() };
      (db.withExclusiveTransactionAsync as jest.Mock).mockImplementation(async (callback) => callback(mockTxn));
      const task = jest.fn().mockResolvedValue(undefined);

      await withExclusiveTransaction(task);

      expect(mockTxn.execAsync).toHaveBeenCalledWith('PRAGMA busy_timeout = 5000');
      expect(task).toHaveBeenCalledWith(mockTxn);
      // busy_timeout の設定は task 実行より先であること
      const pragmaOrder = mockTxn.execAsync.mock.invocationCallOrder[0];
      const taskOrder = task.mock.invocationCallOrder[0];
      expect(pragmaOrder).toBeLessThan(taskOrder);
    });

    it('task内のエラーは呼び出し元へ伝播する', async () => {
      const mockTxn = { execAsync: jest.fn().mockResolvedValue(undefined) };
      (db.withExclusiveTransactionAsync as jest.Mock).mockImplementation(async (callback) => callback(mockTxn));

      await expect(withExclusiveTransaction(async () => Promise.reject(new Error('書き込み失敗')))).rejects.toThrow('書き込み失敗');
    });
  });

  describe('ensureColumn マイグレーション（unlocked_local_date）', () => {
    it('列が存在しない場合は ALTER TABLE が実行される', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValue([]);

      await initializeDatabase();

      const alterCalled = (db.execAsync as jest.Mock).mock.calls.some((call) => {
        const sql = call[0] as string;
        return sql.includes('ALTER TABLE') && sql.includes('unlocked_local_date');
      });
      expect(alterCalled).toBe(true);
    });

    it('列が既に存在する場合は ALTER TABLE を実行しない', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValue([{ name: 'unlocked_local_date' }]);

      await initializeDatabase();

      const alterCalled = (db.execAsync as jest.Mock).mock.calls.some((call) => {
        const sql = call[0] as string;
        return sql.includes('ALTER TABLE') && sql.includes('unlocked_local_date');
      });
      expect(alterCalled).toBe(false);
    });

    it('unlocked_local_date 列追加後に CREATE INDEX が実行される', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValue([]);

      await initializeDatabase();

      const indexCalled = (db.execAsync as jest.Mock).mock.calls.some((call) => {
        const sql = call[0] as string;
        return sql.includes('CREATE INDEX') && sql.includes('idx_achievement_unlocks_unlocked_local_date');
      });
      expect(indexCalled).toBe(true);
    });

    it('unlocked_local_date が NULL のレコードを更新する runAsync が呼ばれる', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValue([]);

      await initializeDatabase();

      const updateCalled = (db.runAsync as jest.Mock).mock.calls.some((call) => {
        const sql = call[0] as string;
        return sql.includes('UPDATE achievement_unlocks') && sql.includes('unlocked_local_date IS NULL');
      });
      expect(updateCalled).toBe(true);
    });
  });

  describe('ensureColumn マイグレーション（location_pointsの有効座標）', () => {
    it('既存ログを更新せず有効座標と吸着先IDの列だけを追加する', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValue([]);

      await initializeDatabase();

      const alterStatements = (db.execAsync as jest.Mock).mock.calls
        .map(([sql]) => sql as string)
        .filter((sql) => sql.includes('ALTER TABLE location_points'));
      expect(alterStatements).toEqual(
        expect.arrayContaining([
          expect.stringContaining('effective_latitude REAL NULL'),
          expect.stringContaining('effective_longitude REAL NULL'),
          expect.stringContaining('snapped_stay_place_id INTEGER NULL'),
        ]),
      );
      expect(db.runAsync).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE location_points'), expect.anything());
    });
  });

  describe('ensureColumn マイグレーション（Visited Grid補間起点）', () => {
    it('既存状態テーブルへ補間起点の3列をそれぞれ1回だけ追加し、データを埋め戻さない', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValue([]);

      await initializeDatabase();

      const alterStatements = (db.execAsync as jest.Mock).mock.calls
        .map(([sql]) => sql as string)
        .filter((sql) => sql.includes('ALTER TABLE location_recording_state'));
      expect(alterStatements).toEqual([
        expect.stringContaining('last_visited_grid_recorded_at TEXT NULL'),
        expect.stringContaining('last_visited_grid_latitude REAL NULL'),
        expect.stringContaining('last_visited_grid_longitude REAL NULL'),
      ]);
      const migrationSql = [...(db.execAsync as jest.Mock).mock.calls, ...(db.runAsync as jest.Mock).mock.calls]
        .map(([sql]) => String(sql))
        .join('\n');
      expect(migrationSql).not.toMatch(/UPDATE\s+location_recording_state/i);
    });

    it('補間起点の3列が既に存在する場合はALTER TABLEを実行しない', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValue([
        { name: 'last_visited_grid_recorded_at' },
        { name: 'last_visited_grid_latitude' },
        { name: 'last_visited_grid_longitude' },
      ]);

      await initializeDatabase();

      const alterStatements = (db.execAsync as jest.Mock).mock.calls
        .map(([sql]) => sql as string)
        .filter((sql) => sql.includes('ALTER TABLE location_recording_state'));
      expect(alterStatements).toEqual([]);
    });
  });

  describe('インデックス作成 SQL', () => {
    it('idx_location_points_recorded_at インデックスが含まれる', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValue([]);

      await initializeDatabase();

      const firstCall: string = (db.execAsync as jest.Mock).mock.calls[0][0] as string;
      expect(firstCall).toContain('idx_location_points_recorded_at');
    });

    it('idx_location_points_local_date インデックスが含まれる', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValue([]);

      await initializeDatabase();

      const firstCall: string = (db.execAsync as jest.Mock).mock.calls[0][0] as string;
      expect(firstCall).toContain('idx_location_points_local_date');
    });

    it('idx_visited_cells_xy インデックスが含まれる', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValue([]);

      await initializeDatabase();

      const firstCall: string = (db.execAsync as jest.Mock).mock.calls[0][0] as string;
      expect(firstCall).toContain('idx_visited_cells_xy');
    });
  });
});
