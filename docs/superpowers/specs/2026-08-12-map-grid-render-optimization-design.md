# メイン地図 Visited Grid 描画軽量化 設計書

作成日: 2026-08-12
改訂日: 2026-08-12(Codexレビュー反映。改訂内容は §10)
対象: GitHub issue [#138 地図表示軽量化](https://github.com/kazuki19992/strollia/issues/138)

## 1. 背景と現象

メイン地図は全履歴 Polyline ではなく Visited Grid Overlay を主表示にしている。GPS点が存在した100mセルを `visited_cells` に保存し、`MapView` 上でセルごとに `Polygon` として描画する。

訪問済みセルが密に埋まった地域を100m表示でスクロールすると、次の負荷が重なって動作が重くなる。

100m四方の表示はプロダクト上の意味を持つため、「重いから自動的に200m/500mへ粗く塗る」方向の解決は採らない。

## 2. 現状コードの調査結果

### 2.1 スクロール中のDB取得・再描画(Android)

`src/ui/components/MapScreen.tsx:191`

```typescript
onRegionChange={Platform.OS === 'android' ? onRegionChange : undefined}
```

`onRegionChange` は Android のみ配線されている。iOS は既に `onRegionChangeComplete` だけで動くため、**この問題は実質 Android 限定**。

`src/ui/hooks/useMapFollowState.ts:305-314` で `onRegionChange` は150msスロットル付きで `visibleRegion` を更新する。`AppStateProvider.tsx:557` の `gridOverlayRegion = visibleRegion ?? initialRegion` を経由して `useVisitedGridOverlay` の取得 effect が走る。

`useVisitedGridOverlay.ts:141-150` に「取得済み範囲に収まるなら再取得しない」ガードはあるが、**パンで範囲外へ出た瞬間に毎回 SQLite 取得 → 集約 → Polygon props 更新**が走る。指を動かしている最中にこれが連続する。

`visibleRegion` は Grid 以外に `usePhotoClusters`(クラスタ半径)も参照しているため、単純に凍結はできない。

### 2.2 フェードが「新しく表示されたセル」全体に効く

`useVisitedGridOverlay.ts:82-99` の `syncVisitedGridFadeState` は、**取得結果に現れたすべてのセル**に初回描画時刻を記録する。スクロール先に大量の既存セルが現れると、それらがすべて0.5秒フェード対象になる。

フェード中は `visitedGridFadeFrame` が50ms間隔で増え、`visitedGridCells` の `useMemo`(195-204行)が丸ごと再計算される。この memo は `toVisitedGridOverlayCells` を通して**全セルの Web Mercator → 緯度経度変換**をやり直すため、密集地域では50msごとに数百〜数千セルぶんの三角関数計算が走る。

### 2.3 1セル1Polygon

`MapScreen.tsx:194-206` はセル1つにつき `<Polygon>` 1要素。React要素数・ネイティブoverlay数・props転送量が visited cell 数に線形で比例する。

### 2.4 200m以上でも100mセルを全件JSへ渡している

`visitedCellRepository.ts:100-112` の `getVisitedCellsInBounds` は常に100mセル行を返し、`gridAggregation.ts:93` の `aggregateVisitedCells` が JS 側で表示セルへ畳んでいる。広域表示ほど無駄が大きい。

## 3. 設計方針

### 3.1 Grid取得用 region を地図カメラ用 region から分離する

`useMapFollowState` に `gridSyncRegion` を追加し、更新規則を分ける。

| 契機                                               | `visibleRegion` | `gridSyncRegion`                                                     |
| -------------------------------------------------- | --------------- | -------------------------------------------------------------------- |
| `onPanDrag`(ユーザー操作)                          | 変更なし        | 変更なし(抑止フラグを立て、アイドルタイマーを張り直す)               |
| `onRegionChange`(操作中・Androidのみ)              | 更新する        | **抑止フラグが立っている間は更新しない**(アイドルタイマーを張り直す) |
| `onRegionChangeComplete`(操作完了)                 | 更新する        | 更新する(フラグを下ろし、タイマーを解除)                             |
| `centerOnCoordinate`(追従・現在地ボタン・地図復帰) | 更新する        | 更新する(フラグを下ろし、タイマーを解除)                             |
| `prepareMapRegionRestore`(地図復帰)                | 更新する        | 更新する                                                             |
| アイドルタイマー発火                               | 変更なし        | 直近 region へ同期する(フラグを下ろす)                               |

**ユーザー操作かどうかは `onPanDrag` で立てるフラグだけで判定する。** `onRegionChangeComplete` の発火有無から推測しない。理由は、プログラム移動(`animateToRegion`)でも `onRegionChangeComplete` は発火するため、それを根拠にするとプログラム移動が誤ってユーザー操作扱いになるから。

#### イベント欠落へのフォールバック

`onRegionChangeComplete` が届かないと Grid が固まったままになるため、アイドルタイマーを用意する。

- `onPanDrag` と `onRegionChange` のたびにタイマーを**張り直す**(1000ms)
- `onRegionChangeComplete` / `centerOnCoordinate` で解除する
- 発火したら抑止フラグを下ろし、直近に受け取った region へ `gridSyncRegion` を同期する

**張り直す設計にする理由**: 固定タイムアウトだと長いドラッグの最中に発火し、抑止したかったジェスチャー中の更新が復活する。「最後のイベントから1000ms 何も来ていない = 操作が止まっている」という判定にすることで、動いている間は絶対に発火しない。

**1000ms にする理由**: iOS はドラッグ後の慣性スクロール中にイベントが来ないため、短すぎると慣性の途中で古い region へ同期してしまう。1000ms なら通常の慣性は先に収束し、`onRegionChangeComplete` が正常に届く。届かなかった場合だけフォールバックが働く。なお iOS は `onRegionChange` 未配線のため直近 region は操作前の値になるが、その場合の同期は実質no-opで無害。

`AppStateProvider` の `gridOverlayRegion` を `gridSyncRegion ?? initialRegion` へ差し替える。`visibleRegion` は既存のまま `usePhotoClusters` などへ渡す。

**トレードオフ**: Android でパン中、新しく現れた領域の Overlay は指を離すまで描かれない。`boundsPaddingRatio: 0.5`(表示範囲の外側50%を先読み)があるため、短いパンでは目に見える欠けは起きない見込み。長いパンでは指を離した時点で追いつく。この挙動は issue の受け入れ条件そのものなので許容する。

### 3.2 fresh cell / stable cell の区別

**fresh cell** = GPS記録で新しく開いたセル。フェード対象かつ Polygon 結合の対象外。
**stable cell** = それ以外の既存セル。フェードせず即時表示し、結合の対象。

#### 保持形式: 100mセルIDを正規形にする

fresh 集合は**表示セルIDではなく100m基本セルID(`100:x:y`)で保持する**。表示セルサイズが変わってもIDの意味が変わらないため、ズーム操作だけで fresh が失われない。

stable 化の条件は「**画面外に出たとき**」だけ。ズーム変更・再取得・時間経過では stable 化しない。

#### 判定方法(検討と決定)

GPS記録は `locationRecordingSession`(前景ウォッチ + バックグラウンドタスク)側で行われ、UI フックは定期 `refreshData` の再取得で結果を知る。つまり**記録側からUIへ「今このセルを開いた」と通知する経路がない**。

検討した案:

| 案                                 | 内容                                                                            | 判断                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| A. 記録側からイベント通知          | `locationRecordingSession` から fresh cellId を publish                         | バックグラウンドタスクはJSコンテキストが別で、UIへの安定した通知経路がない。却下 |
| B. `firstVisitedAt` の新しさで判定 | 直近N秒以内に初訪問したセルを fresh とする                                      | issue が明示的に否定している「時間経過だけでstable化する方式」に該当。却下       |
| C. 前回取得結果との差分            | **前回取得済み範囲に完全に含まれるのに、前回は返らなかったセル**を fresh とする | 採用                                                                             |

案Cは、範囲が変わっていないのに増えたセル = DB側でデータが増えた、という事実だけを根拠にする。前回範囲の外側にあるセルは「スクロールで入ってきた既存セル」の可能性があるため fresh にしない。**判定が曖昧なときはフェードしない側へ倒す**(誤って大量フェードするより、フェードし損ねる方が害が小さい)。

**fresh の検出は、前回取得も今回取得も100m表示だった場合だけ行う。** 理由は2つある。

1. 200m以上の表示では取得結果が集約済みで、どの100mセルが開いたのか特定できない
2. 前回が集約表示だと前回IDは `200:x:y`、今回は `100:x:y` になるため、素朴に差分を取ると**範囲内の既存セルがすべて「前回なかったセル」に見える**。集約表示から100m表示へズームインしただけで大量のセルが fresh 判定され、フェードと結合除外が同時に走って今回避けたい負荷が戻ってしまう

前回表示セルサイズが100mでない場合は検出をスキップし、今回の100mセル集合を次回検出の baseline として記録するだけにする。広域表示中も fresh の追加は行わない(既存の fresh は保持する)。

#### stable 化(画面外判定)は DB 取得とは独立に行う

DB取得範囲には `boundsPaddingRatio: 0.5` の先読み余白が乗る。取得結果を根拠に「画面外に出た」を判定すると、実際には画面外へ出たセルが余白の中に残り続けて fresh のままになる。さらに `coveredByLastFetch` の早期returnで、取得を省略した region 変更では fresh 状態が一切更新されない。

そこで2つを分離する。

| 用途               | 使う範囲                           |
| ------------------ | ---------------------------------- |
| SQLite 取得        | `boundsPaddingRatio: 0.5` **あり** |
| fresh の画面外判定 | 余白**なし**の実表示範囲           |

画面外判定は Grid 用 region が変わるたびに実行する(DB取得を省略した場合も実行する)。判定はセル番号の比較だけなのでコストは無視できる。

#### フェード対象と結合除外を分ける

大量セルが一度に fresh 判定された場合に止めたいのは**フェードの50ms再計算**であって、結合除外ではない。この2つを別集合として持つ。

| 集合                | 役割                       | 上限                                                |
| ------------------- | -------------------------- | --------------------------------------------------- |
| `freshBaseCellIds`  | Polygon 結合の対象から外す | なし(画面外へ出るまで維持)                          |
| `fadingBaseCellIds` | 0.5秒フェードを適用する    | 1回の検出で64件を超えたらそのバッチはフェードしない |

上限を超えたセルはフェードせず即時表示になるが、fresh のままなので結合はされない。結合されないセルが一時的に増えても、変更前(全セルが個別 Polygon)より悪くなることはない。

#### 状態遷移まとめ

- 100m表示で新しく現れ、前回取得範囲に完全に含まれるセル → fresh に追加
- fresh セルは実表示範囲(余白なし)から外れた時点で fresh から落ちる → 再表示時は stable
- 表示セルサイズの変更では fresh を落とさない
- 1回の検出で64件超 → そのバッチはフェードしない(fresh 自体は維持)

### 3.3 stable cell の正方形Polygon結合

完全に埋まった正方形ブロックだけを1つの大きい Polygon へまとめる。**ブロック内の表示セルがすべて visited のときだけ**結合するので、未訪問セルを塗らず100m四方の表示意味は保たれる。

- **適用は全ズーム段階**(下記「適用範囲」参照)
- 対象倍率は `4x4` → `2x2` → 単体 の順。`8x8` 以上と任意長方形は対象外(issue の指定どおり)
- **グリッド整列ブロックのみを対象にする**。原点は `Math.floor(x / blockSize) * blockSize`
  - 整列に限定する理由: (1) 同一倍率の整列ブロックは必ず互いに素なので貪欲でも結果が一意に決まる (2) スクロールしてもブロック境界が動かないため React key が安定する (3) 探索が O(n) で済む
  - 代償: 非整列で完全に埋まっている領域は結合されない。削減率は落ちるが表示は正しい
- 結合後セルは `cellSizeMeters = 元の表示セルサイズ × 倍率`、`x = 原点X / 倍率`、`cellId = ${結合後サイズ}:${x}:${y}` とする。既存の `cellToPolygonCoordinates`(`gridCell.ts:121`)がこの形をそのまま矩形へ変換できるため、描画側の変更は不要
- メタデータは `firstVisitedAt = MIN`、`lastVisitedAt = MAX`、`visitCount = SUM`

#### 適用範囲: 全ズーム段階

`coalesceVisitedGridCells` は表示セルサイズに依存しない汎用関数として実装し、100m表示にも集約表示にも同じロジックを適用する。

| 表示セルサイズ | fresh の扱い                                                                                               | 結合の例                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 100m           | `freshCellIds` を渡して fresh を結合対象から外す                                                           | `2x2` → `200:x:y` / `4x4` → `400:x:y`                                           |
| 200m以上       | **空集合**を渡す。fresh 検出・fresh フェード・fresh による結合除外を行わず、全表示セルを stable として扱う | 200mの `2x2` → `400:x:y` / 200mの `4x4` → `800:x:y` / 500mの `2x2` → `1000:x:y` |

**200m以上で fresh を考慮しない根拠**: 集約表示ではすでに「表示セル内に visited な100mセルが1つでもあれば表示セル全体を塗る」仕様になっている。つまり表示セルは「その範囲に訪問がある」ことだけを表しており、完全に揃った `2x2` / `4x4` をまとめても**塗り範囲は1ピクセルも変わらない**。fresh はもともと「今開いた100mセルを個別に見せる」ための概念で、100mセルが個別に見えない集約表示では意味を持たない。

未訪問の表示セルを含むブロックを結合しない条件は、100m表示と同じく全ズーム段階で維持する。

なお fresh 集合そのものは200m以上でも保持し続け(画面外判定による stable 化は継続する)、100m表示へ戻ったときに従来どおり機能する。

### 3.4 描画メモ化の分割

現状は全セルを1つの `useMemo` で作り直しているため、フェード1フレームごとに全セルの座標変換が走る。これを分ける。

```text
coalescedVisitedGrid  (deps: 取得結果, fresh集合)        → stableCells / freshCells
  ├ stableOverlayCells (deps: stable, opacity, color)      … フェードに依存しない
  └ freshOverlayCells  (deps: fresh, opacity, color, frame) … フェードごとに再計算
visitedGridCells = [...stableOverlayCells, ...freshOverlayCells]
```

stable 側はフェード中も同じ配列・同じオブジェクトを使い回すため、Polygon の props 値が変化せずネイティブへの更新が飛ばない。フェード中に再計算されるのは fresh cell(通常数個)だけになる。

### 3.5 200m以上のSQLite側集約

`getVisitedCellsInBounds(bounds, displayCellSizeMeters)` とし、表示セルサイズが100mより大きい場合は SQL 側で `GROUP BY` する。

```sql
SELECT
  (x - ((x % ?) + ?) % ?) / ? as blockX,
  (y - ((y % ?) + ?) % ?) / ? as blockY,
  MIN(first_visited_at) as firstVisitedAt,
  MAX(last_visited_at)  as lastVisitedAt,
  SUM(visit_count)      as visitCount
FROM visited_cells
WHERE x BETWEEN ? AND ? AND y BETWEEN ? AND ?
GROUP BY blockX, blockY
```

**注意点**: SQLite の `/` と `%` は0方向への切り捨てで、`Math.floor` と負値で結果がずれる。Web Mercator のセル番号は西半球・南半球で負になるため、`(x - ((x % r) + r) % r) / r` の形で真の floor 除算にする。`floor()` 組み込み関数は SQLite のビルドオプション(`SQLITE_ENABLE_MATH_FUNCTIONS`)依存なので使わない。

これに伴い `aggregateVisitedCells`(`gridAggregation.ts`)は呼び出し元がなくなるため削除する。表示セルサイズ選択(`getDisplayCellSizeMeters` / `getStableDisplayCellSizeMeters`)は残す。

### 3.6 効果測定(開発時限定)

開発フラグ `EXPO_PUBLIC_LOG_VISITED_GRID_METRICS` 配下でのみ1行ログを出す。

出力する値: `rawCellCount` / `stableCellCount` / `freshCellCount` / `renderPolygonCount` / `coalescedBlockCountBySize` / `polygonReductionRatio` / `fetchMs` / `aggregationMs` / `overlayBuildMs`。

**GPS座標・cellId・移動履歴は出力しない。** 件数・処理時間・削減率のみ。本番ユーザーには一切出力しない。

**計測は最適化前の現行経路へ先に接続する。** ログ関数を作るだけでは改善前の数字が取れず、前後比較ができない。実装順の最初のタスクで現行の `useVisitedGridOverlay` へ計測を差し込み、基準値を取ってから最適化に入る(§9)。

## 4. ユーザー体験への影響

| 項目                               | 変更前                    | 変更後                                         |
| ---------------------------------- | ------------------------- | ---------------------------------------------- |
| Android のパン中の Overlay 更新    | 150ms ごとに追従          | 指を離すまで据え置き、離した時点で追従         |
| アプリ起動直後の初回描画           | 全セルが0.5秒フェードイン | **フェードなしの即時表示**(ユーザー承認済み)   |
| 画面遷移から地図へ戻ったとき       | 全セルがフェードイン      | 即時表示                                       |
| スクロールで現れた既存セル         | フェードイン              | 即時表示                                       |
| GPS記録で新しく開いたセル          | フェードイン              | フェードイン(変更なし)                         |
| 塗られるエリアの形                 | 100mセル単位              | **変更なし**(結合は完全に埋まったブロックのみ) |
| 現在地追従・現在地ボタン・地図復帰 | —                         | **変更なし**                                   |

## 5. 対象外

- 100m四方の表示を密度や重さに応じて自動的に200m/500mへ粗くすること
- `boundsPaddingRatio: 0.5` の縮小
- 現在地追従モード・現在地ボタン・地図復帰時の挙動変更
- 任意長方形結合、`8x8` 以上のブロック結合
- GPSログや写真メタデータの外部送信を伴う計測

## 6. リスクと軽減策

| リスク                                            | 軽減策                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Android の長いパンで Overlay の欠けが目立つ       | `boundsPaddingRatio: 0.5` の先読みを維持。実機確認で許容範囲か判断する                                       |
| `onRegionChangeComplete` の欠落で Grid が固まる   | 最後の操作イベントから1000msのアイドルタイマーで最新 region へ同期する(§3.1)。イベント欠落時のテストを入れる |
| ズーム操作だけで fresh が stable 化する           | fresh を100m基本セルIDで保持し、表示セルサイズ変更では落とさない(§3.2)                                       |
| 画面外に出た fresh が先読み余白の中に残り続ける   | 画面外判定を余白なしの実表示範囲で行い、DB取得を省略した region 変更でも実行する(§3.2)                       |
| 大量 fresh 時に結合まで無効化される               | フェード対象集合と結合除外集合を分け、上限はフェードにだけ適用する(§3.2)                                     |
| 結合により未訪問エリアが塗られる                  | ブロック内全セル visited を必須条件にし、市松模様・欠けブロックのテストで担保する                            |
| 結合で React key が不安定になり再マウントが増える | グリッド整列ブロックに限定し、key を `${サイズ}:${x}:${y}` の決定的な形にする                                |
| SQL集約が負のセル番号で誤る                       | floor 除算補正式を使い、負値のテストを入れる                                                                 |

## 7. 検証方針

### 自動テスト

- `resolveFreshVisitedCellIds`: 前回範囲内の新規セル / 範囲外セル / 初回取得 / 100m表示以外では追加しない / fresh の維持 / 上限超過時はフェードだけ止める
- `evictOffscreenFreshCellIds`: 余白なしの実表示範囲で画面外セルだけ落とす / 表示セルサイズ変更では落とさない
- `coalesceVisitedGridCells`: 4x4完全一致 / 欠けたブロックの2x2・単体への落とし込み / 市松模様 / 未訪問セルを塗らない / fresh除外 / メタデータ引き継ぎ / 負のセル番号
- `useMapFollowState`: ドラッグ中は `gridSyncRegion` 不変 / 完了で更新 / 現在地ボタンで即時更新 / `onRegionChangeComplete` が来なくてもアイドルタイマーで同期 / 操作継続中はタイマーが発火しない
- `useVisitedGridOverlay`: 表示セルサイズを渡して取得する / 4x4が1Polygonへ結合される / 結合できないデータのフォールバック / 初回取得は即時表示 / 再取得の新規セルは結合されない / DB取得を省略した region 変更でも画面外 fresh が落ちる
- `visitedCellRepository`: 100m表示は従来クエリ / 200m以上は `GROUP BY` / 負値の floor 除算 / 不正な表示セルサイズの拒否
- `visitedGridMetrics`: 削減率 / 整形 / 開発フラグ無効時は出力しない / 座標を含まない

### 手動確認(自動テストで担保できない部分)

1. `EXPO_PUBLIC_LOG_VISITED_GRID_METRICS=true` で最適化前(Task 1完了時点)に密集地域の数字を記録する
2. 最適化後に同じ地域で `render < raw` と削減率を記録し、前後比較する
3. 指でドラッグ中に `fetchMs` / `aggregationMs` のログが連発せず、離した後に1回だけ更新されることを確認
4. 現在地ボタンで追従再開と Grid の即時追従を確認
5. 別画面から地図へ戻ったときの表示範囲・Grid 復元を確認

## 8. 変更対象ファイル

| ファイル                                         | 区分 | 責務                                                 |
| ------------------------------------------------ | ---- | ---------------------------------------------------- |
| `src/config/developmentFlags.ts`                 | 変更 | 計測ログ用フラグ `logVisitedGridMetrics`             |
| `src/features/map/visitedGridMetrics.ts`         | 新規 | 計測値の型・削減率・整形・出力                       |
| `src/features/map/visitedGridFreshCells.ts`      | 新規 | fresh cell の検出と画面外判定(純粋関数)              |
| `src/features/map/visitedGridCoalescing.ts`      | 新規 | 正方形ブロックの Polygon 結合(純粋関数)              |
| `src/features/location/visitedCellRepository.ts` | 変更 | 表示セルサイズ引数と SQL 集約                        |
| `src/features/location/grid/gridAggregation.ts`  | 変更 | 不要になる `aggregateVisitedCells` を削除            |
| `src/ui/hooks/useMapFollowState.ts`              | 変更 | `gridSyncRegion`・操作中の更新抑止・アイドルタイマー |
| `src/ui/hooks/useVisitedGridOverlay.ts`          | 変更 | 計測接続 → fresh/stable 分離・結合・メモ分割         |
| `src/ui/state/AppStateProvider.tsx`              | 変更 | Grid 用 region の差し替え                            |
| `docs/map-rendering.md`                          | 変更 | 仕様追記                                             |

`src/ui/components/MapScreen.tsx` は**変更しない**。`visitedGridCells` の要素数と座標が変わるだけで props の形は同じため、既存の `MapScreen.test.tsx` がそのまま回帰テストになる。

## 9. 実装順

効果測定を先に入れ、**改善前の基準値を取ってから**最適化に進む。

1. 効果測定モジュール + **現行の `useVisitedGridOverlay` へ計測を接続**(改善前の基準値をここで取得する)
2. fresh cell の検出・画面外判定(純粋関数)
3. Polygon 結合(純粋関数)
4. ユーザースクロール中の Grid 更新停止 + アイドルタイマー
5. `useVisitedGridOverlay` への結線(2・3 を有効化し、計測値を結合後の内訳へ拡張)
6. 200m以上の SQLite 側集約
7. ドキュメント更新と全体検証

実装計画は `docs/superpowers/plans/2026-08-12-map-grid-render-optimization.md`。

## 10. 改訂履歴

### 2026-08-12 Codexレビュー反映

| #    | 指摘                                                                                   | 対応                                                                                                 |
| ---- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1    | 表示セルサイズ変更で fresh がリセットされ、ズーム往復だけで stable 化する              | fresh を100m基本セルIDで保持し、セルサイズ変更では落とさない。検出は100m表示中のみ(§3.2)             |
| 2    | 「画面外」判定が先読み余白付きの取得範囲になっており、DB取得を省略すると更新もされない | DB取得範囲(余白あり)と画面外判定(余白なし)を分離し、判定は region 変更のたびに実行する(§3.2)         |
| 3    | 64件上限がフェードだけでなく結合除外まで解除してしまう                                 | `freshBaseCellIds`(結合除外)と `fadingBaseCellIds`(フェード)を分離し、上限はフェードにだけ適用(§3.2) |
| 4    | `onRegionChangeComplete` 欠落時の復旧が現在地ボタン頼み                                | 最後の操作イベントから1000msのアイドルタイマーで最新 region へ同期(§3.1)                             |
| 5    | 計測が最適化後にしか接続されず前後比較ができない                                       | Task 1 で現行経路へ計測を接続し、基準値を取ってから最適化する(§3.6・§9)                              |
| 確認 | 全ズーム段階への Polygon 結合は合意が取れていない                                      | 初回実装ではユーザー確認のうえ100m表示のみへ限定(その後の追加拡張で全ズーム段階へ広げた。下記参照)   |

`package-lock.json` の 1.1.2 → 1.1.3 更新は、`develop` に元からあった `package.json` との不整合を `npm install` が解消したもの。機能変更とは別コミットにする。

### 2026-08-13 追加拡張: 200m以上でも Polygon 結合を有効化

初回実装では「200m表示セル内に fresh な100mセルが含まれる場合の扱いが決まらない」ことを理由に、Polygon 結合を100m表示だけへ限定していた。この点を「**200m以上では fresh を一切考慮しない**」と定めることで解消し、全ズーム段階へ広げた。

根拠は、集約表示がすでに「表示セル内に visited な100mセルが1つでもあれば表示セル全体を塗る」仕様であること。表示セルは「その範囲に訪問がある」ことだけを表しているため、完全に揃った `2x2` / `4x4` をまとめても塗り範囲は変わらない。fresh は「今開いた100mセルを個別に見せる」ための概念で、100mセルが個別に見えない集約表示では意味を持たない。

- 100m表示: `freshCellIds` を渡して fresh を結合対象から外す(従来どおり)
- 200m以上: `freshCellIds` に空集合を渡し、全表示セルを stable として結合する
- 未訪問の表示セルを含むブロックを結合しない条件は全ズーム段階で維持する
- fresh 集合そのものは200m以上でも保持し、画面外判定による stable 化も継続する(100m表示へ戻ったときに従来どおり機能させるため)
- GPS記録・バックグラウンド記録・`visited_cells` の保存/upsert・100mセルの永続的な意味は変更しない
