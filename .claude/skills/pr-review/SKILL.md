---
name: pr-review
description: Use when reviewing a pull request with inline comments, or when fetching and resolving review comments on an existing PR. Triggers include PRレビュー, コードレビュー, レビューコメント, コメントを取得して修正, resolve.
---

# PRレビュー

PRへの CodeRabbit 風インラインレビューと、レビューコメント対応・resolve の定型手順。

## A. レビューする側(インラインコメントを付ける)

1. **差分取得**: `gh pr view <PR番号>` で概要、`gh pr diff <PR番号>` で差分を取得。必要に応じて変更ファイルの全体を読む
2. **観点**: 正当性(バグ・境界条件)、AGENTS.md / DESIGN.md / `.ai/context/conventions.md` への準拠、テスト有無、ドキュメント更新漏れ
3. **コメント形式**(CodeRabbit風。種別プレフィクス+指摘+提案):

   ```markdown
   ⚠️ **Potential issue** | 🔴 Critical(または 🟠 Major / 🟡 Minor / 🧹 Nitpick)

   <問題点の説明(日本語)>

   <提案コード(diffブロック)>

   <理由・影響範囲>
   ```

4. **インラインコメント付きレビュー投稿**: 1回のレビューにまとめて投稿する

   ```bash
   gh api repos/{owner}/{repo}/pulls/<PR番号>/reviews \
     -f event=COMMENT -f body='レビュー全体のサマリー' \
     -f 'comments[][path]=src/foo.ts' -F 'comments[][line]=42' \
     -f 'comments[][side]=RIGHT' -f 'comments[][body]=<コメント本文>'
   ```

   ※ `line` は diff に含まれる行のみ指定可能。複数コメントは `comments[]` を繰り返す

## B. レビューされる側(コメント対応 → resolve)

AGENTS.md §10.1「コメントを取得して修正」の実装手順。

1. **未解決スレッド取得**:

   ```bash
   gh api graphql -f query='query { repository(owner: "kazuki19992", name: "footspot") {
     pullRequest(number: <PR番号>) { reviewThreads(first: 50) {
       nodes { id isResolved path line comments(first: 10) { nodes { author { login } body } } } } } } }'
   ```

2. **有効性判断**: `isResolved: false` のスレッドのうち、まだ有効な指摘だけを修正対象にする。対応しない指摘はユーザーの承認を得る(nits含め全コメント対応が原則)
3. **修正**: 指摘ごとに修正し、意味単位でコミット・push
4. **返信**: 各スレッドに対応内容を返信(修正コミットのハッシュを添える)
5. **resolve**: 修正が完了したスレッドを解決する

   ```bash
   gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: "<thread id>"}) {
     thread { id isResolved } } }'
   ```

6. **確認**: 手順1を再実行し、未解決スレッドが残っていないことを確認

## 注意

- 修正していないスレッドを resolve しない
- レビュー承認(APPROVE)や変更要求(REQUEST_CHANGES)はユーザーの指示がある場合のみ
