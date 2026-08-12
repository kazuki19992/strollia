# メイン地図 Visited Grid 描画軽量化 設計書

作成日: 2026-08-12
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

issue の方針を踏襲しつつ、実装可能性の観点で判断を確定させる。

### 3.1 Grid取得用 region を地図カメラ用 region から分離する

`useMapFollowState` に `gridSyncRegion` を追加し、更新規則を分ける。

| 契機 | `visibleRegion` | `gridSyncRegion` |
| --- | --- | --- |
| `onPanDrag`(ユーザー操作開始) | 変更なし | 変更なし(以後の更新を抑止するフラグを立てる) |
| `onRegionChange`(操作中・Androidのみ) | 更新する | **抑止フラグが立っている間は更新しない** |
| `onRegionChangeComplete`(操作完了) | 更新する | 更新する(フラグを下ろす) |
| `centerOnCoordinate`(追従・現在地ボタン・地図復帰) | 更新する | 更新する(フラグを下ろす) |
| `prepareMapRegionRestore`(地図復帰) | 更新する | 更新する |

**ユーザー操作かどうかは `onPanDrag` で立てるフラグだけで判定する。** `onRegionChangeComplete` の発火有無から推測しない。理由は、プログラム移動(`animateToRegion`)でも `onRegionChangeComplete` は発火するため、それを根拠にするとプログラム移動が誤ってユーザー操作扱いになるから。

`AppStateProvider` の `gridOverlayRegion` を `gridSyncRegion ?? initialRegion` へ差し替える。`visibleRegion` は既存のまま `usePhotoClusters` などへ渡す。

**トレードオフ**: Android でパン中、新しく現れた領域の Overlay は指を離すまで描かれない。`boundsPaddingRatio: 0.5`(表示範囲の外側50%を先読み)があるため、短いパンでは目に見える欠けは起きない見込み。長いパンでは指を離した時点で追いつく。この挙動は issue の受け入れ条件そのものなので許容する。

### 3.2 fresh cell / stable cell の区別

**fresh cell** = GPS記録で新しく開いたセル。フェード対象かつ Polygon 結合の対象外。
**stable cell** = それ以外の既存セル。フェードせず即時表示し、結合の対象。

#### 判定方法(検討と決定)

GPS記録は `locationRecordingSession`(前景ウォッチ + バックグラウンドタスク)側で行われ、UI フックは定期 `refreshData` の再取得で結果を知る。つまり**記録側からUIへ「今このセルを開いた」と通知する経路がない**。

検討した案:

| 案 | 内容 | 判断 |
| --- | --- | --- |
| A. 記録側からイベント通知 | `locationRecordingSession` から fresh cellId を publish | バックグラウンドタスクはJSコンテキストが別で、UIへの安定した通知経路がない。却下 |
| B. `firstVisitedAt` の新しさで判定 | 直近N秒以内に初訪問したセルを fresh とする | issue が明示的に否定している「時間経過だけでstable化する方式」に該当。却下 |
| C. 前回取得結果との差分 | **前回取得済み範囲に完全に含まれるのに、前回は返らなかったセル**を fresh とする | 採用 |

案Cは、範囲が変わっていないのに増えたセル = DB側でデータが増えた、という事実だけを根拠にする。前回範囲の外側にあるセルは「スクロールで入ってきた既存セル」の可能性があるため fresh にしない。**判定が曖昧なときはフェードしない側へ倒す**(誤って大量フェードするより、フェードし損ねる方が害が小さい)。

集約表示(200m以上)では、表示セルが占める100mセル範囲が前回範囲に完全に含まれる場合のみ fresh とする。

#### 状態遷移

- 表示され続けている fresh cell は fresh のまま(= 結合されない)
- 表示範囲から外れた fresh cell は fresh 集合から落ちる → 再表示時は stable
- 表示セルサイズが変わったら fresh 集合をリセットする(セルIDの意味が変わるため)
- 1回で64件を超える fresh が出た場合は fresh なしへ倒す(フェード嵐の防止)

### 3.3 stable cell の正方形Polygon結合

完全に埋まった正方形ブロックだけを1つの大きい Polygon へまとめる。**ブロック内の表示セルがすべて visited のときだけ**結合するので、未訪問セルを塗らず100m四方の表示意味は保たれる。

- 対象倍率は `4x4` → `2x2` → 単体 の順。`8x8` 以上と任意長方形は対象外(issue の指定どおり)
- **グリッド整列ブロックのみを対象にする**。原点は `Math.floor(x / blockSize) * blockSize`
  - 整列に限定する理由: (1) 同一倍率の整列ブロックは必ず互いに素なので貪欲でも結果が一意に決まる (2) スクロールしてもブロック境界が動かないため React key が安定する (3) 探索が O(n) で済む
  - 代償: 非整列で完全に埋まっている領域は結合されない。削減率は落ちるが表示は正しい
- 結合後セルは `cellSizeMeters = 表示セルサイズ × 倍率`、`x = 原点X / 倍率`、`cellId = ${結合後サイズ}:${x}:${y}` とする。既存の `cellToPolygonCoordinates`(`gridCell.ts:121`)がこの形をそのまま矩形へ変換できるため、描画側の変更は不要
- メタデータは `firstVisitedAt = MIN`、`lastVisitedAt = MAX`、`visitCount = SUM`

**適用範囲(ユーザー承認済み)**: 100m表示だけでなく全ズーム段階に適用する。集約表示セルに対しても同じロジックが成立し、見た目は変わらないまま Polygon 数が減るため。

### 3.4 描画メモ化の分割

現状は全セルを1つの `useMemo` で作り直しているため、フェード1フレームごとに全セルの座標変換が走る。これを分ける。

```text
coalescedVisitedGrid  (deps: 取得結果)          → stableCells / freshCells
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

## 4. ユーザー体験への影響

| 項目 | 変更前 | 変更後 |
| --- | --- | --- |
| Android のパン中の Overlay 更新 | 150ms ごとに追従 | 指を離すまで据え置き、離した時点で追従 |
| アプリ起動直後の初回描画 | 全セルが0.5秒フェードイン | **フェードなしの即時表示**(ユーザー承認済み) |
| 画面遷移から地図へ戻ったとき | 全セルがフェードイン | 即時表示 |
| スクロールで現れた既存セル | フェードイン | 即時表示 |
| GPS記録で新しく開いたセル | フェードイン | フェードイン(変更なし) |
| 塗られるエリアの形 | 100mセル単位 | **変更なし**(結合は完全に埋まったブロックのみ) |
| 現在地追従・現在地ボタン・地図復帰 | — | **変更なし** |

## 5. 対象外

- 100m四方の表示を密度や重さに応じて自動的に200m/500mへ粗くすること
- `boundsPaddingRatio: 0.5` の縮小
- 現在地追従モード・現在地ボタン・地図復帰時の挙動変更
- 任意長方形結合、`8x8` 以上のブロック結合
- GPSログや写真メタデータの外部送信を伴う計測

## 6. リスクと軽減策

| リスク | 軽減策 |
| --- | --- |
| Android の長いパンで Overlay の欠けが目立つ | `boundsPaddingRatio: 0.5` の先読みを維持。実機確認で許容範囲か判断する |
| `onPanDrag` 後に `onRegionChangeComplete` が来ず Grid が固まる | `centerOnCoordinate`(現在地ボタン・追従・地図復帰)でもフラグを下ろすため、復帰導線が残る |
| 結合により未訪問エリアが塗られる | ブロック内全セル visited を必須条件にし、市松模様・欠けブロックのテストで担保する |
| 結合で React key が不安定になり再マウントが増える | グリッド整列ブロックに限定し、key を `${サイズ}:${x}:${y}` の決定的な形にする |
| SQL集約が負のセル番号で誤る | floor 除算補正式を使い、負値のテストを入れる |
| 大量セルの再表示でフェード嵐 | fresh 上限(64件)を超えたら fresh なしへ倒す |

## 7. 検証方針

### 自動テスト

- `resolveFreshVisitedCellIds`: 前回範囲内の新規セル / 範囲外セル / 初回取得 / fresh の維持と画面外での stable 化 / 上限超過 / 集約表示セル
- `coalesceVisitedGridCells`: 4x4完全一致 / 欠けたブロックの2x2・単体への落とし込み / 市松模様 / 未訪問セルを塗らない / fresh除外 / メタデータ引き継ぎ / 負のセル番号 / 200m表示セル
- `useMapFollowState`: ドラッグ中は `gridSyncRegion` 不変 / 完了で更新 / 現在地ボタンで即時更新
- `useVisitedGridOverlay`: 表示セルサイズを渡して取得する / 4x4が1Polygonへ結合される / 結合できないデータのフォールバック / 初回取得は即時表示 / 再取得の新規セルは結合されない
- `visitedCellRepository`: 100m表示は従来クエリ / 200m以上は `GROUP BY` / 負値の floor 除算 / 不正な表示セルサイズの拒否
- `visitedGridMetrics`: 削減率 / 整形 / 開発フラグ無効時は出力しない / 座標を含まない

### 手動確認(自動テストで担保できない部分)

1. `EXPO_PUBLIC_LOG_VISITED_GRID_METRICS=true` で起動し、密集地域の100m表示で `render < raw` を確認
2. 指でドラッグ中に `fetchMs` / `aggregationMs` のログが連発せず、離した後に1回だけ更新されることを確認
3. 現在地ボタンで追従再開と Grid の即時追従を確認
4. 別画面から地図へ戻ったときの表示範囲・Grid 復元を確認

## 8. 変更対象ファイル

| ファイル | 区分 | 責務 |
| --- | --- | --- |
| `src/config/developmentFlags.ts` | 変更 | 計測ログ用フラグ `logVisitedGridMetrics` |
| `src/features/map/visitedGridMetrics.ts` | 新規 | 計測値の型・削減率・整形・出力 |
| `src/features/map/visitedGridFreshCells.ts` | 新規 | fresh cell 判定(純粋関数) |
| `src/features/map/visitedGridCoalescing.ts` | 新規 | 正方形ブロックの Polygon 結合(純粋関数) |
| `src/features/location/visitedCellRepository.ts` | 変更 | 表示セルサイズ引数と SQL 集約 |
| `src/features/location/grid/gridAggregation.ts` | 変更 | 不要になる `aggregateVisitedCells` を削除 |
| `src/ui/hooks/useMapFollowState.ts` | 変更 | `gridSyncRegion` と操作中の更新抑止 |
| `src/ui/hooks/useVisitedGridOverlay.ts` | 変更 | fresh/stable 分離・結合・メモ分割・計測 |
| `src/ui/state/AppStateProvider.tsx` | 変更 | Grid 用 region の差し替え |
| `docs/map-rendering.md` | 変更 | 仕様追記 |

`src/ui/components/MapScreen.tsx` は**変更しない**。`visitedGridCells` の要素数と座標が変わるだけで props の形は同じため、既存の `MapScreen.test.tsx` がそのまま回帰テストになる。

## 9. 実装順

issue の推奨順に従い、効果測定を先に入れる。

1. 開発用の効果測定モジュール
2. fresh cell 判定(純粋関数)
3. Polygon 結合(純粋関数)
4. ユーザースクロール中の Grid 更新停止
5. `useVisitedGridOverlay` への結線(2・3・1 をまとめて有効化)
6. 200m以上の SQLite 側集約
7. ドキュメント更新と全体検証

実装計画は `docs/superpowers/plans/2026-08-12-map-grid-render-optimization.md`。
