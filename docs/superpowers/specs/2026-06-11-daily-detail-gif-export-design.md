# 日別記録詳細：スライダー改善とGIF出力 設計

## 背景・目的

日ごとの記録の詳細画面（`DailyLogDetailScreen`）の移動軌跡スライダーを改善し、
その日の移動記録をアニメーションGIFとして出力・共有できるようにする。

## 要件

### 1. スライダー

- ステップを **30分 → 5分** に変更する。
- 高さを縮め、幅を広げる（地図の真下に従来どおり配置）。

### 2. キャプチャ範囲

- 画面下「この日の記録を共有」のキャプチャ画像に、**スライダーとGIF出力ボタンを含めない**。
- 地図・移動のデータ・おもいでは従来どおりキャプチャに含める。

### 3. GIF出力ボタン

- スライダーの時刻表示（`valueLabel`）の直下に、他と同じ `ActionPill` コンポーネントで配置。
- 表示条件は Plus 会員のみ（スライダーと同条件）。

### 4. GIF生成

- **フレーム**: 記録の最初の点〜最後の点を10分刻み。各コマは開始から該当時刻までの**累積軌跡**。
- **再生**: 0.5秒/コマ、ループ。
- **解像度**: 480×480px。
- **地図内容**: 地図＋移動軌跡の線のみ（visited グリッドは描かない）。
- **オーバーレイ**:
  - 左上: そのコマの時刻 `HH:MM` を DSEG フォント（`NUMERIC_DISPLAY_FONT`）で表示。視認性のため半透明の暗い下地。
  - 右下（小さく）: 左にアプリアイコン（`assets/icon.png`、右テキスト2行ぶんの高さに合わせる）、右に1行目 小さめ「おさんぽ記録アプリ」/2行目 やや大きめ太字「すとろりあ」。

## 改訂（2026-06-11）: 区間指定と15分刻み

長時間記録ではコマ数が増え生成が70秒を超えうるため、出力前に時間範囲を指定する方式へ変更する。

- **コマ間隔**: 10分 → **15分**。
- **区間指定ダイアログ**: GIFボタン押下で、まず共通 `Dialog`（閉じる可＝dismissible 既定）上に「地図プレビュー＋区間指定スライダー（開始・終了の2つまみ）＋『この範囲で出力』ボタン」を表示する。
  - 区間指定スライダーは新規 `RangeSlider`（2つまみ）。範囲は記録の最初の点〜最後の点。選択粒度は5分。初期値は記録全体。
  - 地図プレビューは選択区間の軌跡を表示（範囲変更に追従）。区間外（例: 自宅周辺）は含めずに選べる。
- **フレーム**: 選択した開始時刻から終了時刻まで15分刻み。各コマは**選択開始時刻からの累積**軌跡（区間内のみ）。
- **地図範囲**: 選択区間の軌跡にフィット（`createInitialRegion(選択区間の点)`）。区間外は写らない。
- 「この範囲で出力」で区間指定ダイアログを閉じ、生成（進捗ダイアログ）へ進む。
- これにより最悪コマ数とファイルサイズをユーザーが制御でき、自宅周辺の除外も可能になる。

### 5. 生成中のUX

- 生成中は全画面をブロックする進捗ダイアログを表示し、下の画面を操作不可にする。
- 既存の共通 `Dialog` を**拡張**して実現する（`dismissible` 概念を追加）。
- ダイアログ内容:
  - タイトル「アニメGIF生成中…」
  - 本文: 生成完了まで待ってほしい旨の短いテキスト。
  - プログレスバー（生成済みコマ数 / 全コマ数）。
  - **「キャンセル」ボタンのみ**（×ボタン・スワイプ閉じ・背景タップ閉じは不可）。
  - キャンセルで生成ループを中断し、何も出力せず閉じる。
  - Android の戻るボタンはキャンセル扱い。

## アーキテクチャ

### 変更/新規ファイル

- `src/app/dailyRouteTimeline.ts`: `DAILY_ROUTE_TIME_STEP_MINUTES` を `5` に変更。
- `src/app/__tests__/dailyRouteTimeline.test.ts`: 期待値を更新。
- `src/app/appStyles.ts`: `stepSlider*` のサイズ調整、GIF進捗バー・ブランディング・オーバーレイ用スタイル追加。
- `src/app/components/Dialog.tsx`: `dismissible?: boolean`（既定 true）を追加。false のとき ×ボタン・スワイプ・背景/戻る閉じを無効化。
- `src/features/export/routeGifFrames.ts`（新規・純関数）: フレーム時刻の算出。
- `src/features/export/routeGifExporter.ts`（新規）: フレーム描画オーケストレーション＋エンコード。capture/encode を注入可能にしてテスト容易にする。
- `src/app/components/GifFrameRenderer.tsx`（新規）: 画面外にマウントする固定サイズのフレーム描画View（MapView＋Polyline＋時刻オーバーレイ＋ブランディング）。
- `src/app/components/DailyLogDetailScreen.tsx`: スライダー/ボタン配置変更、キャプチャ除外、GIF生成フローと進捗ダイアログの組み込み。

#### 改訂（区間指定）で追加する主なファイル

- `src/app/components/RangeSlider.tsx`（新規）: 開始・終了の2つのつまみで時間範囲を選ぶスライダー。5分粒度・15分の最小間隔（後ろが前を追い越さない）を強制し、正規化した開始/終了を `onChange` で通知する。
- `src/app/components/rangeSliderValue.ts`（新規・純関数）: つまみの生値をステップへ丸め、`minSeparation` 以上離して範囲外に出ないようクランプする（`resolveRangeThumbValues`）。
- `src/features/export/routeGifFrames.ts`: フレーム時刻を「区間 [開始,終了] を刻む」方式へ変更し、共通定数（`GIF_FRAME_STEP_MINUTES=15`/`GIF_FRAME_DELAY_MS=500`/`GIF_MIN_DURATION_MS=5000`/`GIF_MIN_RANGE_MINUTES=15`）と、最短再生時間を満たすための刻み解決（`resolveGifFrameStepMinutes`）を追加。
- `src/app/components/DailyLogDetailScreen.tsx`: GIFボタン押下でまず区間指定ダイアログ（地図プレビュー＋`RangeSlider`＋「この範囲で出力」）を表示し、選んだ区間だけを生成へ渡す。

### 新規依存

- `gifenc`（純JS・MIT）: GIFエンコード。
- `upng-js`（純JS・MIT）: captureRef が返す PNG を RGBA へデコード。
- いずれもネイティブビルド不要。

### フレーム時刻算出（`routeGifFrames.ts`）

- 入力: その日の点列（時刻昇順）、ステップ（10分）。
- 出力: 最初の点〜最後の点を10分刻みにしたフレームの「分（minute-of-day）」配列。最後の点の時刻は必ず含める。
- 各フレームの点は既存 `filterLocationPointsUntilMinute` で抽出（累積）。
- エッジ: 点が1つ以下なら空（ボタン無効）、記録が10分未満なら1コマ。

### キャプチャ除外方式

- レイアウトは変えず、`isCapturingShare` state を追加。
- `shareDailyLogImage()` 実行時に `true` → 次フレーム待ち → `captureRef` → `false`。
- スライダーと GIF ボタンは `{!isCapturingShare && ...}` で描画し、共有画像から除外する。

### 生成フロー

1. GIFボタン押下 → 進捗ダイアログ表示（`abortRef = false`）。
2. フレーム描画View（`GifFrameRenderer`）を画面外にマウント。MapView の ready を待つ。
3. 各フレーム: index 更新 → rAF 待ち → `captureRef`（480×480, PNG）→ `upng-js` で RGBA デコード → `gifenc` に書き込み（delay 500ms, loop）。
   - 各フレーム後に `abortRef` を確認。キャンセルされていれば中断。
   - 進捗 state を更新。
4. 完了: `gifenc` 出力 → `expo-file-system` で `.gif` 書き出し → `expo-sharing` で共有。
5. 後処理: ダイアログを閉じ、フレームViewをアンマウント。
6. エラー時: アラート表示＋ダイアログ閉じる。

## テスト（TDD）

- `routeGifFrames`: フレーム時刻算出（単点/10分未満/ちょうど境界/通常）。
- スライダー step 定数変更の回帰テスト更新。
- GIF生成オーケストレーション: capture/encode を fake 注入し、フレーム数・キャンセル中断・進捗更新を検証。
- Dialog の `dismissible=false` 時に閉じ操作が無効であることのテスト。
- 区間指定（`resolveRangeThumbValues`）: 5分粒度の丸め、15分の最小間隔（後ろが前を追い越さない）、範囲端でのクランプ。
- 刻み解決（`resolveGifFrameStepMinutes`）: 5秒に満たない区間で刻みを細かくし最低コマ数を満たすこと。
- 生成フロー: 初回フレームでデッドロックしないこと、キャンセルで区間選択へ戻ること、キャンセル後の再生成が前ループ完了を待つこと、生成中の画面離脱で別画面をキャプチャしないこと。
- 実際の captureRef / エンコード / 共有は実機確認。

## 非対象（YAGNI）

- コマ数の上限設定（記録の最初〜最後で素直に生成。長時間記録での所要時間は許容）。
- GIF以外のフォーマット（mp4等）。
- visited グリッドのGIF描画。
