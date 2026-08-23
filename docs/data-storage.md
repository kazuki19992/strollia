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

| カラム                  | 型           | 説明                                           |
| ----------------------- | ------------ | ---------------------------------------------- |
| `id`                    | INTEGER      | 主キー                                         |
| `recorded_at`           | TEXT         | 取得日時。ISO 8601形式                         |
| `local_date`            | TEXT         | 端末タイムゾーンに基づく日付。例: `2026-05-04` |
| `latitude`              | REAL         | 緯度                                           |
| `longitude`             | REAL         | 経度                                           |
| `effective_latitude`    | REAL NULL    | 記録時に決定した有効緯度。旧ログはNULL         |
| `effective_longitude`   | REAL NULL    | 記録時に決定した有効経度。旧ログはNULL         |
| `snapped_stay_place_id` | INTEGER NULL | 吸着した滞在場所ID。吸着なし・旧ログはNULL     |
| `altitude`              | REAL NULL    | 高度                                           |
| `speed`                 | REAL NULL    | 速度                                           |
| `heading`               | REAL NULL    | 方位                                           |
| `accuracy`              | REAL NULL    | 水平方向の位置精度                             |
| `altitude_accuracy`     | REAL NULL    | 高度の精度                                     |
| `source`                | TEXT         | 取得元。例: `expo-location`                    |
| `created_at`            | TEXT         | DB保存日時                                     |

### 4.2 `location_recording_state`

ライブ位置情報の滞在場所吸着状態を保持する単一行テーブル。IDは常に`1`とし、最初のライブ観測を処理するときに作成する。

| カラム                          | 型           | 説明                                                             |
| ------------------------------- | ------------ | ---------------------------------------------------------------- |
| `id`                            | INTEGER      | 主キー。常に`1`                                                  |
| `active_stay_place_id`          | INTEGER NULL | 現在吸着中の滞在場所ID。未吸着ならNULL                           |
| `candidate_stay_place_id`       | INTEGER NULL | 入場判定中の候補ID。候補なしならNULL                             |
| `candidate_count`               | INTEGER      | 同じ候補が50m以内に入った連続観測数                              |
| `outside_count`                 | INTEGER      | 吸着先から50m外になった連続観測数                                |
| `last_observed_at`              | TEXT NULL    | 状態へ反映済みの最新ライブ観測日時。初期状態ではNULL             |
| `last_visited_grid_recorded_at` | TEXT NULL    | 最後にVisited Gridへ反映した有効座標の観測日時。初期状態ではNULL |
| `last_visited_grid_latitude`    | REAL NULL    | 最後にVisited Gridへ反映した有効緯度。初期状態ではNULL           |
| `last_visited_grid_longitude`   | REAL NULL    | 最後にVisited Gridへ反映した有効経度。初期状態ではNULL           |
| `updated_at`                    | TEXT         | 状態行の最終更新日時                                             |

ライブ位置情報の吸着状態とVisited Grid補間起点はID=`1`の単一行へ保存する。GPS点が保存対象外でも連続観測数、最終観測日時、セル更新へ利用できた有効座標を更新するため、前景・背景の切替とJSプロセス再生成後も同じ状態を引き継ぐ。ただし、GPS一意制約に一致する重複観測は再配信だけで吸着の3点連続やVisited Gridを進めないよう、状態と補間起点を更新しない。最終観測日時が処理時刻より1時間を超えて未来の場合は端末時計の巻き戻りとして順序ガードを無効にし、次の正常観測で上書きする。補間起点の3列は既存GPS点から埋め戻さず、いずれかがNULL、または緯度・経度が不正な場合は補間起点なしとして現在観測のセルだけを処理する。滞在場所IDには外部キーを設定しない。

### 4.3 `daily_logs`

日単位の記録概要を保存するテーブル。

| カラム            | 型        | 説明                   |
| ----------------- | --------- | ---------------------- |
| `id`              | INTEGER   | 主キー                 |
| `local_date`      | TEXT      | 日付。例: `2026-05-04` |
| `started_at`      | TEXT NULL | その日の最初の記録時刻 |
| `ended_at`        | TEXT NULL | その日の最後の記録時刻 |
| `point_count`     | INTEGER   | 記録点数               |
| `distance_meters` | REAL NULL | 推定移動距離           |
| `created_at`      | TEXT      | 作成日時               |
| `updated_at`      | TEXT      | 更新日時               |

### 4.4 `recording_sessions`

記録開始から停止までのまとまりを保存するテーブル。

自動常時記録にする場合でも、アプリ起動、権限変更、バックグラウンドタスク再開などの境界をセッションとして扱えるようにする。

| カラム       | 型        | 説明                                    |
| ------------ | --------- | --------------------------------------- |
| `id`         | INTEGER   | 主キー                                  |
| `started_at` | TEXT      | セッション開始日時                      |
| `ended_at`   | TEXT NULL | セッション終了日時                      |
| `status`     | TEXT      | `active`, `stopped`, `interrupted` など |
| `reason`     | TEXT NULL | 終了理由または中断理由                  |
| `created_at` | TEXT      | 作成日時                                |
| `updated_at` | TEXT      | 更新日時                                |

### 4.5 `export_history`

GPX / KML エクスポート履歴を保存するテーブル。

| カラム        | 型      | 説明               |
| ------------- | ------- | ------------------ |
| `id`          | INTEGER | 主キー             |
| `format`      | TEXT    | `gpx` または `kml` |
| `range_from`  | TEXT    | 出力開始日時       |
| `range_to`    | TEXT    | 出力終了日時       |
| `file_name`   | TEXT    | 出力ファイル名     |
| `point_count` | INTEGER | 出力対象の記録点数 |
| `created_at`  | TEXT    | エクスポート日時   |

### 4.6 `visited_cells`

メインマップの Visited Grid Overlay 表示に使う訪問済みセルを保存するテーブル。

保存粒度は100mセルのみとし、表示時に200m、500m、1km、2km、5km、10km相当へ集約する。

| カラム             | 型      | 説明                                              |
| ------------------ | ------- | ------------------------------------------------- |
| `cell_id`          | TEXT    | 主キー。形式は `100:x:y`                          |
| `cell_size_meters` | INTEGER | 保存セルサイズ。当面は100                         |
| `x`                | INTEGER | Web Mercatorメートル座標をセルサイズで割ったX番号 |
| `y`                | INTEGER | Web Mercatorメートル座標をセルサイズで割ったY番号 |
| `first_visited_at` | TEXT    | 初回訪問日時                                      |
| `last_visited_at`  | TEXT    | 最終訪問日時                                      |
| `visit_count`      | INTEGER | 訪問回数                                          |
| `source`           | TEXT    | 取得元。例: `gps`                                 |
| `created_at`       | TEXT    | 作成日時                                          |
| `updated_at`       | TEXT    | 更新日時                                          |

### 4.7 `import_history`

GPX / KML インポート履歴を保存するテーブル。

初期実装ではGPXのみインポート対象とする。既存の `recorded_at`、`latitude`、`longitude` と一致する点がある場合は既存データを優先し、GPX側の点はスキップする。KMLインポートは後続対応とする。

| カラム                 | 型        | 説明                           |
| ---------------------- | --------- | ------------------------------ |
| `id`                   | INTEGER   | 主キー                         |
| `format`               | TEXT      | `gpx` または `kml`             |
| `file_name`            | TEXT      | 取り込み元ファイル名           |
| `range_from`           | TEXT NULL | 取り込みデータの開始日時       |
| `range_to`             | TEXT NULL | 取り込みデータの終了日時       |
| `imported_point_count` | INTEGER   | 取り込んだ記録点数             |
| `skipped_point_count`  | INTEGER   | 重複などでスキップした記録点数 |
| `created_at`           | TEXT      | インポート日時                 |

### 4.8 `photo_assets`

ジオタグ付き写真の表示に必要なメタデータを保存するテーブル。

写真本体はDBに保存しない。ジオタグがない写真も保存しない。

| カラム         | 型        | 説明                                             |
| -------------- | --------- | ------------------------------------------------ |
| `asset_id`     | TEXT      | 主キー。写真ライブラリ上のアセットID             |
| `latitude`     | REAL      | 緯度                                             |
| `longitude`    | REAL      | 経度                                             |
| `taken_at`     | TEXT NULL | 撮影日時。取得できないアセットがあるためNULL可   |
| `uri`          | TEXT      | 表示用URI（iOS: `ph://…` / Android: `file://…`） |
| `width`        | INTEGER   | 写真の横幅                                       |
| `height`       | INTEGER   | 写真の高さ                                       |
| `last_seen_at` | TEXT      | 最終確認日時                                     |
| `created_at`   | TEXT      | 作成日時                                         |
| `updated_at`   | TEXT      | 更新日時                                         |

保存は `asset_id` を主キーとしたUPSERTで行う。`created_at` は初回保存時の値を保ち、`updated_at` と `last_seen_at` は毎回更新する（`visited_cells` と同じ方針）。

**行の削除**: 保存と同じトランザクションで、走査済みの時間窓（今回の走査で確実に見た撮影日時の範囲）にある行を走査結果と突き合わせ、確認できなかった行を `DELETE` する。写真ライブラリから削除された写真やジオタグを失った写真の行が残ると、画像を読めず地図上に空のバブルが出るため。判定条件と端の扱いは `docs/photo-geotag.md` §9.3 を参照する。`getAssetInfoAsync` が reject したアセットは「存在するが判断できない」ものとして削除対象から外し、実在する写真の行を消さないようにしている。

**`local_uri` / `thumbnail_uri` は保存しない。** `getAssetInfoAsync` が返す `localUri` は
`requestContentEditingInput` の `fullSizeImageURL` に由来する一時パスで、アプリ再起動をまたいで有効である保証がない。代わりに `getAssetsAsync` が返す安定した `uri` を保存する。

> 表示時に `uri` 単独でサムネイルを描画できるかは実機未検証である。描画できない場合は、`local_uri` を「保存しないが表示直前に都度取得する値」として扱い、ビューポート検索の結果に対してのみ `getAssetInfoAsync` で解決する方式へ切り替える。切り替え箇所は `toMapPhotoFromPhotoAsset`（`src/features/photos/photoLibrary.ts`）1箇所に閉じている。

`taken_at` とそのインデックスは、GPSログとの時刻連動（`docs/photo-geotag.md` §7）に向けた準備工事である。後から実装するときにスキーマ変更と写真ライブラリの全件再走査が要らないよう、絞り込みに使う前から保存する。

### 4.9 `app_settings`

ユーザー設定を保存するテーブル。

| カラム       | 型   | 説明                       |
| ------------ | ---- | -------------------------- |
| `key`        | TEXT | 設定キー                   |
| `value`      | TEXT | JSON文字列などで保存する値 |
| `updated_at` | TEXT | 更新日時                   |

#### カスタム現在地アイコン

写真から選んだ現在地アイコンは、一時URIをそのまま保持せず、アプリの document 領域にある `strollia-custom-icons/` へコピーする。`app_settings.customIconImageUri` にはコンテナの絶対URIではなく、`managed:<ファイル名>` 形式の相対的な管理参照を保存し、起動時に現在の document URIへ解決する。

別の写真へ変更する場合は、新しいファイルのコピー、`customIconImageUri` と `userLocationIcon` の原子的な設定保存、以前の管理ファイル削除の順で行う。設定保存に失敗した場合は新しいファイルだけを削除し、以前の参照と表示を維持する。

旧バージョンが保存した読み込み可能な絶対URIは起動時に管理領域へ移行する。移行後の設定保存に失敗した場合は移行ファイルを削除し、そのセッションでは有効な旧URIを引き続き表示する。

起動時に旧URIまたは管理参照先ファイルの消失が確認できた場合は、`customIconImageUri` を空文字、`userLocationIcon` を `default` として原子的に保存し、画面と設定選択をOS標準へ戻す。旧URIの消失時はAlertで理由と画像の再設定が必要なことを案内する。ファイル存在確認APIの一時エラーや、存在する画像の描画時エラーでは設定を書き換えず、そのセッションの表示だけOS標準へフォールバックして次回起動時に再試行する。

旧URIを読み取れても管理領域へのコピーに失敗した場合は、部分ファイルを削除し、そのセッションでは旧URIを表示する。移行できていないためSQLiteの参照は書き換えない。

RevenueCatの初回確認が起動待機上限を超えた場合は、保存済みのPlus現在地アイコンだけを未確定期間中も表示する。これは保存選択が起動時に戻ったように見せないための表示継続であり、Plus利用資格の確認ではない。新規アイコン選択や他のPlus機能は開放しない。Plus無効が確定すれば直ちにOS標準表示へ切り替え、Plus有効が確定すれば保存アイコンを維持する。いずれの場合もこの表示判定だけで `app_settings` を書き換えない。

RevenueCatの設定・通信エラーはPlus無効の確定とは扱わない。エラー時はアイコン表示だけ未確定状態を維持し、CustomerInfoまたは購読更新でactive/inactiveを取得できた時点で確定状態へ切り替える。

### 4.10 `visited_admin_areas`

実績システムで都道府県・市区町村の訪問状態を判定するため、訪問済み行政区域を保存するテーブル。

| カラム                    | 型           | 説明                               |
| ------------------------- | ------------ | ---------------------------------- |
| `id`                      | INTEGER      | 主キー                             |
| `area_type`               | TEXT         | `prefecture` または `municipality` |
| `area_code`               | TEXT NULL    | 行政区域コード。初期はNULL許容     |
| `prefecture_name`         | TEXT         | 都道府県名                         |
| `municipality_name`       | TEXT NULL    | 市区町村名                         |
| `normalized_name`         | TEXT         | 重複判定用の正規化名               |
| `first_visited_at`        | TEXT         | 初回訪問時刻                       |
| `last_visited_at`         | TEXT         | 最終訪問時刻                       |
| `first_location_point_id` | INTEGER NULL | 初回訪問の根拠GPSポイントID        |
| `created_at`              | TEXT         | 作成日時                           |
| `updated_at`              | TEXT         | 更新日時                           |

### 4.11 `location_point_admin_areas`

月次レポートや将来の期間指定集計で、都道府県・市区町村ごとのGPSポイント数を集計するための履歴テーブル。

`visited_admin_areas` は実績判定向けの「訪問済みかどうか」を保持し、こちらはGPSポイント単位の期間集計に使う。

| カラム                         | 型        | 説明                                                                                 |
| ------------------------------ | --------- | ------------------------------------------------------------------------------------ |
| `id`                           | INTEGER   | 主キー                                                                               |
| `location_point_id`            | INTEGER   | 根拠GPSポイントID。`location_points(id)` を参照し、1GPSポイントにつき1行のみ保存する |
| `recorded_at`                  | TEXT      | GPSポイントの記録時刻                                                                |
| `local_date`                   | TEXT      | GPSポイントのローカル日付                                                            |
| `prefecture_name`              | TEXT      | 都道府県名                                                                           |
| `municipality_name`            | TEXT NULL | 市区町村名。取得できない場合はNULL                                                   |
| `normalized_prefecture_name`   | TEXT      | 都道府県の重複判定用正規化名                                                         |
| `normalized_municipality_name` | TEXT NULL | 市区町村の重複判定用正規化名                                                         |
| `created_at`                   | TEXT      | 作成日時                                                                             |

月次レポートの「よくいた都道府県」「一番よくいた市区町村」は、このテーブルの対象期間内GPSポイント数を集計して算出する。

### 4.12 `achievement_unlocks`

解除済み実績を保存するテーブル。

| カラム           | 型        | 説明               |
| ---------------- | --------- | ------------------ |
| `achievement_id` | TEXT      | 実績定義ID。主キー |
| `unlocked_at`    | TEXT      | 解除日時           |
| `progress_value` | REAL NULL | 解除時点の進捗値   |
| `created_at`     | TEXT      | 作成日時           |

### 4.13 `achievement_notification_queue`

実績解除通知とフォアグラウンド演出を安全に扱うためのキュー。

| カラム              | 型        | 説明                                                                                                                                                      |
| ------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                | INTEGER   | 主キー                                                                                                                                                    |
| `achievement_id`    | TEXT      | 通知対象の実績ID。同じ実績を重複キュー投入しないため `UNIQUE` 制約を付与する。再enqueue時は `INSERT OR IGNORE` で既存キューを優先し、エラーにせず無視する |
| `queued_at`         | TEXT      | キュー追加日時                                                                                                                                            |
| `delivered_push_at` | TEXT NULL | ローカル通知送信日時                                                                                                                                      |
| `shown_in_app_at`   | TEXT NULL | アプリ内演出表示日時                                                                                                                                      |
| `created_at`        | TEXT      | 作成日時                                                                                                                                                  |

### 4.14 `stay_places`

滞在場所ごとのGPS吸着と、共有時にルートを非表示にする範囲を保存するテーブル。契約状態による有効・無効は保存せず、作成日時順にアプリ側で判定する。

| カラム                  | 型           | 説明                                                                                                |
| ----------------------- | ------------ | --------------------------------------------------------------------------------------------------- |
| `id`                    | INTEGER      | 主キー                                                                                              |
| `name`                  | TEXT         | ユーザーが入力する表示名                                                                            |
| `icon_hexcode`          | TEXT         | 固定Twemojiカタログに含まれる、完全修飾済みの大文字Unicode hexcode                                  |
| `latitude`              | REAL         | 滞在場所の中心緯度                                                                                  |
| `longitude`             | REAL         | 滞在場所の中心経度                                                                                  |
| `privacy_radius_meters` | INTEGER NULL | `NULL`は共有時も含める。値は`100`、`200`、`500`、`1000`、`2000`、`3000`、`5000`、`10000`mのいずれか |
| `created_at`            | TEXT         | 作成日時（ISO 8601）                                                                                |
| `updated_at`            | TEXT         | 更新日時（ISO 8601）                                                                                |

滞在場所の有効・無効は保存しない。Plus有効時は全件、無料版または解約中は`created_at`、`id`の昇順で最初の1件だけを、GPS吸着と共有時の非表示範囲に使う。解約してもレコードを削除・変更せず、再契約時には保存済み全件を再び有効にする。

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
- `stay_places(created_at, id)` （滞在場所を作成順で安定して取得するため）
- `photo_assets(latitude, longitude)` （マップ表示範囲での絞り込みに使う）
- `photo_assets(taken_at)` （撮影期間での絞り込みに向けた準備）

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

Visited Grid Overlayでは、有効な観測が存在した100mセルを `visited_cells` へ保存する。低速時は現在観測のセルだけを開放し、150km/h以上の高速移動時のみ、`location_recording_state`に永続化した直前のセル開放対象点から点間を補間する。現在観測でセルを更新できた場合はGPS点の保存対象外でも有効座標を次の補間起点として保存し、セルを生成できなければ以前の起点を保持する。

メインマップはPolylineではなくVisited Gridを主表示とするため、`location_points` 側ではprovisional確定待ちを行わない。水平方向精度が80mを超える点、5m未満の細かな揺れ、端末のraw speedが停止相当で20m未満に散る点を落とし、それ以外は速度帯に応じた最小距離を満たせば保存する。

保存判定では候補点自身の raw speed だけで速度帯を決めず、直前保存点との距離と時刻差から区間速度を計算する。保存判定と速度メーターで共有する速度帯は以下とする。

- low-speed: `30 km/h` 未満
- vehicle: `30 km/h` 以上 `150 km/h` 未満
- fast: `150 km/h` 以上

停止状態は端末のraw speedが停止相当かつ移動距離が小さい場合だけドリフトとして扱う。徒歩開始や低速移動の取りこぼしを避けるため、停止クラスタやprovisional点列による厳密な確定待ちは行わない。

`expo-location` の要求精度は `Location.Accuracy.High` とする。iOSではバックグラウンドの継続更新を維持するためネイティブの `distanceInterval` を指定せず、Androidでは5mの距離フィルターを指定する。両OSでGPSポイントの保存判定は5mを基準に行う。

描画時は生データを直接Polylineへ渡さず、簡略化した描画用データを使う。

日別の推定移動距離は、表示のたびに全GPS点を走査して再計算しない。ライブ観測では時系列の前後点検索、GPS点挿入、Visited Grid、吸着状態、日別距離の差分加算を同じ排他トランザクションで確定する。GPS点は`(recorded_at, latitude, longitude)`の一意制約に一致する重複だけを既存データ優先で無視し、NOT NULLなど他のSQLite制約違反は例外としてトランザクションをロールバックする。距離、保存判定、Visited Gridには有効座標を使い、生座標は`location_points.latitude` / `longitude`へ維持する。保存対象外の観測でもVisited Gridと吸着状態は更新する。

同日の末尾へ保存する点は直前点との距離を加え、時系列途中へ保存する点は既存区間を置き換える差分だけを加算する。既存の`daily_logs.distance_meters`がNULLなら、新しい区間の部分差分で置き換えずNULLを維持し、表示側で全GPS点からフォールバック計算する。既存距離はマイグレーションで再計算・修復しない。

### 7.1 GPS点の段階的取得戦略

アプリは全期間のGPSポイントをメモリにロードしない。代わりに、用途に応じて以下の段階的取得関数を使う。

- `getLocationPointsBounds(): Promise<LocationPointsBounds | null>` — 地図の初期表示範囲を算出するため、SQLの集計クエリ(`SELECT MIN(latitude), MAX(latitude), MIN(longitude), MAX(longitude), COUNT(*) FROM location_points WHERE ...`)で緯度経度の最小値・最大値・ポイント総数を取得する。この方式ではポイント本体をアプリメモリへロードしないため、記録年数に依存せず高速に動作する。
- `getLocationPointsByMonth(yearMonth: string): Promise<LocationPoint[]>` — 月次レポート画面で対象月のポイントを取得する。月単位に限定することで、データ量を管理可能に保つ。
- `getLocationPointsByDates(localDates: string[]): Promise<LocationPoint[]>` — 日別ログの距離値が欠落している日の距離を計算するため、該当日付のみのポイントを取得する。フォールバック計算の対象を最小限に制限し、毎回全データ走査を避ける。

この設計により、2026-07-14に発生したメモリ超過クラッシュ(記録ポイント数が多い端末で全ポイント配列の作成時にスプレッド展開が`RangeError`を起こす問題)を回避する。

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
- `location_recording_state`
- `location_point_admin_areas`
- `daily_logs`
- `visited_admin_areas`
- `achievement_unlocks`
- `achievement_notification_queue`
- `stay_places`
- `photo_assets`

`location_point_admin_areas` はGPSポイントから派生する行政区域対応表のため、元データ削除時に合わせて削除する。

`photo_assets` は写真ライブラリから読み取ったメタデータのキャッシュだが、撮影位置は端末内に残る個人データであるため削除対象に含める。写真ライブラリ側の写真は削除しない。

アプリ設定を保持する `app_settings` は、画面表示設定や開発フラグ確認状態などを含むため、初期実装では削除対象外とする。

## 10. プライバシー方針

GPSログは端末内に保存し、ユーザーの明示操作なしに外部サーバーへ送信しない。

外部送信が発生する可能性がある操作は、以下に限定する。

- ユーザーがGPX / KMLを共有した場合
- ユーザーがGPX / KMLをインポートした場合
- ユーザーが写真ジオタグ表示を有効化し、写真ライブラリのメタデータを読み取る場合
- productionビルドで重大な例外やクラッシュの解析のため、Sentryへスタックトレース、アプリ/ビルド情報、OS/端末情報、画面名、RevenueCatのSupport ID、サブスク加入状況などの診断情報を送信する場合。developmentビルドとpreviewビルドではSentry送信を行わない。送信項目の詳細は `docs/architecture.md` のSentry送信項目に従い、GPSログ本体、写真ジオタグ、座標値は送信しない
- 将来的にクラウド同期やバックアップを有効化した場合
- マップタイルや地図SDKの利用に伴い、地図プロバイダーへリクエストが発生する場合

マップ表示では地図プロバイダーへの通信が発生しうるため、仕様上明記し、必要に応じて設定画面やプライバシーポリシーで説明する。

## 11. 参考資料

- Expo SQLite: https://docs.expo.dev/versions/latest/sdk/sqlite/

## 12. 設定保存

アプリ設定は `app_settings` テーブルに保存する。

初期設定キーは以下とする。

| キー                    | 型      | 説明                                                                       |
| ----------------------- | ------- | -------------------------------------------------------------------------- |
| `keepScreenAwake`       | boolean | アプリがフォアグラウンドの場合に画面ロックを抑止するか                     |
| `appThemePreference`    | string  | 画面テーマ設定。`system` / `light` / `dark` のいずれか                     |
| `crashReportingEnabled` | boolean | 不具合レポート(App Hang/クラッシュ)を開発者へ送信するか。デフォルト `true` |
