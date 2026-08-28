---
name: publish
description: Use when submitting a completed Strollia production build to the App Store / Google Play. Triggers include ストア提出, 公開, submit, eas submit, App Store提出, 審査提出.
---

# ストア提出 (publish)

完了済みの production ビルドをストアへ提出する。

## 前提

- production ビルドが完了していること(なければ `build-production` スキルを先に実行)
- iOS の提出先: App Store Connect App ID `6777709044`(eas.json の `submit.production.ios.ascAppId`)

## 手順

1. **ビルド確認**: 提出対象のビルドが成功済みか確認

   ```bash
   npx eas build:list --profile production --limit 3
   ```

2. **提出実行**(最新の完了ビルドを提出):

   ```bash
   npx eas submit --profile production --platform ios --latest
   npx eas submit --profile production --platform android --latest
   ```

   特定ビルドを提出する場合は `--id <build-id>` を使う

3. **結果確認**: 提出ステータスを確認。App Store Connect / Google Play Console 側の審査ステータスはユーザーに確認を依頼する
4. **タグ付け**: リリースが確定したら `tag-release` スキルで main にタグを付ける

## 注意

- 提出は外部公開につながる操作。ユーザーの明示的な指示がある場合のみ実行する
- ストアのメタデータ(スクリーンショット、説明文)はこのスキルの範囲外。変更が必要ならユーザーに確認する
