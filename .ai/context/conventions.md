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
- 画面・共通部品は `styles: AppStyles` を受け取り、テーマ色が必要なら `theme: AppTheme` も受け取る。ローカル `StyleSheet.create` は原則作らず `src/ui/appStyles.ts` に追加する（**lintで強制される**: `src/ui/components/**` 配下での `StyleSheet.create` は ESLint error。例外は `reports/reportStyles.ts` と、テーマ非依存の固定色を使う意図的な場合に限り `eslint-disable-next-line` コメントで理由を明記する）
- 押下可能な要素には `accessibilityLabel` + `accessibilityRole` を必ず付ける
- UIコンポーネント内でDB操作・端末APIを直接呼ばない。データと操作は props で受け取る

## 新画面の追加手順

expo-router 移行後の新画面追加は以下の流れで行う。

1. **ルートファイルを追加**: `src/app/` 配下に画面パスに対応するファイルを作る(例: `/foo` なら `src/app/foo.tsx`)
   - ルートファイルは薄いラッパー。`useAppState()` で状態を取得し、画面コンポーネントへ props を渡すだけにする
   - スタック内の子画面なら `_layout.tsx` に `Stack.Screen` を追加する必要はない(expo-router が自動検出)
2. **画面コンポーネントを作成**: `src/ui/components/XxxScreen.tsx` に UI 実体を置く
   - props はデータとコールバックのみ。DB・端末APIを直接呼ばない
3. **状態・操作を AppStateProvider へ追加**: 新画面に必要な状態やコールバックを `AppStateContextValue` に追加し、`AppStateProvider` 内で実装する
4. **ナビゲーション接続**: `src/app/_layout.tsx` の `useRouterNavigator` に `router.push('/foo')` を追加し、AppStateProvider の対応メソッドへ繋ぐ
5. **Sentry 画面名マッパーを更新**: `src/ui/pathnameToScreenMode.ts` の `pathnameToScreenMode` / `pathnameToSettingsSentryScreenName` / `pathnameToDailyLogsSentryScreenName` に新パスを追加する
6. **テストを追加**: `renderRouter('src/app')` でルートごとテストする(`.ai/context/testing.md` 参照)

## features/ 配下の構成

- 機能ごとに `src/features/<feature>/` を作り、DB操作は `<feature>Repository.ts`(例: `settingsRepository.ts`)、外部サービス連携は `<service>Access.ts` / `<service>Client.ts`(例: `revenueCatAccess.ts`)と命名する
- 純粋ロジックは `<topic>Options.ts` / `<topic>Resolver.ts` のように分離し、単体テストを付ける
- テストは同ディレクトリの `__tests__/` に置く

## 設定値の扱い

- アプリ設定は SQLite の `app_settings` テーブル(key-value、値はJSON文字列)に保存する
- 読み書きは `src/features/settings/settingsRepository.ts` の `getBooleanSetting` / `getStringSetting` / `setSetting` / `setSettings` を使う。AsyncStorage は使わない

## 文言

- ユーザー向け文言は日本語。内部用語をそのまま出さない(`VisitedCell` → 「エリア」)
- 文言定数は `src/ui/appText.ts` に集約する

## パスエイリアス

`tsconfig.json` に `@/*` → `./src/*` のエイリアスを設定済み。

| 場面                        | 書き方                        | 例                                   |
| --------------------------- | ----------------------------- | ------------------------------------ |
| ディレクトリを跨ぐ import   | `@/` を使う                   | `import { db } from '@/db/database'` |
| 同一ディレクトリ内の import | `./` を使う                   | `import { helper } from './helper'`  |
| `jest.mock` のパス          | import と同じルールを適用する | `jest.mock('@/db/database', ...)`    |

- `../` を含む相対 import は ESLint の `no-restricted-imports` ルールで禁止している(error)
- `jest.mock` / `jest.requireActual` 等のパス文字列は import 文ではないため、`no-restricted-syntax` ルールで同様に `../` 始まりを禁止している(error)
- `src/` の外(root の `app.json` 等)を直接参照する場合のみ `eslint-disable-line` で例外扱いにする

## 開発フラグ

一時的な開発用フラグは `src/config/developmentFlags.ts` に集約し、`EXPO_PUBLIC_*` 環境変数で制御する。

## Lint / Format

ESLint 9 (flat config) + Prettier 3 を導入済み。

| コマンド               | 説明                                    |
| ---------------------- | --------------------------------------- |
| `npm run lint`         | ESLint 全体チェック(error 0 が合格条件) |
| `npm run lint:fix`     | ESLint autofix を適用                   |
| `npm run format`       | Prettier でフォーマット適用             |
| `npm run format:check` | Prettier フォーマットチェック           |

**設定ファイル:**

- `eslint.config.js` — flat config。`eslint-config-expo/flat` + `eslint-config-prettier` を展開
- `.prettierrc` — `singleQuote: true, semi: true, printWidth: 140, trailingComma: "all"`
- `.prettierignore` — 生成物・ビルド成果物・worktree などを除外

**カスタムルール:**

- `no-restricted-imports`: `@react-native-async-storage/async-storage` を error 禁止。設定は `settingsRepository` (SQLite `app_settings`) を使う
- `react-hooks/exhaustive-deps`: 依存配列の変更は挙動変更になるため warn に留める。意図的に無効化する場合は `// eslint-disable-next-line react-hooks/exhaustive-deps -- 理由` コメントを付ける
- `react-hooks/refs` / `react-hooks/set-state-in-effect`: react-hooks@7 の新規ルールで既存パターンに多数 warning が出るため warn に降格。後続のリファクタで個別対処する
- `no-restricted-syntax` (components配下 files override): `StyleSheet.create` を error 禁止。`src/ui/appStyles.ts` の `createStyles(theme)` へ集約する。`reports/reportStyles.ts` と意図的な自己完結スタイルは除外（理由コメント必須）
