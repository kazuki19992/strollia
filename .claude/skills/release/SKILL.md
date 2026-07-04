---
name: release
description: Use when preparing a new Strollia release (version bump and develop-to-main release PR). Triggers include リリース準備, バージョンアップ, リリースPR, version bump, release flow.
---

# リリースフロー

`develop` の内容を新バージョンとしてリリースする定型手順。ブランチ運用は AGENTS.md §10.1 に従う。

## 手順

1. **リリース内容確認**: `git log origin/main..origin/develop --oneline` で今回リリースに含まれる変更を確認し、バージョン番号(semver)を決める
2. **バージョン更新**: 最新の `develop` から作業ブランチ(worktree)を作成し、以下を更新
   - `package.json` の `version`
   - `app.json` の `expo.version`
   - 2つの値は必ず一致させる(ビルド番号はEASの `autoIncrement` 管理なので触らない)
3. **ライセンス更新(依存が変わった場合)**: 前回リリース以降に依存追加・更新があれば `npm run generate:licenses` を実行し、生成物をコミットに含める
4. **検証**: `npm run typecheck` と `npm test`
5. **バージョンPR**: `chore(release): vX.Y.Z へバージョンを更新` でコミットし、`develop` ベースのPRを作成してマージする
6. **リリースPR作成**: `develop` → `main` のPRを作成

   ```bash
   gh pr create --base main --head develop --title "release: vX.Y.Z" --body "..."
   ```

   - description は日本語で、含まれる変更の要約・影響範囲・検証結果を記載

7. **マージ後**: `tag-release` スキルで main にタグを付ける。ストアビルドは `build-production` → `publish` スキルへ

## 注意

- `main` へ直接 push しない。必ずPR経由
- リリースPRに未検証の変更が混ざっていないか、マージ前に差分を確認する
