# コーディング規約

ルール本体は `AGENTS.md` を参照。ここでは実装時の「どう書くか」の実例をまとめる。

## TypeScript

- `tsconfig.json` は `expo/tsconfig.base` + `strict: true`。`any` を安易に使わない
- 関数・クラス・型・自明でない変数には日本語JSDocを付ける。「何をするか」に加え、必要なら「なぜその設計にしているか」も書く

```typescript
/** boolean設定を読み込み、未保存または壊れた値の場合はfallbackを返す。 */
export async function getBooleanSetting(key: string, fallback: boolean): Promise<boolean> {
```

## コミット

Semantic Commit Message: `type(scope): 日本語の説明`。type は英語(`feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `build`, `ci`)、scope は必要な場合のみ英語。

```text
feat(db): GPSログのSQLite保存を追加
test(export): GPX生成のテストを追加
```

## コンポーネント

- 1ファイル1コンポーネント、named export、汎用的な名前(特定画面名に閉じない)
- props 型は `XxxProps` として export し、各プロパティに日本語JSDocを付ける
- 画面・共通部品は `styles: AppStyles` を受け取り、テーマ色が必要なら `theme: AppTheme` も受け取る。ローカル `StyleSheet.create` は原則作らず `src/app/appStyles.ts` に追加する
- 押下可能な要素には `accessibilityLabel` + `accessibilityRole` を必ず付ける
- UIコンポーネント内でDB操作・端末APIを直接呼ばない。データと操作は props で受け取る

## features/ 配下の構成

- 機能ごとに `src/features/<feature>/` を作り、DB操作は `<feature>Repository.ts`(例: `settingsRepository.ts`)、外部サービス連携は `<service>Access.ts` / `<service>Client.ts`(例: `revenueCatAccess.ts`)と命名する
- 純粋ロジックは `<topic>Options.ts` / `<topic>Resolver.ts` のように分離し、単体テストを付ける
- テストは同ディレクトリの `__tests__/` に置く

## 設定値の扱い

- アプリ設定は SQLite の `app_settings` テーブル(key-value、値はJSON文字列)に保存する
- 読み書きは `src/features/settings/settingsRepository.ts` の `getBooleanSetting` / `getStringSetting` / `setSetting` / `setSettings` を使う。AsyncStorage は使わない

## 文言

- ユーザー向け文言は日本語。内部用語をそのまま出さない(`VisitedCell` → 「エリア」)
- 文言定数は `src/app/appText.ts` に集約する

## 開発フラグ

一時的な開発用フラグは `src/config/developmentFlags.ts` に集約し、`EXPO_PUBLIC_*` 環境変数で制御する。
