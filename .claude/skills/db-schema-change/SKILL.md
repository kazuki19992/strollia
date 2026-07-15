---
name: db-schema-change
description: Use when adding or changing SQLite tables, columns, or indexes in Strollia, or when creating a new repository for DB access. Triggers include スキーマ変更, テーブル追加, カラム追加, migration, CREATE TABLE, ALTER TABLE.
---

# DBスキーマ変更

## 原則

- スキーマ更新は `src/db/database.ts` の `initializeDatabase()` に集約する。マイグレーションファイルの仕組みはない
- すべての変更は**冪等**にする(既存ユーザーの端末でもアプリ更新時に安全に実行される)
- スキーマを変えたら `docs/data-storage.md` を同じ作業内で更新する

## 手順

1. **現状確認**: `src/db/database.ts` と `docs/data-storage.md` で既存スキーマを確認
2. **テーブル追加**: `initializeDatabase()` の `execAsync` に `CREATE TABLE IF NOT EXISTS` と `CREATE INDEX IF NOT EXISTS` を追加
   - カラム: `id INTEGER PRIMARY KEY AUTOINCREMENT`、日時は TEXT(ISO 8601)、`created_at` / `updated_at` を持たせる
3. **カラム追加(既存テーブル)**: `ensureColumn(tableName, columnName, columnDefinition)` を使う。`PRAGMA table_info` で存在確認してから `ALTER TABLE ADD COLUMN` する既存ヘルパー
   - 既存行の埋め戻しが必要なら `UPDATE ... WHERE 新カラム IS NULL` を続けて書く(実例: `unlocked_local_date` のマイグレーション)
4. **リポジトリ作成/更新**: `src/features/<feature>/<feature>Repository.ts` に CRUD 関数を追加
   - `db.runAsync` / `db.getFirstAsync<T>` / `db.getAllAsync<T>`、複数書き込みは `db.withExclusiveTransactionAsync`
   - 関数に日本語JSDocを付ける
5. **テスト**: `__tests__/<feature>Repository.test.ts`。`jest.mock('../../../db/database')` でdbをモック(実例: `src/features/settings/__tests__/settingsRepository.test.ts`、パターンは `.ai/context/testing.md`)
6. **ドキュメント更新**: `docs/data-storage.md` にテーブル定義を反映
7. **検証**: `npm run typecheck` と `npm test`

## よくある間違い

- `CREATE TABLE` に `IF NOT EXISTS` を付け忘れる → 既存ユーザーの起動時にクラッシュする
- `ALTER TABLE` を無条件に実行する → 2回目の起動で失敗。必ず `ensureColumn` を使う
- 破壊的変更(カラム削除・型変更)を安易に行う → SQLiteでは制約が多い。データ移行手順を設計してユーザーに相談する
