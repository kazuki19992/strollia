# 初回起動チュートリアルダイアログ 設計

## 目的

初回起動時に、Strollia の用途、画面下の主要項目、実績システム、位置情報権限の開始導線を短く案内する。権限要求はチュートリアルから直接実行せず、既存の地図上の赤い権限付与パネルへ誘導する。

## 方針

- 共通 `Dialog` コンポーネントを使用する。
- 5つの説明を1つずつ順番に表示する。
- 画像は使わず、短いタイトル・本文・ステップ表示・進行ボタンで構成する。
- 最後のステップを閉じたあと、地図上の赤い権限付与パネルのボタンを押すよう明確に案内する。
- 表示済み状態は既存の `app_settings` に保存し、次回起動以降は表示しない。
- 設定画面の「このアプリについて」の直下に「チュートリアル」を表示し、完了後も同じチュートリアルを再表示できる。

## コンポーネント

### `FirstLaunchTutorialDialog`

**ファイル:** `src/app/components/FirstLaunchTutorialDialog.tsx`

初回チュートリアル専用の本文を持ち、枠・閉じる操作・アニメーションは `Dialog` に委譲する。

Props:

```ts
export type FirstLaunchTutorialDialogProps = {
  /** 表示状態。 */
  visible: boolean;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** チュートリアル完了時に呼ぶ。 */
  onComplete: () => void;
};
```

挙動:

- 内部 state で現在ステップを管理する。
- `Dialog` は `autoClose={false}`、`swipeToClose={false}` で使用する。
- 1から3ステップ目の主要ボタンは `次へ`。
- 5ステップ目の主要ボタンは `地図で確認する`。
- 右上の閉じるボタンでも完了扱いにする。初回起動時の再表示ループを避けるため、途中で閉じても `onComplete` を呼ぶ。

## 表示内容

1. タイトル: `Strolliaへようこそ`

   本文: `Strolliaは、歩いた場所や移動した道のりを端末内に記録するGPSロガーです。記録したデータは、あなたの明示操作なしに外部へ送信しません。`

2. タイトル: `画面下の項目`

   本文: `画面下から、日ごとの記録、実績、月ごとのレポート、設定を開けます。普段は地図を見ながら、必要なときに各項目を確認できます。`

3. タイトル: `実績を集める`

   本文: `移動距離や訪問した地域、記録日数に応じて実績が解除されます。続けて使うほど、自分の移動の積み重ねが見えるようになります。`

4. タイトル: `さいごに`

   本文: `安全に楽しくおさんぽするために、次のことを守りましょう。`

   - `立入禁止の場所や私有地に入らない`
   - `交通ルールを守り、まわりに注意する`
   - `危険な場所には近づかない、入らない`
   - `体調が悪くなったら無理に続けない`

5. タイトル: `権限を付与してはじめる`

   本文: `まずは位置情報の権限を付与してはじめましょう。チュートリアルを閉じたあと、地図上に表示される赤い権限付与パネルのボタンを押してください。`

## 永続化

`App.tsx` に設定キーを追加する。

```ts
const FIRST_LAUNCH_TUTORIAL_COMPLETED_SETTING_KEY = 'firstLaunchTutorialCompleted';
```

初期化時に `getBooleanSetting(FIRST_LAUNCH_TUTORIAL_COMPLETED_SETTING_KEY, false)` を読み込む。未完了なら、DB初期化、設定読み込み、権限状態取得、初回データ同期が終わって `isReady` になったあとにダイアログを表示する。

完了時は以下を行う。

- UI state の表示を閉じる。
- `setSetting(FIRST_LAUNCH_TUTORIAL_COMPLETED_SETTING_KEY, true)` を呼ぶ。
- 保存失敗時もセッション内では閉じたままにし、ユーザーの操作を妨げない。

## App への組み込み

`App.tsx` に以下を追加する。

- `isFirstLaunchTutorialVisible` state。
- 初期化時の設定読み込み。
- `completeFirstLaunchTutorial` ハンドラ。
- 設定画面から呼ぶ `openFirstLaunchTutorial` ハンドラ。
- ルート描画の末尾に `FirstLaunchTutorialDialog` を配置。

実績解除ダイアログや実績詳細ダイアログとは別 state で管理する。初回チュートリアルは初回起動時のみの説明であり、実績通知キューには参加しない。

設定画面では「このアプリについて」の直下に `チュートリアル` の `ActionPill` を置く。再表示時は `firstLaunchTutorialCompleted` を変更せず、現在のセッションで `FirstLaunchTutorialDialog` を開くだけにする。
設定画面から再表示した場合、最終ステップのボタン文言は `閉じる` にする。初回起動時の最終ステップは、権限付与パネルへ視線を戻す意図で `地図で確認する` のままにする。

`FirstLaunchTutorialDialog` は `visible=true` になったタイミングでステップを1ページ目へ戻す。本文は1つの長文にせず、読みやすい単位の段落として複数の `Text` に分けて表示する。

2ステップ目の「画面下の項目」では、タイトル直下・本文上に `assets/tutorial/home-screen-instruction.png` を表示する。画像用の枠はダイアログ幅いっぱいに取り、枠の実測幅から左右余白を引いた数値を画像の `width` に指定し、同じ比率から `height` を計算して収める。画像はマップ画面上の要素説明に使う。

## スタイル

既存の `Dialog` 用スタイルを枠として再利用し、本文用に最小限のスタイルを `appStyles.ts` へ追加する。

- `firstLaunchTutorialStepText`
- `firstLaunchTutorialTitle`
- `firstLaunchTutorialDescription`
- `firstLaunchTutorialActions`
- `firstLaunchTutorialButton`
- `firstLaunchTutorialButtonText`

テキストは太字をデフォルトにしない。ステップ表示やタイトルも、既存テーマの色・サイズ・余白で情報階層を作る。

## テスト

### コンポーネントテスト

`src/app/components/__tests__/FirstLaunchTutorialDialog.test.tsx`

- 1ステップ目のタイトルと本文を表示する。
- `次へ` を押すと2、3、4、5ステップ目へ進む。
- 2ステップ目ではマップ画面の要素説明画像をタイトル下に表示する。
- 5ステップ目で `地図で確認する` を押すと `onComplete` を呼ぶ。
- 再表示用の完了ボタン文言を `閉じる` に変更できる。
- 非表示から再表示したときは1ステップ目から始まる。
- 閉じる操作でも `onComplete` を呼ぶ。
- `Dialog` に `swipeToClose={false}` 相当の挙動としてスワイプヒントを表示しない。

### App 統合テスト

`src/app/__tests__/AppMapReturn.test.tsx` など既存の App 初期化テストに追加する。

- `firstLaunchTutorialCompleted=false` のとき初回チュートリアルを表示する。
- 完了ボタン押下で `setSetting('firstLaunchTutorialCompleted', true)` を呼ぶ。
- `firstLaunchTutorialCompleted=true` のとき表示しない。
- 設定画面の `チュートリアル` 押下で初回チュートリアルを再表示する。
- 設定画面からの再表示では最終ボタン文言を `閉じる` にし、閉じても初回完了保存や通知権限要求を再実行しない。

## ドキュメント更新

ユーザー向け挙動として初回チュートリアルと権限導線を追加するため、`docs/mvp.md` に短く追記する。

## 画像

今回の実装では画像を使わない。将来使う場合は、以下の3種類があると説明効果が高い。

- 画面下の4項目を指し示すスクリーンショット風画像
- 実績バッジが並ぶ小さな説明画像
- 赤い権限付与パネルの場所を示すスクリーンショット風画像
