---
name: post-merge-cleanup
description: Use when a PR has been merged and the working branch/worktree should be cleaned up (delete worktree, update develop). Triggers include マージされた, マージ済み, クリーンアップ, worktree削除, ブランチ削除, 後片付け.
---

# マージ後クリーンアップ

PRのマージ報告を受けたら即座に実行する定型手順: develop最新化 → worktree削除 → ブランチ削除。

## 前提

- 作業はメインリポジトリ(`/Users/kazuki19992/gits/footspot`)側で行う。削除対象のworktree内から実行しない(自分の足場を消すことになる)
- リリースPR(develop→main)の場合は develop を main に読み替えず、develop側の後片付けは不要。`tag-release` スキルへ進む

## 手順

1. **マージ確認**: 対象PRが本当にマージ済みか確認する

   ```bash
   gh pr view <PR番号> --json state,mergedAt,headRefName
   ```

   `state` が `MERGED` でなければ中断してユーザーに確認する

2. **未コミット変更の確認**: 削除対象worktreeに未保存の作業がないか確認

   ```bash
   git -C <worktreeパス> status --porcelain
   ```

   出力がある場合は中断し、内容をユーザーに報告して指示を仰ぐ

3. **develop最新化**(メインリポジトリで):

   ```bash
   cd /Users/kazuki19992/gits/footspot
   git checkout develop
   git pull origin develop
   git fetch --prune
   ```

4. **worktree削除**:

   ```bash
   git worktree remove <worktreeパス>
   git worktree prune
   ```

5. **ローカルブランチ削除**:

   ```bash
   git branch -d <ブランチ名>
   ```

   `-d` で拒否された場合は squash マージ等でマージ検出できていない可能性がある。手順1のマージ確認が取れているときのみ `-D` を使う

6. **確認**: `git worktree list` と `git branch` で削除を確認し、結果を報告する

## 注意

- リモートブランチは通常GitHub側のマージ時自動削除に任せる。残っている場合のみ `git push origin --delete <ブランチ名>`
- 複数worktreeで並行作業中の場合、他のworktreeに触らない
