# データ保存仕様

## 1. 基本方針

Strollia の記録データは、原則としてすべて端末内にローカル保存する。

サーバーは初期構成では用意しない。これにより、以下を実現する。

- サーバー運用費を発生させない
- 個人の位置情報を外部に送信しない
- オフライン環境でも記録済みログを閲覧できる
- ユーザーが自分のデータを端末内で管理できる

クラウド同期、バックアップ、共有機能は将来検討とし、初期仕様には含めない。

## 2. 保存方式

ローカルデータベースとして SQLite を使用する方針とする。

React Native + Expo では `expo-sqlite` の利用を第一候補とする。`expo-sqlite` はアプリ内で SQLite API を利用でき、データベースはアプリの再起動後も永続化される。

## 3. 保存対象データ

主な保存対象は以下とする。

- GPS位置情報ポイント
- 日単位の記録メタデータ
- 記録セッション
- エクスポート履歴
- インポート履歴
- 写真ジオタグ表示用メタデータ（任意機能）
- アプリ設定
- マップ表示用の派生データ

## 4. 主要テーブル案

### 4.1 `location_points`

GPSで取得した位置情報を保存する中心テーブル。

| カラム | 型 | 説明 |
| --- | --- | --- |
| `id` | INTEGER | 主キー |
| `recorded_at` | TEXT | 取得日時。ISO 8601形式 |
| `local_date` | TEXT | 端末タイムゾーンに基づく日付。例: `2026-05-04` |
| `latitude` | REAL | 緯度 |
| `longitude` | REAL | 経度 |
| `altitude` | REAL NULL | 高度 |
| `speed` | REAL NULL | 速度 |
| `heading` | REAL NULL | 方位 |
| `accuracy` | REAL NULL | 水平方向の位置精度 |
| `altitude_accuracy` | REAL NULL | 高度の精度 |
| `source` | TEXT | 取得元。例: `expo-location` |
| `created_at` | TEXT | DB保存日時 |

### 4.2 `daily_logs`

日単位の記録概要を保存するテーブル。

| カラム | 型 | 説明 |
| --- | --- | --- |
| `id` | INTEGER | 主キー |
| `local_date` | TEXT | 日付。例: `2026-05-04` |
| `started_at` | TEXT NULL | その日の最初の記録時刻 |
| `ended_at` | TEXT NULL | その日の最後の記録時刻 |
| `point_count` | INTEGER | 記録点数 |
| `distance_meters` | REAL NULL | 推定移動距離 |
| `created_at` | TEXT | 作成日時 |
| `updated_at` | TEXT | 更新日時 |

### 4.3 `recording_sessions`

記録開始から停止までのまとまりを保存するテーブル。

自動常時記録にする場合でも、アプリ起動、権限変更、バックグラウンドタスク再開などの境界をセッションとして扱えるようにする。

| カラム | 型 | 説明 |
| --- | --- | --- |
| `id` | INTEGER | 主キー |
| `started_at` | TEXT | セッション開始日時 |
| `ended_at` | TEXT NULL | セッション終了日時 |
| `status` | TEXT | `active`, `stopped`, `interrupted` など |
| `reason` | TEXT NULL | 終了理由または中断理由 |
| `created_at` | TEXT | 作成日時 |
| `updated_at` | TEXT | 更新日時 |

### 4.4 `export_history`

GPX / KML エクスポート履歴を保存するテーブル。

| カラム | 型 | 説明 |
| --- | --- | --- |
| `id` | INTEGER | 主キー |
| `format` | TEXT | `gpx` または `kml` |
| `range_from` | TEXT | 出力開始日時 |
| `range_to` | TEXT | 出力終了日時 |
| `file_name` | TEXT | 出力ファイル名 |
| `point_count` | INTEGER | 出力対象の記録点数 |
| `created_at` | TEXT | エクスポート日時 |

### 4.5 `visited_cells`

メインマップの Visited Grid Overlay 表示に使う訪問済みセルを保存するテーブル。

保存粒度は100mセルのみとし、表示時に200m、500m、1km、2km、5km、10km相当へ集約する。

| カラム | 型 | 説明 |
| --- | --- | --- |
| `cell_id` | TEXT | 主キー。形式は `100:x:y` |
| `cell_size_meters` | INTEGER | 保存セルサイズ。当面は100 |
| `x` | INTEGER | Web Mercatorメートル座標をセルサイズで割ったX番号 |
| `y` | INTEGER | Web Mercatorメートル座標をセルサイズで割ったY番号 |
| `first_visited_at` | TEXT | 初回訪問日時 |
| `last_visited_at` | TEXT | 最終訪問日時 |
| `visit_count` | INTEGER | 訪問回数 |
| `source` | TEXT | 取得元。例: `gps` |
| `created_at` | TEXT | 作成日時 |
| `updated_at` | TEXT | 更新日時 |

### 4.6 `import_history`

GPX / KML インポート履歴を保存するテーブル。

初期実装ではGPXのみインポート対象とする。既存の `recorded_at`、`latitude`、`longitude` と一致する点がある場合は既存データを優先し、GPX側の点はスキップする。KMLインポートは後続対応とする。

| カラム | 型 | 説明 |
| --- | --- | --- |
| `id` | INTEGER | 主キー |
| `format` | TEXT | `gpx` または `kml` |
| `file_name` | TEXT | 取り込み元ファイル名 |
| `range_from` | TEXT NULL | 取り込みデータの開始日時 |
| `range_to` | TEXT NULL | 取り込みデータの終了日時 |
| `imported_point_count` | INTEGER | 取り込んだ記録点数 |
| `skipped_point_count` | INTEGER | 重複などでスキップした記録点数 |
| `created_at` | TEXT | インポート日時 |

### 4.7 `photo_assets`（任意機能）

ジオタグ付き写真の表示に必要なメタデータを保存するテーブル。

写真本体はDBに保存しない。ジオタグがない写真も保存しない。

| カラム | 型 | 説明 |
| --- | --- | --- |
| `id` | INTEGER | 主キー |
| `asset_id` | TEXT | 写真ライブラリ上のアセットID |
| `taken_at` | TEXT NULL | 撮影日時 |
| `latitude` | REAL | 緯度 |
| `longitude` | REAL | 経度 |
| `local_uri` | TEXT NULL | ローカル参照URI |
| `thumbnail_uri` | TEXT NULL | サムネイルキャッシュURI |
| `last_seen_at` | TEXT | 最終確認日時 |
| `created_at` | TEXT | 作成日時 |
| `updated_at` | TEXT | 更新日時 |

### 4.8 `app_settings`

ユーザー設定を保存するテーブル。

| カラム | 型 | 説明 |
| --- | --- | --- |
| `key` | TEXT | 設定キー |
| `value` | TEXT | JSON文字列などで保存する値 |
| `updated_at` | TEXT | 更新日時 |

### 4.9 `visited_admin_areas`

実績システムで都道府県・市区町村の訪問状態を判定するため、訪問済み行政区域を保存するテーブル。

| カラム | 型 | 説明 |
| --- | --- | --- |
| `id` | INTEGER | 主キー |
| `area_type` | TEXT | `prefecture` または `municipality` |
| `area_code` | TEXT NULL | 行政区域コード。初期はNULL許容 |
| `prefecture_name` | TEXT | 都道府県名 |
| `municipality_name` | TEXT NULL | 市区町村名 |
| `normalized_name` | TEXT | 重複判定用の正規化名 |
| `first_visited_at` | TEXT | 初回訪問時刻 |
| `last_visited_at` | TEXT | 最終訪問時刻 |
| `first_location_point_id` | INTEGER NULL | 初回訪問の根拠GPSポイントID |
| `created_at` | TEXT | 作成日時 |
| `updated_at` | TEXT | 更新日時 |

### 4.10 `location_point_admin_areas`

月次レポートや将来の期間指定集計で、都道府県・市区町村ごとのGPSポイント数を集計するための履歴テーブル。

`visited_admin_areas` は実績判定向けの「訪問済みかどうか」を保持し、こちらはGPSポイント単位の期間集計に使う。

| カラム | 型 | 説明 |
| --- | --- | --- |
| `id` | INTEGER | 主キー |
| `location_point_id` | INTEGER | 根拠GPSポイントID。`location_points(id)` を参照し、1GPSポイントにつき1行のみ保存する |
| `recorded_at` | TEXT | GPSポイントの記録時刻 |
| `local_date` | TEXT | GPSポイントのローカル日付 |
| `prefecture_name` | TEXT | 都道府県名 |
| `municipality_name` | TEXT NULL | 市区町村名。取得できない場合はNULL |
| `normalized_prefecture_name` | TEXT | 都道府県の重複判定用正規化名 |
| `normalized_municipality_name` | TEXT NULL | 市区町村の重複判定用正規化名 |
| `created_at` | TEXT | 作成日時 |

月次レポートの「よくいた都道府県」「一番よくいた市区町村」は、このテーブルの対象期間内GPSポイント数を集計して算出する。

### 4.11 `achievement_unlocks`

解除済み実績を保存するテーブル。

| カラム | 型 | 説明 |
| --- | --- | --- |
| `achievement_id` | TEXT | 実績定義ID。主キー |
| `unlocked_at` | TEXT | 解除日時 |
| `progress_value` | REAL NULL | 解除時点の進捗値 |
| `created_at` | TEXT | 作成日時 |

### 4.12 `achievement_notification_queue`

実績解除通知とフォアグラウンド演出を安全に扱うためのキュー。

| カラム | 型 | 説明 |
| --- | --- | --- |
| `id` | INTEGER | 主キー |
| `achievement_id` | TEXT | 通知対象の実績ID。同じ実績を重複キュー投入しないため `UNIQUE` 制約を付与する。再enqueue時は `INSERT OR IGNORE` で既存キューを優先し、エラーにせず無視する |
| `queued_at` | TEXT | キュー追加日時 |
| `delivered_push_at` | TEXT NULL | ローカル通知送信日時 |
| `shown_in_app_at` | TEXT NULL | アプリ内演出表示日時 |
| `created_at` | TEXT | 作成日時 |

## 5. インデックス方針

GPSログは時系列検索と日付検索が中心になるため、以下のインデックスを作成する。

- `location_points(recorded_at)`
- `location_points(local_date)`
- `location_points(local_date, recorded_at)`
- `location_points(recorded_at, latitude, longitude)` （GPXインポート時の既存データ優先を原子的に保証するためUNIQUE）
- `visited_admin_areas(area_type, normalized_name)`
- `location_point_admin_areas(local_date, normalized_prefecture_name)`
- `location_point_admin_areas(local_date, normalized_municipality_name)`
- `achievement_notification_queue(achievement_id)`
- `achievement_notification_queue(shown_in_app_at, queued_at)`
- `achievement_notification_queue(delivered_push_at)`
- `visited_cells(x, y)`
- `visited_cells(last_visited_at)`

from-to エクスポートでは `recorded_at` 範囲検索を使う。

日別表示では `local_date` と `recorded_at` を使う。

## 6. 日付とタイムゾーン

1日は端末のローカルタイムゾーンに基づく 0時〜24時 とする。

保存時には以下の2つを保持する。

- 絶対時刻としての `recorded_at`
- 日単位表示用の `local_date`

これにより、エクスポートや時系列処理では正確な時刻を使い、日別表示ではユーザーの体感に近い日付で扱える。

タイムゾーン変更時の再分類ルールは未決定とする。

## 7. マップ描画用データ

長期間の全履歴表示では、すべてのGPS点をそのまま描画すると重くなる可能性がある。

そのため、必要に応じて以下の派生データを生成する。

- 日単位の簡略化ルート
- ズームレベル別に間引いたルート
- 表示期間ごとの集約データ
- Visited Grid Overlay用の100m visited cell

保存前には raw GPS 観測を軽量な保存判定へ通し、`location_points` と日別距離へ反映する。

Visited Grid Overlayでは、GPS点が存在した100mセルを `visited_cells` へ保存する。低速時は点が存在したセルだけを開放し、150km/h以上の高速移動時のみvisited cell補完用に点間を補間する。

メインマップはPolylineではなくVisited Gridを主表示とするため、`location_points` 側ではprovisional確定待ちを行わない。水平方向精度が80mを超える点、5m未満の細かな揺れ、端末のraw speedが停止相当で20m未満に散る点を落とし、それ以外は速度帯に応じた最小距離を満たせば保存する。

保存判定では候補点自身の raw speed だけで速度帯を決めず、直前保存点との距離と時刻差から区間速度を計算する。保存判定と速度メーターで共有する速度帯は以下とする。

- low-speed: `30 km/h` 未満
- vehicle: `30 km/h` 以上 `150 km/h` 未満
- fast: `150 km/h` 以上

停止状態は端末のraw speedが停止相当かつ移動距離が小さい場合だけドリフトとして扱う。徒歩開始や低速移動の取りこぼしを避けるため、停止クラスタやprovisional点列による厳密な確定待ちは行わない。

`expo-location` の要求精度は `Location.Accuracy.High` とし、`distanceInterval` は5mに設定して停止中のコールバック頻度を抑える。

描画時は生データを直接Polylineへ渡さず、簡略化した描画用データを使う。

日別の推定移動距離は、表示のたびに全GPS点を走査して再計算しない。新しい点を保存するときに直前の同日ポイントとの距離を加算し、`daily_logs.distance_meters` に累積値として保持する。既存データなど累積距離が存在しない場合のみ、表示側でフォールバック計算する。

## 8. バックアップ方針

初期仕様ではクラウドバックアップは提供しない。

ユーザーがデータを取り出せる手段として、GPX / KML エクスポートを用意する。

将来的には以下を検討する。

- SQLiteデータベース全体のバックアップ
- アプリ内バックアップファイルのエクスポート
- iCloud Drive / Google Drive などユーザー管理ストレージへの保存

## 9. データ削除方針

設定画面の「すべてのデータを削除」は、記録データとそこから派生した状態を削除する。

削除対象は以下とする。

- `location_points`
- `location_point_admin_areas`
- `daily_logs`
- `visited_admin_areas`
- `achievement_unlocks`
- `achievement_notification_queue`

`location_point_admin_areas` はGPSポイントから派生する行政区域対応表のため、元データ削除時に合わせて削除する。

アプリ設定を保持する `app_settings` は、画面表示設定や開発フラグ確認状態などを含むため、初期実装では削除対象外とする。

## 10. プライバシー方針

GPSログは端末内に保存し、ユーザーの明示操作なしに外部サーバーへ送信しない。

外部送信が発生する可能性がある操作は、以下に限定する。

- ユーザーがGPX / KMLを共有した場合
- ユーザーがGPX / KMLをインポートした場合
- ユーザーが写真ジオタグ表示を有効化し、写真ライブラリのメタデータを読み取る場合
- 重大な例外やクラッシュの解析のため、Sentryへスタックトレース、アプリ/ビルド情報、OS/端末情報、画面名、RevenueCatのSupport ID、サブスク加入状況などの診断情報を送信する場合。ただしGPSログ本体、写真ジオタグ、座標値は送信しない
- 将来的にクラウド同期やバックアップを有効化した場合
- マップタイルや地図SDKの利用に伴い、地図プロバイダーへリクエストが発生する場合

マップ表示では地図プロバイダーへの通信が発生しうるため、仕様上明記し、必要に応じて設定画面やプライバシーポリシーで説明する。

## 11. 参考資料

- Expo SQLite: https://docs.expo.dev/versions/latest/sdk/sqlite/

## 12. 設定保存

アプリ設定は `app_settings` テーブルに保存する。

初期設定キーは以下とする。

| キー | 型 | 説明 |
| --- | --- | --- |
| `keepScreenAwake` | boolean | アプリがフォアグラウンドの場合に画面ロックを抑止するか |
| `appThemePreference` | string | 画面テーマ設定。`system` / `light` / `dark` のいずれか |
