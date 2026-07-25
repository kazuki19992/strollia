---
name: release
description: Use when preparing a real Strollia store release. Triggers include リリース準備, バージョンアップ, リリース, version bump, release flow, ストアリリース.
---

# リリースフロー

Strollia を正式にストアへリリースする手順。ブランチ運用は AGENTS.md §10.1 に従う。

**最重要**: **develop → main の PR とタグ付けは「ストアリリース直後(手順6)」に行う。ビルドやストア提出の前に main PR を作ってはいけない。** ビルドは develop から直接行い、main へマージするのはリリースが完了してから。承認されるまで main へは入れない(reject されたら develop で直す)。

## 手順

1. **バージョンを変更する**
   - `git log origin/main..origin/develop --oneline` で今回リリースに含まれる変更を確認し、バージョン番号(semver)を決める
   - 最新の `develop` から作業ブランチ(worktree)を作成し、以下を更新
     - `package.json` の `version`
     - `app.json` の `expo.version`
     - 2つの値は必ず一致させる(ビルド番号は EAS の `autoIncrement` 管理なので触らない)
   - 依存が変わっていれば `npm run generate:licenses` を実行し生成物をコミットに含める
   - `npm run typecheck` / `npm test` で検証
   - `chore(release): vX.Y.Z へバージョンを更新` でコミットし、`develop` ベースの PR を作成してマージする

2. **プロダクションビルド＆提出**: 最新 develop で `scripts/build-and-submit-ios.sh` を実行する
   - `eas build --profile production --local` でローカルビルドし、そのまま `eas submit` で App Store Connect へ提出する
   - **develop の現ブランチのままビルドする**(main へマージしない)
   - `.env.local` の `SENTRY_AUTH_TOKEN` / `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` を使う
   - Android は必要に応じて `build-production` → `publish` スキルを使う

3. **ユーザーが TestFlight でテスト**する(ユーザーのアクション待ち。ここは私の作業ではない)

4. **問題なければユーザーが App Store Connect で提出**する(ユーザーのアクション)

5. **承認判定**
   - 承認されればそのままリリース
   - 承認されなければ、修正を `develop` に PR して手順2からやり直す

6. **リリース後の反映**(ユーザーから「リリースされた/承認された」と報告があってから行う)
   - `develop` → `main` の PR を作成する

     ```bash
     gh pr create --base main --head develop --title "release: vX.Y.Z" --body "..."
     ```

     - description は日本語で、含まれる変更の要約・影響範囲・検証結果・リリースノートを記載

   - マージ後、`tag-release` スキルで `main` の最新コミットへ `vX.Y.Z` タグを付ける

## 注意

- **ビルド前に develop→main PR を作らない**。main PR とタグはリリース後(手順6)。
- `main` / `develop` へ直接 push しない。必ず PR 経由。
- リリースノートは `release-notes` スキルで生成できる。
- 「TestFlight で確認したいだけ」「動作確認用にビルドしたい」など**正式リリースが目的でない**場合は、このフルフローを通さず `scripts/build-and-submit-ios.sh` を現ブランチで実行するだけでよい(main PR 不要)。
