---
name: build-production
description: Use when creating a production (store) build of Strollia with EAS. Triggers include productionビルド, 本番ビルド, リリースビルド, ストア用ビルド, eas build production.
---

# productionビルド

App Store / Google Play 提出用の本番ビルドを作成する。

## プロファイル(eas.json)

- `autoIncrement: true`(ビルド番号はEAS側で自動加算。`appVersionSource: remote`)
- env: `EXPO_PUBLIC_STROLLIA_BUILD_PROFILE=production`(Sentryの自動アップロード有効)

## 手順

1. **ブランチ確認**: 原則 `main`(リリース状態)でビルドする。リリースフロー全体は `release` スキルを参照
2. **バージョン確認**: `package.json` と `app.json` の `version` が今回リリースの値になっているか確認(ビルド番号は自動、バージョン文字列は手動)
3. **事前チェック**: `npm run typecheck` と `npm test` が通ることを確認
4. **環境変数確認**: `.env.example` と突き合わせ。開発フラグ(`EXPO_PUBLIC_*` 系)が**すべて無効**であることを必ず確認
5. **ビルド実行**:

   ```bash
   npx eas build --profile production --platform ios
   npx eas build --profile production --platform android
   ```

6. **結果確認**: ビルドURLでステータス確認
7. **提出**: ストア提出は `publish` スキルへ

## 注意

- Sentryのソースマップアップロードが走るため、`SENTRY_AUTH_TOKEN` が必要(eas.jsonのcredentials/EAS Secrets側の設定を確認)
- ビルド失敗時はEASのビルドログを読んで原因特定してから再実行(autoIncrementで番号だけ消費される)
