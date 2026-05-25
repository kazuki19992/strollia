# Visited Grid Overlay デザイン

## 目的

Strollia のメインマップ表示を、Polyline中心の「線を正確につなぐ」表現から、Visited Grid中心の「行った場所を積み上げる」表現へ段階的に移行する。

現在の Polyline 方式では、GPSジャンプ、ドリフト、マルチパス、ロスト復帰のたびに点Aと点Bを直線で結ぶ必要がある。その結果、実際には通っていない場所に線が引かれるリスクを避けるために保存品質判定が厳しくなり、徒歩開始時に accepted line が伸びない問題が起きやすい。

Visited Grid 方式では、GPS点が存在したセルを visited として記録し、地図上の Fog マスクをセル単位で開放する。目的は道路線形を精密に再現することではなく、ユーザーが訪問済みエリアを増やしていく感覚を得られるようにすることである。

## 次PRのスコープ

次PRでは、メインマップに Visited Grid Overlay を導入するための最小実装を対象にする。

含めるもの:

- 100mセルを基本単位とする visited cell 生成
- `visited_cells` SQLiteテーブル追加
- GPS受信時の visited cell upsert
- 表示範囲とズームに応じた visited cell 取得
- 100mセルから200m、500m、1km、2km、5km、10km相当セルへの表示時集約
- セルサイズ集約による描画数削減
- セル同士の内側罫線を出さない表示
- メインマップ上の Grid Overlay 表示
- メインマップ上の Polyline 非表示
- zoom連動 Fog opacity
- Fog opacity 設定値の定数化
- visited cell 色の設定化
- UI速度表示をGPS raw speedベースへ分離
- 設定画面からルート線の見た目設定を削除

次PRでは含めないもの:

- Polylineデータの削除
- GPX/KML export の変更
- 日別ログ、月次レポート、共有画像のGrid化
- RevenueCat/課金連携
- 既存GPS点全量からの visited cell バックフィル
- 高度な map matching

Polyline は内部データとして保持し、GPX/KML export、将来Replay、デバッグ、既存の日別・月次表示で引き続き使う。メインマップでは Grid Overlay を主役にし、Polyline は描画しない。

## 表示モデル

メインマップでは、地図全体に半透明 Fog Overlay を重ね、visited cell に該当する領域を開放済みとして表現する。

React Native Maps では「マスクから穴を抜く」描画が難しいため、初期実装では以下の表現を採用する。

- unvisited 感を出すため、MapView上に `Polygon` または `View` 相当の半透明矩形を重ねる
- visited cell は半透明の明るいセル、または Fog 色を薄くしたセルとして上書き表示する
- 完全な穴抜き表現は後続PRで検討する

この段階では「訪問済みエリアが開いていく感覚」を優先し、Fogの完全なマスク表現よりも、Expo/React Native Maps上で安定して動く構成を優先する。

## Grid仕様

### 基本セル

保存するセルは100mセルのみとする。

セルIDは緯度経度を Web Mercator 系のメートル座標へ変換し、100m単位で整数グリッド化して作る。

例:

- `x = floor(mercatorX / 100)`
- `y = floor(mercatorY / 100)`
- `cellId = "100:{x}:{y}"`

緯度経度を単純な度数で丸めると緯度によってセルサイズが変わるため、保存IDはメートル座標基準にする。

### 表示時集約

ズームアウト時は、保存済みの100mセルを表示専用の大セルへ集約する。

表示セルサイズ候補:

- 100m
- 200m
- 500m
- 1km
- 2km
- 5km
- 10km

集約ルール:

- 200mセルは100mセル2x2
- 500mセルは100mセル5x5
- 1kmセルは100mセル10x10
- 2kmセルは100mセル20x20
- 5kmセルは100mセル50x50
- 10kmセルは100mセル100x100
- 内部に visited な100mセルが1つでもあれば、大セル全体を visited として扱う

coverage ratio は計算しない。計算量を抑え、広域表示で軽く見せるためである。

表示セルサイズの切り替えは、100mセルを通常利用の見やすい範囲で長めに維持する。初期値として、100mは `latitudeDelta < 0.06`、200mは `< 0.15`、500mは `< 0.35`、1kmは `< 0.8`、2kmは `< 2`、5kmは `< 4`、それ以上は10kmを使う。

### 表示セルの描画単位

表示セルは1セル1Polygonとして描く。隣接セルを矩形単位へまとめる方式は、ズーム・パン・再取得時に表示IDやフェード単位が変わりやすく、描画が不安定になる可能性があるため採用しない。

方針:

- 表示セルIDをそのままPolygon keyとフェードIDに使う
- 内側罫線は描画せず、セルの塗りだけを表示する
- 広域表示ではセルサイズ自体を大きくしてPolygon数を抑える

これにより、描画とフェードの単位を単純化し、再取得時の二重表示やちらつきを抑える。

## Fog opacity

Fog opacity はズーム率に応じてリニア補間する。

方針:

- 通常表示時は地図を読みやすくするため薄い Fog にする
- 広域表示時は探索感を強めるため濃い Fog にする
- 値はハードコードせず、設定ファイルに集約する

設定候補:

```ts
export const GRID_OVERLAY_CONFIG = {
  baseCellSizeMeters: 100,
  displayCellSizesMeters: [100, 200, 500, 1000, 2000, 5000, 10000],
  minimumFogOpacity: 0.2,
  maximumFogOpacity: 0.6,
  opacityStartLatitudeDelta: 0.01,
  opacityEndLatitudeDelta: 0.2,
  visitedCellColorOverride: null,
};
```

計算:

- `latitudeDelta <= opacityStartLatitudeDelta` なら `minimumFogOpacity`
- `latitudeDelta >= opacityEndLatitudeDelta` なら `maximumFogOpacity`
- その間は linear interpolation

`latitudeDelta` は React Native Maps の `Region` から取得できるため、既存の `visibleRegion` と相性がよい。

## GPS点からのセル開放

### 低速移動

徒歩、自転車、一般低速移動では、GPS点が存在した100mセルのみを visited として保存する。点間補間はしない。

理由:

- 建物貫通
- 川横断
- 一本道ショートカット
- GPSジャンプによる誤開放

を避けるため。

低速時は「補間漏れ」より「実際に行っていない場所を開く」方がUXダメージが大きい。

### 高速移動

150km/h以上の高速移動モードでは、点A〜点B間を補間し、通過セルを visited として保存する。

ただし、補間は visited cell 補完専用であり、Polyline描画には使わない。

高速補間の条件:

- 前回保存対象点と今回GPS点の推定速度が150km/h以上
- 両点のaccuracyが許容範囲内
- 時間差が長すぎない

距離が大きいだけでは補間しない。GPSロスト復帰や都市部ジャンプで大量セルを誤開放するリスクが高いためである。

## 停止ドリフト対策

停止判定、移動開始判定、セル開放判定を分離する。

セル開放では、現在の accepted/provisional 判定に強く依存しすぎない。ただし、停止中ドリフトで周辺セルが大量開放されるのは避ける。

初期方針:

- accuracy が悪い点はセル開放しない
- 直近点が狭い範囲に留まる場合は停止クラスタとして扱う
- 停止クラスタ内のセルは最初の1セル程度は開放してよい
- 停止クラスタ外へ一定距離抜けたら徒歩開始としてセル開放を再開する

この設計により、Polyline continuity を守るために徒歩開始を潰す必要を減らす。

## SQLite設計

新規テーブル `visited_cells` を追加する。

```sql
CREATE TABLE IF NOT EXISTS visited_cells (
  cell_id TEXT PRIMARY KEY,
  cell_size_meters INTEGER NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  first_visited_at TEXT NOT NULL,
  last_visited_at TEXT NOT NULL,
  visit_count INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'gps',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_visited_cells_xy
  ON visited_cells(x, y);

CREATE INDEX IF NOT EXISTS idx_visited_cells_last_visited_at
  ON visited_cells(last_visited_at);
```

保存する `cell_size_meters` は当面100のみとする。将来、別粒度保存が必要になった場合に備えて列として保持する。

upsert方針:

- 初回訪問時は `first_visited_at` と `last_visited_at` を同じ時刻で作成
- 再訪問時は `last_visited_at` を更新
- `visit_count` を加算

## モジュール構成

### `src/features/location/grid/`

Gridの純粋関数を置く。

- `gridCell.ts`
  - lat/lng -> 100m cell
  - cell -> polygon coordinates
  - cellId生成
- `gridAggregation.ts`
  - 100mセル -> 表示セル集約
  - regionから表示セルサイズ選択
- `gridInterpolation.ts`
  - 高速移動時の補間セル生成
  - 低速時は補間しないことを明示

### `src/features/location/visitedCellRepository.ts`

SQLiteへの保存・取得を担当する。

- `upsertVisitedCells(cells, visitedAt)`
- `getVisitedCellsInBounds(bounds)`
- `deleteAllVisitedCells()`

### `src/features/map/gridOverlay.ts`

MapView表示用のデータ整形を担当する。

- visible region -> bounds
- visited cells -> polygon props
- zoom -> fog opacity

### `src/features/map/config/gridOverlayConfig.ts`

Grid/Fog設定を集約する。

- 基本セルサイズ
- 表示セルサイズ候補
- opacity最小/最大
- opacity変化開始/終了zoom相当値
- Fog色
- visitedセル色

## UI速度表示

速度メーター用の速度は、ログ保存品質判定済み点からの推定速度ではなく、GPSが返す raw speed を優先して使う。

目的:

- 徒歩開始直後に反応する
- 加減速が見える
- provisional中やaccepted更新停止中でもメーターが凍らない

方針:

- `onUserLocationChange` またはGPS受信時に `coords.speed` を保持する
- `coords.speed` は m/s なので km/h へ変換する
- `speed` が `null`、負値、不正値の場合は直近の表示速度を短時間だけ保持し、それもなければ0にする
- 保存用速度、品質判定用速度、UI表示用速度を分離する

raw speed は瞬間値として揺れる可能性があるため、必要なら後続PRで軽い平滑化を追加する。次PRではまず即応性を優先する。

## 既存Polylineとの関係

Polylineは削除しない。

残す用途:

- GPX export
- KML export
- 日別ログ
- 月次レポート
- 将来Replay
- デバッグ

メインマップでは Grid Overlay を主表示にし、`visibleRouteSegments` からの Polyline は描画しない。ルート線の見た目設定もユーザー設定画面から削除する。Polylineに必要な座標データは、エクスポートや日別ログなどの内部用途として保持する。

## テスト方針

純粋関数とrepositoryを中心にテストする。

必須テスト:

- 緯度経度から安定した100m cellIdを生成できる
- 同じ100mセル内の点が同じcellIdになる
- 200m/500m/1km/2km/5km/10kmへの集約で、1つでもvisitedな100mセルがあれば大セルがvisitedになる
- 隣接する表示セルを矩形へマージせず、それぞれ安定したcellIdで描画できる
- Grid Overlayの内側罫線を描画しない
- visited cell色をテーマのprimaryまたは設定値から解決できる
- zoomに応じて表示セルサイズを選べる
- Fog opacityが設定値に基づいて線形補間される
- 低速移動では点間補間しない
- 150km/h以上の高速移動だけ補間セルを生成する
- 距離だけが大きくても高速条件を満たさなければ補間しない
- `visited_cells` upsertで `first_visited_at` を保持し、`last_visited_at` と `visit_count` を更新する
- UI速度表示が accepted 点ではなく raw GPS speed で更新される

## 段階的実装順

1. Grid設定と純粋関数
2. `visited_cells` DBテーブルとrepository
3. GPS受信時のvisited cell保存
4. visible regionに応じたvisited cell取得
5. Grid Overlay描画
6. UI速度表示のraw speed分離
7. ルート線の見た目設定削除
8. ドキュメント更新と検証

この順序にすると、各段階でテスト可能な状態を保ちやすい。

## リスクと保留事項

- React Native Maps上で大量Polygonを描くと重くなる可能性がある
- 完全なFog穴抜き表現は初期PRでは実現しない
- 過去ログのvisited cellバックフィルをしない場合、導入直後は新規移動分だけがGrid表示される
- 低速時に補間しないため、点取得間隔が粗いと訪問済みセルに隙間が出る
- 高速補間は安全側に倒すため、GPSロストが長い区間は補完しない

これらは、Grid方式のUXを実機確認したあとに後続PRで調整する。
