# GPX Import Design

## 1. Purpose

Strollia はローカルファーストのGPSロガーである。GPXインポートは、ユーザーが過去にエクスポートしたGPSログや他ツールで作成したGPXログを、端末内SQLiteへ取り込めるようにする。

初期実装では GPX のみ対応する。KML は今回の対象外とし、設定画面の説明も GPX インポートとして明示する。

## 2. Scope

今回実装する範囲は以下とする。

- 設定画面のインポート導線を GPX 専用の説明に変更する
- ファイルピッカーから `.gpx` ファイルを選択する
- GPX文字列からGPSポイントを抽出する
- 抽出したGPSポイントを `location_points` に保存する
- `daily_logs` と `visited_cells` を取り込みデータに合わせて更新する
- 既存GPSポイントと重複する点はスキップする
- 取り込み完了時に、取り込み件数とスキップ件数を表示する

今回実装しない範囲は以下とする。

- KMLインポート
- KMLエクスポート
- GPXウェイポイント単体の取り込み
- GPXルート要素単体の取り込み
- 既存データの上書きや削除
- インポート履歴画面
- クラウド同期や外部サーバー送信

## 3. Supported GPX

初期実装では、GPX 1.1 のトラックポイントを対象にする。

対応する要素は以下とする。

- `trk/trkseg/trkpt`
- `trkpt` の `lat`
- `trkpt` の `lon`
- `trkpt/time`
- `trkpt/ele`

`time` がない `trkpt` は、日別表示や重複判定の基準を作れないためスキップする。`lat` または `lon` が数値として読めない点もスキップする。

GPX内の名前空間有無に依存しないよう、パーサはタグ名のローカル名で `trkpt`、`time`、`ele` を扱う。

## 4. Data Model

インポートしたGPSポイントは既存の `NewLocationPoint` として扱う。

各値の変換は以下とする。

| 保存値 | GPX由来 |
| --- | --- |
| `recordedAt` | `trkpt/time` |
| `localDate` | `recordedAt` を既存の `toLocalDate` で変換 |
| `latitude` | `trkpt@lat` |
| `longitude` | `trkpt@lon` |
| `altitude` | `trkpt/ele`。なければ `null` |
| `speed` | `null` |
| `heading` | `null` |
| `accuracy` | `null` |
| `altitudeAccuracy` | `null` |

DB保存時の `source` は、通常のGPS記録と区別できるよう `gpx-import` とする。

## 5. Deduplication

重複判定は、既存データに同じ `recorded_at`、`latitude`、`longitude` の点があるかで行う。

理由は以下である。

- Strollia自身のGPXエクスポートを再インポートしても二重登録しない
- 異なる時刻の同一座標は移動ログとして意味があるため残す
- 同時刻でも座標が異なる点は、外部GPXの補正差分として残せる

初期実装では緯度経度を丸めず、DBへ保存する数値と同じ値で比較する。外部GPXの小数丸め差による近似重複判定は将来改善とする。

## 6. Import Flow

設定画面からGPXインポートを選択したときの流れは以下とする。

1. OS標準のファイルピッカーを開く
2. ユーザーがキャンセルした場合は何もしない
3. 選択ファイルのテキストを読み込む
4. GPX文字列をパースする
5. 有効なGPSポイントがない場合はエラーを表示する
6. GPSポイントを時刻順に並べる
7. 重複しない点を保存する
8. 保存した点から `visited_cells` を更新する
9. 取り込み結果を Alert で表示する
10. 画面上のログ、地図、日別一覧を再読み込みする

取り込み中は多重実行を避けるため、App側に `isImportingGpx` 状態を持つ。取り込み中に再度タップされた場合は何もしない。

## 7. Architecture

責務は以下に分ける。

### 7.1 GPX Parser

`src/features/import/gpxImporter.ts` に、GPX文字列を `NewLocationPoint[]` へ変換する純粋関数を置く。

この層はDB、ファイルピッカー、Alertに依存しない。

### 7.2 Import Repository

`src/features/import/importRepository.ts` に、GPX由来のポイント保存処理を置く。

この層は以下を担当する。

- 重複確認
- `location_points` への保存
- `daily_logs` の更新
- `visited_cells` の更新
- 取り込み件数とスキップ件数の集計

既存の `insertLocationPoint` は `source` が `expo-location` 固定であり、通常記録向けの関数である。GPXインポートでは `source` を `gpx-import` にする必要があるため、共通の内部保存関数を作るか、インポート用保存関数を別に用意する。

### 7.3 File Picker Service

`src/features/import/gpxImportService.ts` に、ファイル選択とファイル読み込みを置く。

Expo公式モジュールとして `expo-document-picker` を追加する。ファイル内容の読み込みは既存の `expo-file-system/legacy` を使う。

### 7.4 App Integration

`App.tsx` の既存 `showImportPlaceholder` を GPXインポート実行関数へ差し替える。

成功時は既存の再読み込み関数を呼び、メイン地図、日別ログ、月次レポート材料が次回表示時に新しいデータを使えるようにする。

## 8. Error Handling

表示するエラーは、ユーザーが次の操作を判断できる文言にする。

- ファイル選択キャンセル: 何も表示しない
- GPXとして読めない: `GPXファイルを読み込めませんでした。`
- 有効なGPSポイントがない: `取り込めるGPSポイントがありませんでした。`
- DB保存に失敗: `GPXインポートに失敗しました。`

内部エラーの詳細は、必要に応じて開発中のみ `console.warn` に出す。

## 9. Privacy

インポート処理は端末内で完結する。ユーザーが選択したGPXファイルの内容を外部サーバーへ送信しない。

GPXファイルには過去の位置情報が含まれるため、設定画面の説明では「選択したGPXファイルを端末内に取り込む」ことが分かる表現にする。

## 10. Testing

テストは日本語の説明文で書く。

追加する主なテストは以下とする。

- GPXの `trkpt` から `NewLocationPoint` を作る
- `ele` がない場合は `altitude` を `null` にする
- `time` がない `trkpt` はスキップする
- 数値として読めない緯度経度はスキップする
- 有効点がないGPXは取り込み不可として扱う
- 既存点と同じ `recordedAt`、`latitude`、`longitude` はスキップする
- 重複しない点は `location_points`、`daily_logs`、`visited_cells` に反映する
- 設定画面のインポート文言がGPX専用になっている

## 11. Documentation Updates

実装時には以下を更新する。

- `docs/todo.md`: GPXインポートの完了状態とKML後回しを明確化する
- `docs/mvp.md`: 非対象の「インポート」を GPX対応後の表現へ更新する
- `docs/data-storage.md`: インポート仕様をGPXのみの初期対応として追記する
