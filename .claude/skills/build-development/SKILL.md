---
name: build-development
description: Use when creating a development build of Strollia with EAS (development client for simulators/devices). Triggers include developmentビルド, 開発ビルド, dev build, eas build development.
---

# developmentビルド

開発クライアント(`developmentClient: true`)入りの内部配布ビルドを作成する。

## プロファイル(eas.json)

- `distribution: internal`
- env: `EXPO_PUBLIC_STROLLIA_BUILD_PROFILE=development`, `SENTRY_DISABLE_AUTO_UPLOAD=true`

## 手順

1. **事前チェック**: `npm run typecheck` と `npm test` が通ることを確認
2. **環境変数確認**: `.env` に必要キーがあるか `.env.example` と突き合わせる
   - `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
   - `GOOGLE_MAPS_ANDROID_API_KEY`(Androidビルド時)
3. **ビルド実行**:

   ```bash
   npx eas build --profile development --platform ios
   npx eas build --profile development --platform android
   # 両方: --platform all
   ```

4. **結果確認**: コマンド出力のビルドURLでステータスを確認。失敗時はログの該当エラーを読み、原因を特定してから再実行する

## 補足

- ローカルのシミュレータ実行だけなら EAS を使わず `npm run ios` / `npm run android` で足りる
- 開発検証で Plus を有効化したい場合は `premium-gate` スキルの開発フラグを参照
