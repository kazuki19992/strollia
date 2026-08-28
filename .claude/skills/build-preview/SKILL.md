---
name: build-preview
description: Use when creating a preview (internal distribution) build of Strollia with EAS for pre-release testing. Triggers include previewビルド, プレビュービルド, 内部配布, eas build preview.
---

# previewビルド

リリース前検証用の内部配布ビルド(開発クライアントなし、本番相当の動作)を作成する。

## プロファイル(eas.json)

- `distribution: internal`
- env: `EXPO_PUBLIC_STROLLIA_BUILD_PROFILE=preview`, `SENTRY_DISABLE_AUTO_UPLOAD=true`

## 手順

1. **事前チェック**: `npm run typecheck` と `npm test` が通ることを確認
2. **ブランチ確認**: 検証対象のブランチ(通常 `develop` または対象PRのブランチ)にいることを確認
3. **環境変数確認**: `.env.example` と突き合わせ(RevenueCatキー、Google Mapsキー)。開発フラグ(`EXPO_PUBLIC_ENABLE_PREMIUM_ACCESS_WITHOUT_REVENUECAT`)が有効になっていないか確認
4. **ビルド実行**:

   ローカルでビルドする場合は、`.env.local` の展開と開発フラグの無効化まで行うスクリプトを使う。

   ```bash
   ./scripts/build-preview-ios.sh                      # iOS(ローカル、成果物は builds/)
   ./scripts/build-and-install-android.sh preview      # Android(ローカル、実機へ adb install)
   ```

   EAS のクラウドビルドを使う場合は以下。

   ```bash
   npx eas build --profile preview --platform ios
   npx eas build --profile preview --platform android
   ```

5. **結果確認**: ビルドURLでステータス確認。成功したら内部配布リンクを共有

## 注意

- preview は本番同様に RevenueCat 実キーで動く。課金検証はサンドボックスアカウントで行う
