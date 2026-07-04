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
  })),
}));

import { db, initializeDatabase } from '@/db/database';

describe('database initializeDatabase マイグレーション', () => {
  beforeEach(() => {
    // db は openDatabaseSync が返すモックオブジェクト。各テスト前に mock 状態をクリアする
    (db.execAsync as jest.Mock).mockClear();
    (db.execAsync as jest.Mock).mockResolvedValue(undefined);
    (db.getAllAsync as jest.Mock).mockClear();
    (db.runAsync as jest.Mock).mockClear();
    (db.runAsync as jest.Mock).mockResolvedValue(undefined);
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
