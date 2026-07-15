---
name: tag-release
description: Use when tagging the latest main commit after a release PR is merged. Triggers include タグ付け, リリースタグ, git tag, vX.Y.Z タグ.
---

# リリースタグ付け

リリースPR(`develop` → `main`)のマージ後、main の最新コミットにバージョンタグを付ける。

## タグ命名

`v<version>` 形式(既存: `v1.0.0`, `v1.1.0`)。バージョンは `package.json` / `app.json` の値と一致させる。

## 手順

1. **最新取得**:

   ```bash
   git fetch origin main --tags
   ```

2. **バージョン確認**: `origin/main` 時点の `package.json` の `version` を確認し、タグ名 `vX.Y.Z` を決める

   ```bash
   git show origin/main:package.json | grep '"version"'
   ```

3. **重複確認**: `git tag -l "vX.Y.Z"` で同名タグがないことを確認。存在する場合は中断してユーザーに確認する
4. **タグ作成とpush**:

   ```bash
   git tag vX.Y.Z origin/main
   git push origin vX.Y.Z
   ```

5. **確認**: `git ls-remote --tags origin | grep vX.Y.Z` でリモート反映を確認

## 注意

- タグを付けるのは main の最新コミット(=リリースPRのマージコミット)のみ。他ブランチには付けない
- 既存タグの付け替え(force push)はしない。間違えた場合はユーザーに相談する
