# CLAUDE.md

作業ルールは @AGENTS.md に従うこと。
画面・UIを作る際は必ず `DESIGN.md` を参照すること。

## コンテキストドキュメント(作業開始時に参照)

- @.ai/context/architecture.md — レイヤー構成・ディレクトリ構造・主要ファイル
- @.ai/context/conventions.md — コーディング規約・命名・コミット規約
- @.ai/context/testing.md — テストの書き方・モックパターン

## クイックリファレンス

- 型チェック: `npm run typecheck` / テスト: `npm test` / lint: `npm run lint` / format: `npm run format`
- 定型作業は `.claude/skills/` のスキルを優先して使う:
  - 実装系: `add-screen`, `db-schema-change`, `add-setting`, `premium-gate`
  - ビルド系: `build-development`, `build-preview`, `build-production`, `publish`
  - リリース系: `release`, `tag-release`, `release-notes`
  - GitHub運用系: `pr-review`, `create-issue`
  - 後片付け: `post-merge-cleanup`(PRマージ後のworktree削除・develop最新化)
