# 不具合レポート送信設定 設計書

作成日: 2026-07-24

## 背景と目的

Sentry による不具合(App Hang / クラッシュ)レポートは現状 production ビルドで常時送信される。ユーザーが送信可否を選べる設定がないため、設定画面に「プライバシー」セクションを新設し、送信のオン/オフを切り替えられるトグルを追加する。デフォルトは有効にして、不具合改善のスピードを保つ。あわせて初回起動チュートリアルで不具合レポートについて告知し、その場で切り替えられるようにして、透明性(誠実さ)とオンボーディング体験を両立する。

## 要件

- 設定画面に新セクション「プライバシー」を追加し、不具合レポート送信のトグルを1つ置く。
- 初回起動チュートリアルに不具合レポートを告知するステップを追加し、そのステップ内でも同じトグルを切り替えられるようにする。
- デフォルトは有効(true)。
- 位置情報・移動経路など個人を特定できる情報は送らない(既存のマスク処理を維持)。この旨を説明文に明記する。
- 設定画面とチュートリアルのトグルは同じ状態(`AppStateProvider` の `crashReportingEnabled`)を参照し、常に同期する。
- オフにすると Sentry へイベントを送らない。オンに戻すと再び送る。
- 設定は端末内 SQLite に永続化する。

## 確定文面

### 設定画面

- セクションタイトル: **プライバシー**
- 項目タイトル: **不具合レポートを送る**
- 説明文: **アプリが固まったり、落ちたりしたときなどの不具合の記録を開発者に自動で送ります。あなたの位置情報や移動記録など、あなたを特定できてしまう情報は送りません。有効にしておくと不具合改善が早くなります。**

### 初回チュートリアル(新規ステップ)

チュートリアル1ページ目の「記録したデータは明示操作なしに外部送信しない」と矛盾して見えないよう、「位置情報・移動記録は送らない/不具合の記録だけは既定で送る(切替可)」と区別して書く。

- ステップタイトル: **不具合レポートについて**
- 本文(案。ユーザーレビュー対象):
  - あなたの位置情報や移動記録は、これまで通り外部に送りません。
  - ただし、アプリが固まったり落ちたりしたときの不具合の記録だけは、改善のために開発者へ自動で送ります(あなたを特定できる情報は含みません)。下のスイッチでいつでも切り替えられます。
- ステップ内トグルのラベル: **不具合レポートを送る**(設定画面と同一)

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

### UI（設定画面）

- `SettingsScreen` に「プライバシー」`ScreenSection` を追加する(「アプリ情報」セクションの直前)。
- セクション内に既存の `settingsInlineRow` パターン(`formItemTitle` + `formItemDescription` + `Switch`)でトグル行を1つ置く。
- `Switch` の `onValueChange` で `onUpdateCrashReportingEnabled(value)` を呼ぶ。失敗時は `Alert.alert` で通知する(既存トグルと同じ)。
- `Switch` に `accessibilityLabel`(例: 「不具合レポートを送る」)を付ける。

### UI（初回チュートリアル）

- `FirstLaunchTutorialDialog` に不具合レポート告知ステップを追加する。既存の `TUTORIAL_STEPS` は静的な配列(title/paragraphs/bullets)なので、ステップ定義に「このステップで不具合レポートトグルを表示する」ことを示す任意フラグ(例: `showCrashReportingToggle?: boolean`)を1つ足す。トグルの現在値と操作は runtime のため配列には持たせず、props から受け取る。
- `FirstLaunchTutorialDialogProps` に `crashReportingEnabled: boolean` と `onUpdateCrashReportingEnabled: (enabled: boolean) => void` を追加する。
- `showCrashReportingToggle` が true のステップでは、本文の下に `Switch`(値 `crashReportingEnabled`、`onValueChange` で `onUpdateCrashReportingEnabled`)を描画する。`accessibilityLabel` は設定画面と同一の「不具合レポートを送る」。
- 追加位置: 安全上の注意(「さいごに」)の後、位置情報許可の案内(「位置情報を確認してはじめる」)の前あたり。既存ステップの文言・順序は変えない。

## データフロー

```
起動時:
  useAppInitialization
    → getBooleanSetting('crashReportingEnabled', true)
    → setCrashReportingEnabled(value)  // sentry.ts のフラグ
    → UI 状態 crashReportingEnabled = value

トグル操作時(設定画面・チュートリアルとも同じ経路):
  Switch onValueChange
    → AppStateProvider.updateCrashReportingEnabled(value)
       → UI 状態更新
       → setCrashReportingEnabled(value)      // 即時反映
       → setSetting('crashReportingEnabled', value)  // 永続化
       → 失敗時は UI 状態と Sentry フラグを巻き戻し
    ※ 設定画面とチュートリアルは同じ crashReportingEnabled を参照するため自動同期する

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
- `FirstLaunchTutorialDialog`:
  - 不具合レポート告知ステップが表示され、`showCrashReportingToggle` ステップで `Switch` が表示される。
  - チュートリアルのトグル押下で `onUpdateCrashReportingEnabled` が呼ばれる。
  - `crashReportingEnabled` の値が `Switch` に反映される。
- 文言: `appText.ts` の定数が確定文面と一致する。

## スコープ外(YAGNI)

- 起動時の専用オプトイン同意モーダルは作らない。デフォルト有効 + チュートリアルでの告知/切替 + 設定でいつでもオフにできる形とする。
- dev/preview ビルドでの送信挙動は変更しない(元々オフ)。
- レポート送信履歴の表示や、送信データのプレビュー機能は作らない。

## 影響ファイル(想定)

- `src/config/sentry.ts` — フラグ・`setCrashReportingEnabled`・`beforeSend` 拡張
- `src/config/__tests__/sentry.test.ts` — テスト追加
- `src/ui/hooks/useAppInitialization.ts` — 起動時読み込み・フラグ反映
- `src/ui/state/AppStateProvider.tsx` — 状態・`updateCrashReportingEnabled`
- `src/ui/components/SettingsScreen.tsx` — プライバシーセクション・トグル
- `src/ui/components/FirstLaunchTutorialDialog.tsx` — 告知ステップ・トグル・props 追加
- `src/ui/appText.ts` — 文言定数
- `src/app/settings/index.tsx` — props 受け渡し
- `src/app/_layout.tsx` — チュートリアルへ `crashReportingEnabled` / `onUpdateCrashReportingEnabled` を配線(`FirstLaunchTutorialDialog` の描画箇所)
- 関連テスト各種
