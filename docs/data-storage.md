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

### 4.5 `import_history`

GPX / KML インポート履歴を保存するテーブル。

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

### 4.6 `photo_assets`（任意機能）

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

### 4.7 `app_settings`

ユーザー設定を保存するテーブル。

| カラム | 型 | 説明 |
| --- | --- | --- |
| `key` | TEXT | 設定キー |
| `value` | TEXT | JSON文字列などで保存する値 |
| `updated_at` | TEXT | 更新日時 |

## 5. インデックス方針

GPSログは時系列検索と日付検索が中心になるため、以下のインデックスを作成する。

- `location_points(recorded_at)`
- `location_points(local_date)`
- `location_points(local_date, recorded_at)`

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

保存時はGPSの生データをそのまま入れるのではなく、明らかに精度が低い点と、前回保存点からの移動が小さい点を破棄する。初期閾値は以下とする。

- 水平方向の位置精度が50mを超える点は保存しない
- 前回保存点から5m未満の点は保存しない
- `expo-location` の `distanceInterval` も5mに設定し、停止中のコールバック頻度を抑える

描画時は生データを直接Polylineへ渡さず、簡略化した描画用データを使う。

日別の推定移動距離は、表示のたびに全GPS点を走査して再計算しない。新しい点を保存するときに直前の同日ポイントとの距離を加算し、`daily_logs.distance_meters` に累積値として保持する。既存データなど累積距離が存在しない場合のみ、表示側でフォールバック計算する。

## 8. バックアップ方針

初期仕様ではクラウドバックアップは提供しない。

ユーザーがデータを取り出せる手段として、GPX / KML エクスポートを用意する。

将来的には以下を検討する。

- SQLiteデータベース全体のバックアップ
- アプリ内バックアップファイルのエクスポート
- iCloud Drive / Google Drive などユーザー管理ストレージへの保存

## 9. プライバシー方針

GPSログは端末内に保存し、ユーザーの明示操作なしに外部サーバーへ送信しない。

外部送信が発生する可能性がある操作は、以下に限定する。

- ユーザーがGPX / KMLを共有した場合
- ユーザーがGPX / KMLをインポートした場合
- ユーザーが写真ジオタグ表示を有効化し、写真ライブラリのメタデータを読み取る場合
- 将来的にクラウド同期やバックアップを有効化した場合
- マップタイルや地図SDKの利用に伴い、地図プロバイダーへリクエストが発生する場合

マップ表示では地図プロバイダーへの通信が発生しうるため、仕様上明記し、必要に応じて設定画面やプライバシーポリシーで説明する。

## 10. 参考資料

- Expo SQLite: https://docs.expo.dev/versions/latest/sdk/sqlite/

## 11. 設定保存

アプリ設定は `app_settings` テーブルに保存する。

初期設定キーは以下とする。

| キー | 型 | 説明 |
| --- | --- | --- |
| `keepScreenAwake` | boolean | アプリがフォアグラウンドの場合に画面ロックを抑止するか |
