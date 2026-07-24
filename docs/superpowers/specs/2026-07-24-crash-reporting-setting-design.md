# 不具合レポート送信設定 設計書

作成日: 2026-07-24

## 背景と目的

Sentry による不具合(App Hang / クラッシュ)レポートは現状 production ビルドで常時送信される。ユーザーが送信可否を選べる設定がないため、設定画面に「プライバシー」セクションを新設し、送信のオン/オフを切り替えられるトグルを追加する。デフォルトは有効にして、不具合改善のスピードを保つ。

## 要件

- 設定画面に新セクション「プライバシー」を追加する。
- セクション内に不具合レポート送信のトグルを1つ置く。
- デフォルトは有効(true)。
- 位置情報・移動経路など個人を特定できる情報は送らない(既存のマスク処理を維持)。この旨を説明文に明記する。
- オフにすると Sentry へイベントを送らない。オンに戻すと再び送る。
- 設定は端末内 SQLite に永続化する。

## 確定文面

- セクションタイトル: **プライバシー**
- 項目タイトル: **不具合レポートを送る**
- 説明文: **アプリが固まったり、落ちたりしたときなどの不具合の記録を開発者に自動で送ります。あなたの位置情報や移動記録など、あなたを特定できてしまう情報は送りません。有効にしておくと不具合改善が早くなります。**

文言定数は `src/ui/appText.ts` に集約する(既存規約)。

## アーキテクチャ

### データ保存

- SQLite `app_settings` にキー `crashReportingEnabled` で boolean を保存する。
- 読み書きは `src/features/settings/settingsRepository.ts` の `getBooleanSetting` / `setSetting` を使う。
- デフォルト値は `getBooleanSetting(CRASH_REPORTING_ENABLED_SETTING_KEY, true)` の fallback=true で表現する(未保存時は有効)。

### Sentry 送信のゲート

`src/config/sentry.ts` にモジュールレベルの状態と操作を追加する。

- `let isCrashReportingEnabled = true;`(初期値 true)
- `export function setCrashReportingEnabled(enabled: boolean): void` — フラグを更新する。
- `beforeSend(event)` を拡張し、`isCrashReportingEnabled === false` の場合は `null` を返してイベントを送らない。有効な場合は従来どおり `filterSentryEventBeforeSend(event)`(位置情報マスク)を通す。

`Sentry.init` は起動時(`index.ts`)に同期実行され DB 初期化より前に走るため、init 自体を設定で切り替えることはできない。init は常に実行し、`beforeSend` のフラグ参照で送信可否だけを動的に制御する。この設計により、初期化タイミングを変えずに送信のオン/オフを実現する。

### 状態と操作の結線

- 起動時初期化(`src/ui/hooks/useAppInitialization.ts`)で `getBooleanSetting(CRASH_REPORTING_ENABLED_SETTING_KEY, true)` を読み込み、`setCrashReportingEnabled(value)` で Sentry フラグへ反映し、UI 状態(`crashReportingEnabled`)へも設定する。
- `AppStateProvider` に `crashReportingEnabled: boolean` と `updateCrashReportingEnabled(enabled: boolean): Promise<void>` を追加する。
  - `updateCrashReportingEnabled` は UI 状態を更新し、`setCrashReportingEnabled(enabled)` で Sentry フラグへ即時反映し、`setSetting(CRASH_REPORTING_ENABLED_SETTING_KEY, enabled)` で永続化する。
  - 永続化に失敗した場合は UI 状態と Sentry フラグを元の値へ巻き戻す(`updateKeepScreenAwake` と同じ、UIとストレージの乖離を残さない方針)。
- 設定画面ルート(`src/app/settings/index.tsx`)経由で `SettingsScreen` へ props を渡す。

### UI

- `SettingsScreen` に「プライバシー」`ScreenSection` を追加する(「アプリ情報」セクションの直前)。
- セクション内に既存の `settingsInlineRow` パターン(`formItemTitle` + `formItemDescription` + `Switch`)でトグル行を1つ置く。
- `Switch` の `onValueChange` で `onUpdateCrashReportingEnabled(value)` を呼ぶ。失敗時は `Alert.alert` で通知する(既存トグルと同じ)。
- `Switch` に `accessibilityLabel`(例: 「不具合レポートを送る」)を付ける。

## データフロー

```
起動時:
  useAppInitialization
    → getBooleanSetting('crashReportingEnabled', true)
    → setCrashReportingEnabled(value)  // sentry.ts のフラグ
    → UI 状態 crashReportingEnabled = value

トグル操作時:
  SettingsScreen Switch onValueChange
    → AppStateProvider.updateCrashReportingEnabled(value)
       → UI 状態更新
       → setCrashReportingEnabled(value)      // 即時反映
       → setSetting('crashReportingEnabled', value)  // 永続化
       → 失敗時は UI 状態と Sentry フラグを巻き戻し

イベント送信時:
  Sentry イベント発生
    → beforeSend(event)
       → isCrashReportingEnabled === false なら null（送らない）
       → true なら filterSentryEventBeforeSend(event)（位置情報マスクして送る）
```

## エラーハンドリング

- 設定読み込み失敗: `getBooleanSetting` は既存実装で壊れた値・未保存時に fallback を返すため、デフォルト true が使われる。
- 設定保存失敗: `updateCrashReportingEnabled` で UI 状態と Sentry フラグを元の値へ巻き戻し、`Alert` で通知する。
- Sentry 未初期化(dev/preview): `isSentryEnabledForBuild()` が false のビルドでは `Sentry.init` を実行しないため `beforeSend` も呼ばれない。設定値は保存されるが送信への実効は production のみ。フラグ操作は副作用がなく安全。

## テスト方針

- `sentry.ts`:
  - `isCrashReportingEnabled=false`(`setCrashReportingEnabled(false)`)のとき `beforeSend` が `null` を返す。
  - `true` のとき `filterSentryEventBeforeSend` を通した(位置情報マスク済みの)イベントを返す。
  - `initializeSentry` の `Sentry.init` 呼び出しに `beforeSend` が渡っていることは既存テストで担保。
- `AppStateProvider` / フック:
  - `updateCrashReportingEnabled(true/false)` で `setSetting` が正しいキー・値で呼ばれる。
  - 保存失敗時に UI 状態が巻き戻る(既存 `updateKeepScreenAwake` テストと同型)。
- `SettingsScreen`(`renderRouter` 統合 or コンポーネント):
  - プライバシーセクションとトグルが表示される。
  - トグル押下で `onUpdateCrashReportingEnabled` が呼ばれる。
- 文言: `appText.ts` の定数が確定文面と一致する。

## スコープ外(YAGNI)

- 初回起動時のオプトイン同意ダイアログは作らない。デフォルト有効 + 設定でいつでもオフにできる形とする。
- dev/preview ビルドでの送信挙動は変更しない(元々オフ)。
- レポート送信履歴の表示や、送信データのプレビュー機能は作らない。

## 影響ファイル(想定)

- `src/config/sentry.ts` — フラグ・`setCrashReportingEnabled`・`beforeSend` 拡張
- `src/config/__tests__/sentry.test.ts` — テスト追加
- `src/ui/hooks/useAppInitialization.ts` — 起動時読み込み・フラグ反映
- `src/ui/state/AppStateProvider.tsx` — 状態・`updateCrashReportingEnabled`
- `src/ui/components/SettingsScreen.tsx` — プライバシーセクション・トグル
- `src/ui/appText.ts` — 文言定数
- `src/app/settings/index.tsx` — props 受け渡し
- 関連テスト各種
