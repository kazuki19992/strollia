---
name: create-issue
description: Use when creating a GitHub issue for this repository (bug report, feature request, improvement, or backlog item). Triggers include issue作成, イシュー, バグ報告, 起票.
---

# issue作成

`gh issue create` によるissue起票の定型手順。issueテンプレートは未設定なので、以下の形式に従う。

## 手順

1. **重複確認**: `gh issue list --search "<キーワード>"` で既存issueを確認
2. **ラベル選択**(既存ラベルから。新規ラベルは作らない):

   | ラベル           | 用途                               |
   | ---------------- | ---------------------------------- |
   | `bug`            | 不具合                             |
   | `Emergency Bug`  | 緊急対応バグ(起動しない、落ちる等) |
   | `AppStore Issue` | App Storeの表示不具合              |
   | `NewFeature`     | 新機能                             |
   | `Enhanced`       | 改善                               |
   | `test`           | テスト系                           |
   | `documentation`  | ドキュメント                       |
   | `backlog`        | バックログ・これやりたい           |

3. **本文作成**: タイトル・本文とも日本語。本文テンプレート:

   ```markdown
   ## 概要

   <1〜2文で何のissueか>

   ## 背景

   <なぜ必要か、現状の問題>

   ## 期待する挙動

   <あるべき動作。バグの場合は再現手順と実際の挙動も>

   ## 受け入れ条件

   - [ ] <完了と判断できる条件>

   ## 関連

   <関連PR / issue / docs配下のドキュメントへのリンク>
   ```

4. **起票**:

   ```bash
   gh issue create --title "<タイトル>" --label "<ラベル>" --body "$(cat <<'EOF'
   <本文>
   EOF
   )"
   ```

5. **報告**: 作成されたissueのURLをユーザーに共有する

## 注意

- バグの場合、再現手順・発生環境(iOS/Android、アプリバージョン)を可能な範囲で含める
- センシティブな情報(APIキー、個人のGPSログ)を本文に貼らない
