# 追従モード中のVisited Grid全再生成を抑える 設計書

- 対象issue: [#151](https://github.com/kazuki19992/strollia/issues/151)
- 親issue: [#138 地図表示軽量化](https://github.com/kazuki19992/strollia/issues/138) / [PR #149](https://github.com/kazuki19992/strollia/pull/149)
- 関連issue: [#152 AndroidでVisited Gridの旧Polygonが残留し二重描画される](https://github.com/kazuki19992/strollia/issues/152)(本変更では解消しない。2.3参照)
- 作成日: 2026-08-13
- 起点: `develop` (`c0db214`)

## 1. 背景と問題

現在地追従モードで歩いている間、メイン地図の Visited Grid Overlay がおおむね1秒に1回、全 Polygon を再生成している。

### 1.1 再生成が走る経路

`develop` (`c0db214`) の実装で確認した連鎖は以下のとおり。

```text
onUserLocationChange
  → applyUserLocation (src/ui/hooks/useMapFollowState.ts:347-349)
  → centerOnCoordinate (src/ui/hooks/useMapFollowState.ts:243-260)
      setVisibleRegion / setGridSyncRegion で新しい region オブジェクトを流す
      incrementVisitedGridRefreshVersionRef.current() で version を +1 する
  → useVisitedGridOverlay の取得effectが再実行 (src/ui/hooks/useVisitedGridOverlay.ts:190-268)
      早期リターン条件に lastFetch.version === visitedGridRefreshVersion が含まれるため、
      version が上がったこの経路では必ず SQLite 取得まで走る
  → 取得結果が前回と同一でも無条件に
      setVisitedGridFadeFrame(+1) / setVisitedGridSource({...}) を呼ぶ
  → coalescedVisitedGrid の useMemo が再計算 (deps: [visitedGridSource])
  → stableOverlayCells / freshOverlayCells が再計算され、全セルの
      Web Mercator 逆変換 (cellToPolygonCoordinates) と塗り色の文字列生成をやり直す
  → visitedGridCells が新しい配列になり、Polygon の props がすべて新オブジェクトになる
```

カスタム現在地アイコン使用時も専用の追従effectから `centerOnCoordinate` を呼ぶため、同じ経路を通る。

### 1.2 なぜ #149 では解消しなかったか

PR #149 の3つの改善は、それぞれ効く場面が異なる。

| #149 の改善                          | 効く場面           | 追従・静止時への効果 |
| ------------------------------------ | ------------------ | -------------------- |
| ジェスチャー中の取得・更新停止       | 指で操作している間 | なし                 |
| フェード対象を fresh cell だけに限定 | フェード中         | なし                 |
| 正方形ブロックのPolygon結合          | 常時               | 1回あたり約2割減のみ |

3つ目は1回あたりのコストを下げたが、再生成の**頻度**は変えていない。歩行中は現在地更新がおおむね毎秒発生するため、密集地を歩きながら地図を見るという #138 の主要シナリオで再生成が継続的に走り続ける。

### 1.3 変化がない時間の割合

徒歩で新しい100mセルが開くのは、おおむね100m進むごと(徒歩でおよそ1〜2分に1回)。一方で現在地更新は前景ウォッチ(`distanceInterval: 5` / `timeInterval: 2000`。`src/ui/hooks/useForegroundUserLocation.ts:64-69`)から届き、歩行中の実測ではおおむね毎秒になる。この「毎秒」は設定上の保証ではなく実測の目安である。つまり**取得結果が前回と変わらない回数が圧倒的多数**であり、ここを落とせば定常負荷はほぼ消える。

## 2. ゴールと非ゴール

### 2.1 ゴール

- 追従モードで移動中・静止中に、visited cell の集合へ変化がなければ Polygon の再生成を行わない
- GPS記録で新しいセルが開いたときは従来どおり更新し、fresh cell のフェードも従来どおり動く
- 現在地追従・現在地ボタン・地図復帰の既存挙動を変えない

### 2.2 非ゴール

- GPS記録、バックグラウンド記録、`visited_cells` の保存・upsert、100mセルの永続的な意味には触れない
- 再取得の頻度そのものは変えない(issue候補3の距離しきい値は採用しない)。SQLite取得は従来どおり位置更新のたびに走らせ、新しいセルが開いた瞬間の表示遅延を増やさない
- `coalescedVisitedGrid` のブロック単位キャッシュ(issue候補2)は行わない。変化がない場合を落とせば残るのは「実際に変化した回のコスト」だけで、キャッシュ無効化の設計を増やすほどの取り分がない
- **[#152](https://github.com/kazuki19992/strollia/issues/152) の Android 旧Polygon残留は解消しない**(2.3参照)

### 2.3 #152(Android旧Polygon残留)との関係

[#152](https://github.com/kazuki19992/strollia/issues/152) は、Android Fabric で unmount した `Polygon` が Google Maps surface から削除されず二重描画になる不具合(`react-native-maps` の既知未解決issue)であり、**本変更では解消しない**。

本変更で減るのは「描画集合が変わっていないのに Polygon を作り直す回数」だけである。以下の場合は従来どおり旧 Polygon の remove と新規 add が発生するため、残留の条件も従来どおり成立する。

- ズームで表示セルサイズが切り替わったとき(セルIDの体系ごと入れ替わる)
- スクロールで表示範囲が変わり、セルが増減したとき
- GPS記録で新しいセルが開いたとき

発生**頻度**は下がるため症状が見えにくくなる可能性があるが、これは原因の解消ではなく観測機会の減少にすぎない。したがって次を守る。

- **#151 の完了は、Android の二重描画解消やリリース可否の根拠にならない**
- Android実機での重複描画検証は #151 の受け入れ条件に含めず、#152 側の受け入れ条件として独立させる
- 本変更の検証は iOS シミュレータ / 実機での計測とテストで完結させる

## 3. 設計

3箇所を変更する。いずれも表示層に閉じた変更で、記録・保存には一切触れない。3つ目は開発フラグ有効時のみ動く計測である。

### 3.1 取得結果が同一なら state 更新をスキップする

取得effectの `.then` で、今回の取得結果が前回と同一かを判定し、同一なら `setVisitedGridSource` と `setVisitedGridFadeFrame` のどちらも呼ばない。

判定条件は次の4つをすべて満たすこと。

1. 前回取得が存在する(初回取得ではない)
2. 表示セルサイズが前回と同じ
3. 表示セルIDの集合が前回と同じ
4. 今回 fresh として検出されたセルが1つもない

スキップした場合も `lastVisitedGridFetchRef` は必ず更新する。次回のfresh判定に使う `previousBounds` と、範囲内小移動の再取得省略に使う `bounds` を最新にしておく必要があるため。

#### なぜ cellId 集合だけを比較するのか

比較対象に `visitCount` / `firstVisitedAt` / `lastVisitedAt` を含めてはいけない。**現在地セルの `visit_count` と `last_visited_at` はGPS記録のたびに更新される**ため、これらを比較に含めると「変化なし」と判定できる回がほぼなくなり、最適化そのものが成立しない。

そして含めなくても描画は壊れない。`toVisitedGridOverlayCells` が作る Polygon の見た目(`coordinates` / `fillColor` / `strokeColor` / `strokeWidth`)は `cellId`・`x` / `y` / `cellSizeMeters` と fog opacity・テーマ色だけで決まる。`visitCount` などは `VisitedGridOverlayCell` に載るが、`MapScreen` の Polygon はどれも参照していない。したがって**表示セルIDの集合が同じなら描画結果は同一**である。

代償として、スキップした回のメタデータは `visitedGridSource` 上で古いままになる。現状は描画に使われないため影響はない。将来 `visitCount` で塗り分けるなど**メタデータを描画へ反映する変更を入れる場合は、この同一性判定も合わせて見直す必要がある**。この制約はコードのJSDocにも明記する。

#### フェードフレーム更新も止めてよい理由

`syncVisitedGridFadeState` は無条件に `setVisitedGridFadeFrame` を +1 する。スキップ時にこれを呼ばなくてよいのは以下による。

- `fadingCellIds` は `freshCellIds` の部分集合であり、fresh検出0件なら必ず空。登録すべきフェード開始時刻がない
- fresh集合が変化しないため、`pruneVisitedGridFadeState` で削除される要素もない
- フェード進行中の再描画は、フェード用effectが `setTimeout` で自走している(`useVisitedGridOverlay.ts:364-377`)。取得側のフレーム更新に依存していない

#### 判定は純粋関数へ切り出す

判定ロジックは `src/features/map/visitedGridIdentity.ts`(新規)へ純粋関数として置き、単体テストで固定する。フック内へ直接書くと、退行を注入しても検出できないテストになる(#149 の `EMPTY_FRESH_CELL_IDS` で同じ問題があった)。

```typescript
/** 直近取得の表示セルID集合と今回の取得結果が同一かを返す。 */
export function hasSameVisitedGridCellIds(previousCellIds: ReadonlySet<string>, nextCells: readonly GridCellPolygonSource[]): boolean;

/** 今回の取得結果でvisitedGridSourceの更新を省略してよいかを返す。 */
export function canSkipVisitedGridSourceUpdate(params: {
  previousFetch: { cellIds: ReadonlySet<string>; cellSizeMeters: number } | null;
  nextCells: readonly GridCellPolygonSource[];
  displayCellSizeMeters: number;
  detectedFreshCellIds: ReadonlySet<string>;
}): boolean;
```

`hasSameVisitedGridCellIds` は件数一致 + 全要素が前回集合に含まれることで判定する。取得結果の `cellId` はSQLの `GROUP BY` により一意なため、この2条件で集合の一致と等価になる。

### 3.2 MapScreen の Polygon 要素をメモ化する

3.1 だけでは受け入れ条件を満たしきれない。追従中は `setUserCoordinate` / `setVisibleRegion` によりどのみち位置更新のたびに `MapScreen` が再レンダーされるため、`visitedGridCells` の参照が同じでも `visitedGridCells.map(...)` は毎回走り、全 Polygon の React 要素が作り直される。props の参照は同一なので値は変わらないが、要素生成と子の差分照合のコストは表示セル数ぶんかかる。

そこで Polygon 要素の配列を `useMemo` 化し、`visitedGridCells` と `shouldRenderVisitedGrid` が変わらない限り**同じ要素配列の参照を返す**。要素の参照が前回と同一なら React は該当サブツリーの再レンダーをスキップするため、追従中の再レンダーで Visited Grid が完全に据え置かれる。

```tsx
const visitedGridPolygons = useMemo(
  () => (shouldRenderVisitedGrid ? visitedGridCells.map((cell) => <Polygon key={cell.id} ... />) : null),
  [shouldRenderVisitedGrid, visitedGridCells],
);
```

Polygon に渡す値のうち `visitedGridCells` 以外に依存するものはない(`tappable` / `zIndex` / `testID` は定数)ため、依存配列はこの2つで足りる。

### 3.3 スキップ回を観測できる開発用ログを追加する

既存の `[VisitedGrid] raw=… render=…` ログは `logVisitedGridMetrics` を呼ぶeffectの依存が `[visitedGridCells]` のため、**更新をスキップした回はログが1行も出ない**。ログが減ったことだけでは「位置更新自体が来なかった」のか「取得したうえで更新をスキップした」のかを区別できず、本変更の効果を直接確認できない。

そこで取得effectの `.then` から、更新・スキップのどちらの経路でも1行出す開発用ログを追加する。

```typescript
/** visitedGridSource更新の結果。 */
export type VisitedGridSourceUpdateOutcome = 'updated' | 'skipped';

/** `logVisitedGridSourceUpdate` へ渡す計測値。 */
export type VisitedGridSourceUpdateMetrics = {
  /** 今回の取得で state を更新したか、スキップしたか。 */
  outcome: VisitedGridSourceUpdateOutcome;
  /** 取得できた表示セル数。 */
  cellCount: number;
  /** 起動後に更新した累計回数。 */
  updatedCount: number;
  /** 起動後にスキップした累計回数。 */
  skippedCount: number;
};
```

出力形式は既存ログと揃えて `[VisitedGrid] source=skipped cells=1234 updated=3 skipped=57` とする。累計値を持つことで、一定時間歩いたあとの比率がそのまま効果指標になる。

既存の `logVisitedGridMetrics` と同じく `developmentFlags.logVisitedGridMetrics` で全体をゲートし、座標・セルIDは一切出力しない。累計カウンタはフック内のrefで保持する(描画に影響しないため state にしない)。整形は純粋関数 `formatVisitedGridSourceUpdate` に切り出して単体テストする。

### 3.4 変更しないもの

- 取得effectの依存配列と早期リターン条件(`coveredByLastFetch`)
- `getVisitedCellsInBounds` のクエリ、`boundsPaddingRatio` の先読み余白
- fresh検出・フェード・Polygon結合のロジック
- `useMapFollowState` の追従・センタリング・アイドル同期
- `visited_cells` への書き込み経路(記録側)

## 4. データフロー

```text
現在地更新(位置更新のたび。歩行中の実測でおおむね毎秒)
  → centerOnCoordinate → version+1 / region更新
  → 取得effect再実行 → SQLite取得 (従来どおり)
  → detectFreshVisitedCells (従来どおり)
  → canSkipVisitedGridSourceUpdate ← 追加
       true  : lastVisitedGridFetchRef のみ更新して終了
               → 再レンダーなし。coalesce・座標変換・Polygon生成は一切走らない
       false : 従来どおり fade state 同期 + setVisitedGridSource
  → logVisitedGridSourceUpdate(updated / skipped) ← 追加(開発フラグ有効時のみ)
  → (再レンダー時) MapScreen は memo 済み Polygon 要素配列を返す ← 追加
```

## 5. テスト

### 5.1 純粋関数 `src/features/map/__tests__/visitedGridIdentity.test.ts`(新規)

- `hasSameVisitedGridCellIds`
  - 同じIDが同じ順序 / 異なる順序で来た場合はtrue
  - 件数が同じでもIDが1つ異なる場合はfalse
  - セルが増えた場合・減った場合はfalse
  - 双方が空の場合はtrue
  - IDが同じでメタデータ(`visitCount` / `lastVisitedAt`)だけ違う場合はtrue(3.1 の意図を仕様として固定する)
- `canSkipVisitedGridSourceUpdate`
  - 前回取得がnull(初回)ならfalse
  - 表示セルサイズが違えばfalse
  - fresh検出が1件でもあればfalse
  - 上記をすべて満たし、ID集合が一致する場合だけtrue

### 5.2 純粋関数 `src/features/map/__tests__/visitedGridMetrics.test.ts`(追加)

- `formatVisitedGridSourceUpdate` が `outcome` / `cellCount` / 累計値を含む1行を返す
- `skipped` と `updated` で出力が区別できる

### 5.3 フック `src/ui/hooks/__tests__/useVisitedGridOverlay.test.tsx`(追加)

- **同じ cellId で `lastVisitedAt` / `visitCount` だけが変化した rows を2回返しても、`visitedGridCells` の参照が維持される**(本issueの最重要ケース。現在地セルのメタデータはGPS記録のたびに更新されるため、実運用で最も頻繁に起きる。純粋関数のテストとは別に、フックへ正しく結線されていることをここで固定する)
- 完全に同じ結果を返す再取得のあと、`visitedGridCells` の参照が維持される(`toBe` で検証)
- 新しいセルが増えた再取得では `visitedGridCells` が更新される
- 表示セルサイズが変わった再取得では更新される
- fresh cell が検出された再取得では更新され、フェードが始まる
- 内容が同一でも `getVisitedCellsInBounds` の呼び出し自体は従来どおり行われる(取得を止めていないことの確認)

### 5.4 画面 `src/ui/components/__tests__/MapScreen.test.tsx`(追加)

- `visitedGridCells` を据え置いたまま無関係なpropsを変えて再レンダーしても、Polygon が再レンダーされない(モックした Polygon のレンダー回数で検証)
- `visitedGridCells` を差し替えた再レンダーでは Polygon が再レンダーされる

### 5.5 既存テスト

`useVisitedGridOverlay` / `MapScreen` / `routerIndex` / `AppMapReturn` などの既存テストが変更なしで通ることを確認する。追従・現在地ボタン・地図復帰の挙動を変えていないことの担保とする。

## 6. 計測

着手前後で `EXPO_PUBLIC_LOG_VISITED_GRID_METRICS=true` を有効にし、密集地域を100m表示・追従モードで歩いて比較する。

主指標は 3.3 で追加する `source=` ログの **skipped / updated 比**とする。描画ログ(`raw=…`)の行数を主指標にはしない。理由は以下の2点。

- スキップ回は描画ログが出ないため、行が減ったこと自体が「位置更新が来なかった」のか「取得後にスキップした」のかを区別できない
- 描画ログは `visitedGridCells` が変わるたびに出る。新しいセルが1つ開くとフェード中は50msごとに fresh 側の描画データが変わるため、**1セル追加につき約0.5秒間・最大10行前後がまとまって出る**。「新セル時に1行」ではない

| 指標                                     | 変更前                        | 期待する変更後                                             |
| ---------------------------------------- | ----------------------------- | ---------------------------------------------------------- |
| `source=skipped` / `source=updated` の比 | (ログなし。全回 updated 相当) | 同一セル内の移動が続く区間では skipped が大多数を占める    |
| 描画ログ(`raw=…`)の出方                  | 位置更新のたびに1行           | 定常時は出ない。新セル追加時にフェード分がバースト状に出る |
| `overlayBuildMs` の発生頻度              | 位置更新のたび                | 上記バーストのときだけ                                     |
| `raw` / `render` の値                    | —                             | 同じ表示内容なら変更前と一致する(表示は変えていない)       |

### 6.1 位置を固定した観測は使わない

前景の現在地取得は `distanceInterval: 5` / `timeInterval: 2000` で購読している(`src/ui/hooks/useForegroundUserLocation.ts:64-69`)。**位置を完全に固定すると初回以降の更新が届かなくなることがある**ため、「静止させれば `source=skipped` が増え続ける」という観測はできない。同じ制約は `useMapFollowState.ts:266-270` のコメントにも既存事実として書かれている。

そのため検証手順は次のどちらかにする。

1. **同一の100mセル内で5m以上ずつ位置を動かす**(推奨)。Xcode の GPX シミュレーションなどで、100mセルの中央付近を数十m四方で往復させる。5m以上動くたびに位置更新が届き、追従センタリングと再取得が走る一方、visited cell の集合は変わらないため `source=skipped` が積み上がる
2. 位置イベントを連続注入する。実機・シミュレータを使わずに同じ経路を通したい場合に使う

なお 1 でも、100mセル境界をまたいだ回だけは表示範囲のセル番号範囲が変わって `source=updated` になる。**skipped が100%になることは期待値ではなく、大多数を占めることが期待値**である。境界をまたいだ回に描画ログのバーストが出るのも正常な挙動として扱う。

## 7. リスクと対応

| リスク                                                     | 対応                                                                                                 |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| メタデータ更新が画面へ反映されなくなる                     | 現状は描画に未使用。3.1 の理由をJSDocへ明記し、将来描画へ使う際は判定を見直す                        |
| スキップ判定の誤りで新しいセルが表示されなくなる           | 純粋関数へ切り出して単体テストで固定し、フック側でも「増えたら更新される」ケースをテストする         |
| メモ化で Polygon が更新されなくなる                        | 依存配列を `visitedGridCells` / `shouldRenderVisitedGrid` だけに限定し、更新されるケースをテストする |
| `lastVisitedGridFetchRef` と `visitedGridSource` の不整合  | スキップ時も内容は同一なので不整合にならない。スキップ時もrefは必ず更新する                          |
| 発生頻度が下がることで #152 の残留が「直った」ように見える | 2.3 のとおり原因は未解消。Android実機での重複描画検証は #152 の受け入れ条件として独立させる          |
| 追加した開発用ログが本番ビルドで出力される                 | 既存の `logVisitedGridMetrics` と同じ `developmentFlags.logVisitedGridMetrics` ゲート下に置く        |

## 8. 受け入れ条件

- [ ] 追従モードで静止または低速移動しているとき、visited cell に変化がなければ Polygon の props が再生成されない
- [ ] GPS記録で新しいセルが開いたときは従来どおり表示が更新され、fresh cell がフェードインする
- [ ] 現在地追従モード、現在地ボタン、地図復帰時の既存挙動が変わらない
- [ ] 未訪問の100mセルを塗らない条件が維持されている
- [ ] `EXPO_PUBLIC_LOG_VISITED_GRID_METRICS=true` で、追従中に `source=skipped` が大多数を占めることを確認できる
- [ ] メタデータ(`visitCount` / `lastVisitedAt`)だけが変化した再取得で更新をスキップすることが、フックのテストで固定されている
- [ ] 退行として検出できるテストが追加されている(スキップ / 更新の両方)
- [ ] `npm run typecheck`、`npm test`、`npm run lint`(error 0)、`npm run format:check` が成功する

以下は **この issue の受け入れ条件に含めない**。

- Android実機での旧Polygon残留・二重描画の解消([#152](https://github.com/kazuki19992/strollia/issues/152) の受け入れ条件として独立させる)

## 9. 更新するドキュメント

- `docs/map-rendering.md` §4.2 / §9 — 取得結果が同一な場合の更新スキップ、Polygon 要素のメモ化、`source=` 開発用ログを追記
