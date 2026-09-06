---
name: worktree-setup
description: Use when starting isolated Footspot work in a new worktree, including feature work, fixes, or release preparation.
---

# Footspot ワークツリー作成

Footspot の新規ワークツリーは `git worktree add` ではなく `git gtr new` で作成する。リポジトリの `gtr.copy.include` に `.env.local` が設定されており、`git gtr new` は必要なローカル環境設定を安全にコピーする。

1. メインリポジトリで既存のワークツリーとブランチの衝突を確認する。

   ```bash
   git gtr list
   git branch --list '<branch-name>'
   ```

2. `develop` を起点に、Claude Code のブランチ名を `claude/` で始めて作成する。

   ```bash
   git gtr new claude/<task-name> --from origin/develop --yes
   ```

   `--no-copy` は使わない。`.env.local` を含むコピー設定を無効化すると、ビルドやローカル実行に必要な環境変数が欠ける。

3. 作成先を取得し、`.env.local` が存在することだけを確認する。値や秘密情報は表示しない。

   ```bash
   WORKTREE_PATH="$(git gtr go claude/<task-name>)"
   test -f "$WORKTREE_PATH/.env.local"
   ```

   存在しない場合は作業を開始せず、`git gtr config get gtr.copy.include` を確認してユーザーに知らせる。`.env.local` を Git に追加したり、内容を推測して新規作成したりしない。

4. 以後の変更、依存関係のセットアップ、テストは取得したワークツリー内で実施する。

既に対象の linked worktree 内にいる場合は新規作成しない。不要になったクリーンなワークツリーの削除は `post-merge-cleanup` スキルに従う。
