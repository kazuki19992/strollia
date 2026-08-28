---
name: add-setting
description: Use when adding a new user-facing setting (toggle, selection, value) to the Strollia settings screen, or persisting a new app preference. Triggers include 設定項目追加, 設定画面, app_settings, トグル追加.
---

# 設定項目追加

## 前提

設定値は SQLite の `app_settings` テーブル(key-value、値はJSON文字列)に保存する。AsyncStorage は使わない。

## 手順

1. **キー設計**: 設定キー(camelCase文字列)と型・デフォルト値を決める。既存キーは `settingsRepository` の呼び出し箇所を grep して確認
2. **読み書き**: `src/features/settings/settingsRepository.ts` の既存関数を使う
   - 読み: `getBooleanSetting(key, fallback)` / `getStringSetting(key, fallback)`(壊れた値はfallbackに落ちる)
   - 書き: `setSetting(key, value)`、複数同時は `setSettings(entries)`(単一トランザクション)
   - 新しい型(number等)が必要な場合のみ、同ファイルに同じパターンで getter を追加
3. **状態管理**: `src/app/App.tsx` で state として保持し、起動時に読み込み、変更時に保存する既存パターンに従う
4. **UI追加**: `src/app/components/SettingsScreen.tsx` に行を追加
   - 2〜3択は `OptionGroup` + `SelectionTile`、説明付き項目は `InfoBlock` + `ActionPill`(`DESIGN.md` §14 参照)
   - 説明文言は影響範囲が分かる文にし、`src/app/appText.ts` に置く
5. **Plus限定の場合**: `premium-gate` スキルを参照
6. **テスト**: 設定の読み書き分岐(保存済み/未保存/壊れた値)と、UIの表示切替をテスト(`.ai/context/testing.md`)
7. **検証**: `npm run typecheck` と `npm test`。設定の永続化(アプリ再起動相当)の挙動を確認

## よくある間違い

- 新しい保存の仕組みを追加する → 必ず `app_settings` + `settingsRepository` を経由する
- 設定画面にカード型UIを追加する → リスト主体・帯状UI(`DESIGN.md` §2.2)
- デフォルト値の分岐漏れ → getter の fallback とUI初期値を一致させる
