# メイン地図 Visited Grid 描画軽量化 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 100m四方の表示意味を保ったまま、メイン地図の Visited Grid Overlay の取得・集約・Polygon描画コストを下げ、密集地域でのスクロールを軽くする(GitHub issue #138)。

**Architecture:** 設計書 `docs/superpowers/specs/2026-08-12-map-grid-render-optimization-design.md` に従う。地図カメラ用 `visibleRegion` と Grid取得用 `gridSyncRegion` を分離し、`onPanDrag` で立てたフラグが立っている間は後者を更新しない。GPS記録で開いた fresh cell(100m基本セルIDで保持)だけをフェード対象・Polygon結合の対象外とし、既存の stable cell は完全に埋まった正方形ブロックへ結合する。200m以上の表示セルは SQLite 側で集約する。

**Tech Stack:** TypeScript 6.0 (strict) / React 19.2 / React Native 0.86 / expo-sqlite / react-native-maps / jest + @testing-library/react-native

## Global Constraints

- 作業ディレクトリは worktree `.worktrees/claude-map-grid-render-optimization`(ブランチ `claude/map-grid-render-optimization`、`develop` 起点)。
- TDD厳守。「失敗するテストを書く → 失敗を確認 → 最小実装 → 成功を確認 → コミット」の順。
- `describe` / `it` / `test` の説明文は日本語。JSDoc も日本語で「なぜその設計か」を必要に応じて書く。
- import は `@/` エイリアス。`../` 始まりの相対 import は ESLint error。同一ディレクトリは `./`。
- コミットメッセージは Semantic Commit Message(`type(scope): 日本語の説明`)。
- 合格条件: `npm run typecheck` 成功、`npm test` 成功、`npm run lint` の error 0、`npm run format:check` 差分なし。
- **未訪問の100mセルを塗る変更は不可。** 結合は「ブロック内の表示セルがすべて visited のときだけ」。
- **既存挙動を変えない箇所**: 現在地追従の状態機械(初期ON / ドラッグでOFF / 現在地ボタンでON)、現在地ボタン、地図復帰時のセンタリング、`GRID_OVERLAY_CONFIG.boundsPaddingRatio: 0.5`。
- ログに GPS 座標・cellId・移動履歴を含めない。件数・処理時間・削減率のみ。開発フラグ配下に限定する。
- 結合対象は整列した正方形のみ(`4x4` / `2x2`)。`8x8` 以上と任意長方形は対象外。
- Polygon 結合は **全ズーム段階**へ適用する(関数は表示セルサイズ非依存の汎用実装)。100m表示では `freshCellIds` を渡して fresh を除外し、200m以上では空集合を渡して全表示セルを stable として結合する。
- fresh cell は **100m基本セルID(`100:x:y`)** で保持する。表示セルサイズ変更では落とさない。

---

## ファイル構成

| ファイル                                         | 区分 | 責務                                                 |
| ------------------------------------------------ | ---- | ---------------------------------------------------- |
| `src/config/developmentFlags.ts`                 | 変更 | 計測ログ用フラグ `logVisitedGridMetrics`             |
| `src/features/map/visitedGridMetrics.ts`         | 新規 | 計測値の型・削減率・整形・出力                       |
| `src/features/map/visitedGridFreshCells.ts`      | 新規 | fresh cell の検出と画面外判定(純粋関数)              |
| `src/features/map/visitedGridCoalescing.ts`      | 新規 | 正方形ブロックの Polygon 結合(純粋関数)              |
| `src/features/location/visitedCellRepository.ts` | 変更 | 表示セルサイズ引数と SQL 集約                        |
| `src/features/location/grid/gridAggregation.ts`  | 変更 | `aggregateVisitedCells` を削除                       |
| `src/ui/hooks/useMapFollowState.ts`              | 変更 | `gridSyncRegion`・操作中の更新抑止・アイドルタイマー |
| `src/ui/hooks/useVisitedGridOverlay.ts`          | 変更 | 計測接続 → fresh/stable 分離・結合・メモ分割         |
| `src/ui/state/AppStateProvider.tsx`              | 変更 | Grid 用 region の差し替え                            |
| `docs/map-rendering.md`                          | 変更 | 仕様追記                                             |

---

### Task 1: 計測モジュールを作り、現行経路へ接続して基準値を取れるようにする

**Files:**

- Create: `src/features/map/visitedGridMetrics.ts` / `src/features/map/__tests__/visitedGridMetrics.test.ts`
- Modify: `src/config/developmentFlags.ts` / `src/config/__tests__/developmentFlags.test.ts`
- Modify: `src/ui/hooks/useVisitedGridOverlay.ts`

**Interfaces:**

- Produces:
  - `type VisitedGridMetrics = { rawCellCount: number; stableCellCount: number; freshCellCount: number; renderPolygonCount: number; coalescedBlockCountBySize: Record<string, number>; fetchMs: number; aggregationMs: number; overlayBuildMs: number }`
  - `function calculatePolygonReductionRatio(rawCellCount: number, renderPolygonCount: number): number`
  - `function formatVisitedGridMetrics(metrics: VisitedGridMetrics): string`
  - `function logVisitedGridMetrics(metrics: VisitedGridMetrics): void`
  - `developmentFlags.logVisitedGridMetrics: boolean`(環境変数 `EXPO_PUBLIC_LOG_VISITED_GRID_METRICS`)

**このタスクの狙い:** ログ関数を作るだけでは改善前の数字が取れない。最適化に入る前に現行の `useVisitedGridOverlay` へ計測を差し込み、密集地域での `rawCellCount` / `renderPolygonCount` / 各処理時間の基準値を取れる状態にする。

- [ ] **Step 1: 計測モジュールの失敗するテストを書く**

`src/features/map/__tests__/visitedGridMetrics.test.ts`(検証項目: 削減率の正常系・0件・削減なし / 整形文字列に各値と `reduction=86.3%` が含まれる / 座標を示す語を含まない / 開発フラグ無効時は `console.log` を呼ばない / 有効時は `[VisitedGrid]` を含む文字列を出力する)。

`src/config/__tests__/developmentFlags.test.ts` へ「環境変数でVisited Grid計測ログを有効にできる」を追加し、`loadDevelopmentFlagsModule` の保存・設定・復元へ `EXPO_PUBLIC_LOG_VISITED_GRID_METRICS` を足す。

- [ ] **Step 2: 失敗を確認する**

Run: `npx jest src/features/map/__tests__/visitedGridMetrics.test.ts src/config/__tests__/developmentFlags.test.ts`
Expected: FAIL(`Cannot find module '@/features/map/visitedGridMetrics'`)

- [ ] **Step 3: 開発フラグを追加する**

`developmentFlags` の `Record` 型引数へ `'logVisitedGridMetrics'` を足し、`process.env.EXPO_PUBLIC_LOG_VISITED_GRID_METRICS === ENABLED_ENV_VALUE` を値にする。JSDoc は「Visited Grid Overlayの取得・結合・描画コストを開発中に確認する。」

- [ ] **Step 4: 計測モジュールを実装する**

`calculatePolygonReductionRatio` は `rawCellCount <= 0` で 0、それ以外は `Math.max(0, 1 - renderPolygonCount / rawCellCount)`。
`formatVisitedGridMetrics` は `[VisitedGrid] raw=… stable=… fresh=… render=… reduction=…% blocks(4x4=… 2x2=… 1x1=…) fetchMs=… aggregationMs=… overlayBuildMs=…` の1行。
`logVisitedGridMetrics` は `developmentFlags.logVisitedGridMetrics` が false なら即 return、true なら `console.log(formatVisitedGridMetrics(metrics))`。

- [ ] **Step 5: テストの成功を確認する**

Run: `npx jest src/features/map/__tests__/visitedGridMetrics.test.ts src/config/__tests__/developmentFlags.test.ts`
Expected: PASS

- [ ] **Step 6: 現行の `useVisitedGridOverlay` へ計測を接続する**

改善前の基準値を取るため、既存構造は変えずに計測だけ足す。

- 取得 effect: `getVisitedCellsInBounds` の前後で `Date.now()` を取り `fetchMs`、`aggregateVisitedCells` 前後で `aggregationMs` を測り `visitedGridTimingRef` へ入れる
- `visitedGridCells` の `useMemo` 内で `toVisitedGridOverlayCells` の前後を測り `overlayBuildMs` を入れる(`// eslint-disable-next-line react-hooks/purity -- 開発用の処理時間計測。描画結果には影響しない`)
- `visitedGridCells` を依存にした `useEffect` で `logVisitedGridMetrics` を呼ぶ。この時点では `stableCellCount = rawCellCount`、`freshCellCount = 0`、`coalescedBlockCountBySize = {}`

- [ ] **Step 7: 既存テストが壊れていないことを確認する**

Run: `npx jest src/ui/hooks/__tests__/useVisitedGridOverlay.test.tsx`
Expected: PASS

- [ ] **Step 8: コミット**

```bash
git add src/features/map/visitedGridMetrics.ts src/features/map/__tests__/visitedGridMetrics.test.ts src/config/developmentFlags.ts src/config/__tests__/developmentFlags.test.ts src/ui/hooks/useVisitedGridOverlay.ts
git commit -m "feat(map): Visited Grid描画コストの開発用計測を追加"
```

---

### Task 2: fresh cell の検出と画面外判定

**Files:**

- Create: `src/features/map/visitedGridFreshCells.ts` / `src/features/map/__tests__/visitedGridFreshCells.test.ts`

**Interfaces:**

- Consumes: `GridBounds`, `GridCell`(`@/features/location/grid/gridCell`)
- Produces:
  - `const MAX_FADING_VISITED_CELL_COUNT = 64`
  - `type DetectFreshVisitedCellsParams = { previousCellIds: ReadonlySet<string>; previousBounds: GridBounds | null; previousDisplayCellSizeMeters: number | null; nextCells: readonly GridCell[]; displayCellSizeMeters: number; baseCellSizeMeters: number; maxFadingCellCount: number }`
  - `type DetectedFreshVisitedCells = { freshCellIds: Set<string>; fadingCellIds: Set<string> }`
  - `function detectFreshVisitedCells(params: DetectFreshVisitedCellsParams): DetectedFreshVisitedCells`
  - `function evictOffscreenFreshCellIds(freshCellIds: ReadonlySet<string>, visibleBounds: GridBounds): Set<string>`

**判定ルール:**

fresh は100m基本セルID(`100:x:y`)で持つ。検出は「前回取得も今回取得も100m表示だった場合」だけ行い、「前回取得済み範囲に完全に含まれるのに前回は返らなかったセル」を fresh とする。前回範囲の外はスクロールで入った既存セルの可能性があるため fresh にしない(曖昧なときはフェードしない側へ倒す)。

**前回の表示セルサイズも見る理由**: 前回が集約表示だと前回IDは `200:x:y`、今回は `100:x:y` になるため、素朴な差分では範囲内の既存セルがすべて「前回なかったセル」に見える。集約表示から100m表示へズームインしただけで大量セルが fresh 判定され、フェードと結合除外が同時に走って避けたい負荷が戻る。前回が100m以外なら検出をスキップし、今回の100mセル集合を次回の baseline として記録するだけにする。

`fadingCellIds` は fresh のうちフェードを開始してよいもの。1回の検出で `maxFadingCellCount` を超えたらフェードは行わない(fresh 自体は維持し、結合除外は続ける)。

`evictOffscreenFreshCellIds` は**余白なしの実表示範囲**を受け取り、範囲外の fresh を落とす。DB取得を省略した region 変更でも呼べるよう、取得処理から独立した純粋関数にする。

- [ ] **Step 1: 失敗するテストを書く**

`src/features/map/__tests__/visitedGridFreshCells.test.ts` の検証項目:

`detectFreshVisitedCells`

1. 前回取得済み範囲の内側に現れた新しいセルは fresh かつ fading になる
2. 前回取得範囲の外にあるセルは fresh にしない
3. 初回取得(`previousBounds` が null)では fresh なし
4. 前回も存在したセルは fresh にしない
5. 100m表示以外(`displayCellSizeMeters` が 200)では fresh を検出しない
6. 集約表示から100m表示へズームインした直後(`previousDisplayCellSizeMeters` が 200)は既存セルを fresh にしない
7. `previousDisplayCellSizeMeters` が null なら fresh を検出しない
8. 上限を超えた場合は `freshCellIds` は維持し `fadingCellIds` だけ空にする

`evictOffscreenFreshCellIds` 7. 実表示範囲の内側の fresh は残す 8. 実表示範囲の外側の fresh は落とす 9. 空集合を渡しても壊れない

- [ ] **Step 2: 失敗を確認する**

Run: `npx jest src/features/map/__tests__/visitedGridFreshCells.test.ts`
Expected: FAIL(`Cannot find module`)

- [ ] **Step 3: 実装する**

```typescript
export function detectFreshVisitedCells({ ... }): DetectedFreshVisitedCells {
  const freshCellIds = new Set<string>();
  // 集約表示では取得結果からどの100mセルが開いたか特定できない。前回が集約表示だと
  // IDの体系が違うため既存セルが全部「前回なかったセル」に見える。どちらも100mのときだけ検出する。
  const isBaseSizeComparison = displayCellSizeMeters === baseCellSizeMeters && previousDisplayCellSizeMeters === baseCellSizeMeters;

  if (!previousBounds || !isBaseSizeComparison) {
    return { freshCellIds, fadingCellIds: new Set<string>() };
  }

  for (const cell of nextCells) {
    if (previousCellIds.has(cell.cellId)) continue;
    if (isCellInsideBounds(cell, previousBounds)) freshCellIds.add(cell.cellId);
  }

  // 大量再表示でのフェード嵐を避ける。結合除外(freshCellIds)は維持する。
  const fadingCellIds = freshCellIds.size > maxFadingCellCount ? new Set<string>() : new Set(freshCellIds);

  return { freshCellIds, fadingCellIds };
}

export function evictOffscreenFreshCellIds(freshCellIds, visibleBounds): Set<string> {
  const retained = new Set<string>();

  for (const cellId of freshCellIds) {
    const parsed = parseBaseCellId(cellId);
    if (parsed && isPointInsideBounds(parsed, visibleBounds)) retained.add(cellId);
  }

  return retained;
}
```

`parseBaseCellId` は `100:x:y` を `{ x, y }` へ分解する。形式が違えば null を返し、その fresh は落とす。

- [ ] **Step 4: 成功を確認する**

Run: `npx jest src/features/map/__tests__/visitedGridFreshCells.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/features/map/visitedGridFreshCells.ts src/features/map/__tests__/visitedGridFreshCells.test.ts
git commit -m "feat(map): GPS記録で開いた新規visited cellの判定を追加"
```

---

### Task 3: 完全に埋まった正方形ブロックのPolygon結合

**Files:**

- Create: `src/features/map/visitedGridCoalescing.ts` / `src/features/map/__tests__/visitedGridCoalescing.test.ts`

**Interfaces:**

- Produces:
  - `const VISITED_GRID_COALESCE_BLOCK_SIZES: readonly number[] = [4, 2]`
  - `type CoalescedVisitedGrid = { stableCells: GridCellPolygonSource[]; freshCells: GridCellPolygonSource[]; blockCountBySize: Record<string, number> }`
  - `function coalesceVisitedGridCells(cells: readonly GridCellPolygonSource[], freshCellIds: ReadonlySet<string>, blockSizes?: readonly number[]): CoalescedVisitedGrid`

**設計メモ:** グリッド整列ブロック(原点が倍率の倍数)のみを対象にする。整列ブロックは同一倍率どうしで互いに素なので貪欲でも結果が一意に決まり、スクロールしても React key が安定し、探索が O(n) で済む。結合後セルは `cellSizeMeters = 元サイズ × 倍率`、`x = 原点X / 倍率`、`cellId = ${結合後サイズ}:${x}:${y}`。`cellToPolygonCoordinates` がこの形をそのまま矩形へ変換できる。

- [ ] **Step 1: 失敗するテストを書く**

検証項目:

1. 4x4が完全に埋まっていれば `400:0:0` の1セルへ結合される
2. 4x4の一部が欠けていれば 2x2 3個 + 単体 3個へ落ちる
3. 市松模様では結合せず100mセル8個のまま
4. 未訪問セルを含む2x2は結合されない(塗る範囲が増えない)
5. fresh cell は `freshCells` へ分離され結合されない
6. 結合後セルは MIN/MAX/SUM のメタデータを引き継ぐ
7. 負のセル番号(`-4..-1`)でも整列を崩さず `400:-1:-1` へ結合する
8. 表示セルサイズ200mのセルにも適用できる(汎用性の確認)
9. 空配列で壊れない

- [ ] **Step 2: 失敗を確認する**

Run: `npx jest src/features/map/__tests__/visitedGridCoalescing.test.ts`
Expected: FAIL(`Cannot find module`)

- [ ] **Step 3: 実装する**

1. `freshCellIds` に含まれるセルを `freshCells` へ分ける
2. 残りを表示セルサイズごとに `Map<'x:y', cell>` へ入れる
3. `blockSizes` を大きい順に走査し、未処理セルから重複を除いたブロック原点を列挙する
4. ブロック内 `blockSize²` セルが全部そろっていれば結合し、構成セルを未処理から削除して `blockCountBySize['4x4']` 等を加算する
5. 残ったセルはそのまま `stableCells` へ入れ、`blockCountBySize['1x1']` を加算する
6. 最後に `cellSizeMeters → y → x` で安定ソートする

- [ ] **Step 4: 成功を確認する**

Run: `npx jest src/features/map/__tests__/visitedGridCoalescing.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/features/map/visitedGridCoalescing.ts src/features/map/__tests__/visitedGridCoalescing.test.ts
git commit -m "feat(map): 完全に埋まった正方形ブロックのPolygon結合を追加"
```

---

### Task 4: ユーザースクロール中のGrid更新停止とアイドルタイマー

**Files:**

- Modify: `src/ui/hooks/useMapFollowState.ts` / `src/ui/hooks/__tests__/useMapFollowState.test.tsx`
- Modify: `src/ui/state/AppStateProvider.tsx`

**Interfaces:**

- Produces: `UseMapFollowStateResult.gridSyncRegion: Region | null`

**更新規則(設計書 §3.1 の表と一致させること):**

| 契機                      | `visibleRegion` | `gridSyncRegion`                   | アイドルタイマー |
| ------------------------- | --------------- | ---------------------------------- | ---------------- |
| `onPanDrag`               | 変更なし        | 変更なし                           | 張り直す         |
| `onRegionChange`(操作中)  | 更新            | 抑止フラグが立っていれば更新しない | 張り直す         |
| `onRegionChangeComplete`  | 更新            | 更新                               | 解除             |
| `centerOnCoordinate`      | 更新            | 更新                               | 解除             |
| `prepareMapRegionRestore` | 更新            | 更新                               | 解除             |
| タイマー発火(1000ms)      | 変更なし        | 直近 region へ同期                 | —                |

**ユーザー操作判定は `onPanDrag` のフラグだけで行う。** `onRegionChangeComplete` の発火有無から推測しない(プログラム移動でも発火するため)。

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/hooks/__tests__/useMapFollowState.test.tsx` へ `describe('Grid取得用region gridSyncRegion', ...)` を追加。検証項目:

1. 初期状態は null
2. `handleMapPanDrag` → `handleRegionChange` では `visibleRegion` は更新されるが `gridSyncRegion` は null のまま
3. `handleRegionChangeComplete` で `gridSyncRegion` が更新される
4. ユーザー操作がない状態の `handleRegionChange` では `gridSyncRegion` も更新される
5. 現在地ボタン(`recenterOnUserLocation`)ではドラッグ後でも `gridSyncRegion` が即時更新される
6. `onRegionChangeComplete` が来なくても、最後の操作から1000ms経過で直近 region へ同期する
7. 操作が続いている間(1000ms未満の間隔で `handleRegionChange` が来る)はタイマーが発火しない

6・7 は `jest.useFakeTimers()` + `jest.advanceTimersByTime` を使う。`handleRegionChange` の150msスロットルは `Date.now()` 基準のため、フェイクタイマー使用時は `jest.setSystemTime` も進めること。

- [ ] **Step 2: 失敗を確認する**

Run: `npx jest src/ui/hooks/__tests__/useMapFollowState.test.tsx -t gridSyncRegion`
Expected: FAIL(`gridSyncRegion` が undefined)

- [ ] **Step 3: `useMapFollowState` を変更する**

1. `UseMapFollowStateResult` へ `gridSyncRegion: Region | null` を追加(JSDoc に「ユーザー操作中は更新しない」旨を書く)
2. state `gridSyncRegion` と ref `isUserMapGestureActiveRef` / `userMapGestureIdleTimeoutRef` / `latestRegionRef` を追加
3. `USER_MAP_GESTURE_IDLE_TIMEOUT_MS = 1000` を定義する
4. `scheduleUserMapGestureIdleSync()`: 既存タイマーを clear し、1000ms 後に「フラグを下ろす + `latestRegionRef.current` があれば `setGridSyncRegion`」を行うタイマーを張る
5. `clearUserMapGestureIdleSync()`: タイマーを clear する
6. `handleMapPanDrag`: フラグを立てて `scheduleUserMapGestureIdleSync()`
7. `handleRegionChange`: `latestRegionRef` を更新し、フラグが立っていなければ `setGridSyncRegion`。立っていれば `scheduleUserMapGestureIdleSync()`
8. `handleRegionChangeComplete`: `latestRegionRef` 更新 → フラグを下ろす → `clearUserMapGestureIdleSync()` → `setGridSyncRegion`
9. `centerOnCoordinate` / `prepareMapRegionRestore`: フラグを下ろす → `clearUserMapGestureIdleSync()` → `setGridSyncRegion`
10. アンマウント時にタイマーを掃除する `useEffect` を足す
11. 戻り値へ `gridSyncRegion` を追加し、フック冒頭のJSDocへも追記する

- [ ] **Step 4: 成功を確認する**

Run: `npx jest src/ui/hooks/__tests__/useMapFollowState.test.tsx`
Expected: PASS(既存テスト含め全件)

- [ ] **Step 5: AppStateProvider を接続する**

分割代入へ `gridSyncRegion` を追加し、`gridOverlayRegion` を差し替える。

```typescript
// Grid取得はユーザー操作中に走らせないため visibleRegion ではなく gridSyncRegion を使う。
const gridOverlayRegion = gridSyncRegion ?? initialRegion;
```

- [ ] **Step 6: 地図まわりの既存テストを回す**

Run: `npx jest src/ui`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
git add src/ui/hooks/useMapFollowState.ts src/ui/hooks/__tests__/useMapFollowState.test.tsx src/ui/state/AppStateProvider.tsx
git commit -m "feat(map): ユーザースクロール中のVisited Grid更新を止める"
```

---

### Task 5: `useVisitedGridOverlay` へ fresh判定・結合を結線する

**Files:**

- Modify: `src/ui/hooks/useVisitedGridOverlay.ts` / `src/ui/hooks/__tests__/useVisitedGridOverlay.test.tsx`

**Interfaces:** 戻り値の型は変更しない(`visitedGridCells` / `gridOverlayOpacity` / `incrementVisitedGridRefreshVersion`)。

**フックの構造:**

```text
取得 effect (deps: gridOverlayRegion, isReady, refreshVersion)
  bounds = getGridBoundsForRegion(region, { paddingRatio: 0.5 })   … DB取得用
  displayCellSize = getStableDisplayCellSizeMeters(...)
  取得済み範囲に収まる & データ未更新なら早期return
  cells = await getVisitedCellsInBounds(bounds, displayCellSize)
  { freshCellIds, fadingCellIds } = detectFreshVisitedCells(...)
  freshCellIds は前回の fresh とマージする(表示され続けている fresh を維持)
  setVisitedGridSource({ cells, freshCellIds, displayCellSizeMeters })

画面外判定 effect (deps: gridOverlayRegion)
  visibleBounds = getGridBoundsForRegion(region)                   … 余白なし
  evictOffscreenFreshCellIds で fresh を絞る
  変化があったときだけ state を更新する(早期returnで取得を省いた場合も動く)

coalescedVisitedGrid = useMemo(deps: visitedGridSource)
  常に coalesceVisitedGridCells を通す。100m表示は freshCellIds を渡し、200m以上は空集合を渡す

stableOverlayCells (deps: stable, opacity, color)        … フェード非依存
freshOverlayCells  (deps: fresh, opacity, color, frame)  … フェードごとに再計算
visitedGridCells = [...stableOverlayCells, ...freshOverlayCells]
```

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/hooks/__tests__/useVisitedGridOverlay.test.tsx` を書き換える。`@/features/location/grid/gridCell` と `gridAggregation` のモックは外し、実物を使う(結合結果の検証に必要なため)。`getVisitedCellsInBounds` だけモックする。

検証項目:

1. 既存: 初期は空配列 / `isReady` false では取得しない / `incrementVisitedGridRefreshVersion` で再取得する
2. `getVisitedCellsInBounds` が表示セルサイズ(100)付きで呼ばれる
3. 完全に埋まった4x4は `400:0:0` の1Polygonへ結合される
4. 結合できないデータは100mセルのPolygonとして描画される
5. 初回取得のセルはフェードせず即時表示する(`fillColor` の alpha が 0 でない)
6. 再取得で新しく現れたセルは結合されず `100:x:y` のまま残る

- [ ] **Step 2: 失敗を確認する**

Run: `npx jest src/ui/hooks/__tests__/useVisitedGridOverlay.test.tsx`
Expected: FAIL(結合されず16Polygonが返る / 取得が1引数で呼ばれる)

- [ ] **Step 3: フックを書き換える**

- state を `{ cells, freshCellIds, displayCellSizeMeters }` の1オブジェクトへまとめる
- `lastVisitedGridFetchRef` に `cellIds` と `freshCellIds` を持たせ、次回の差分判定に使う
- `syncVisitedGridFadeState(fadingCellIds)` はフェード開始時刻の登録・掃除だけを行う
- フェードタイマー effect は `coalescedVisitedGrid.freshCells` だけを見る
- 計測ログは Task 1 で入れたものを、結合後の内訳(`stableCellCount` / `freshCellCount` / `coalescedBlockCountBySize`)へ更新する

- [ ] **Step 4: 成功を確認する**

Run: `npx jest src/ui/hooks/__tests__/useVisitedGridOverlay.test.tsx src/ui`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/ui/hooks/useVisitedGridOverlay.ts src/ui/hooks/__tests__/useVisitedGridOverlay.test.tsx
git commit -m "feat(map): 新規セルのみフェードし既存セルのPolygonを結合する"
```

---

### Task 6: 200m以上の表示セルをSQLite側で集約する

**Files:**

- Modify: `src/features/location/visitedCellRepository.ts` / `src/features/location/__tests__/visitedCellRepository.test.ts`
- Modify: `src/features/location/grid/gridAggregation.ts` / `src/features/location/grid/__tests__/gridAggregation.test.ts`

**Interfaces:**

- Produces: `function getVisitedCellsInBounds(bounds: GridBounds, displayCellSizeMeters?: number): Promise<VisitedCellRow[]>`(既定値は `GRID_OVERLAY_CONFIG.baseCellSizeMeters`)

**設計メモ:** SQLite の `/` と `%` は0方向への切り捨てのため、負のセル番号で `Math.floor` とずれる。`(x - ((x % r) + r) % r) / r` で真の floor 除算にする。`floor()` 組み込み関数はビルドオプション依存なので使わない。

- [ ] **Step 1: 失敗するテストを書く**

検証項目:

1. 100m表示では従来クエリ(`WHERE x BETWEEN ? AND ?`、`GROUP BY` を含まない)
2. 200m表示では `GROUP BY blockX, blockY` / `MIN(first_visited_at)` / `MAX(last_visited_at)` / `SUM(visit_count)` を含み、戻り値が `cellId: '200:-3:4'` 形式へ変換される
3. 集約時の除算式に `((x % ?) + ?) % ?` が含まれ、bounds が末尾4パラメータになる
4. 基本セルサイズの倍数でない値(150)は reject する

`gridAggregation.test.ts` からは `aggregateVisitedCells` の import と関連 `it` を削除する。

- [ ] **Step 2: 失敗を確認する**

Run: `npx jest src/features/location/__tests__/visitedCellRepository.test.ts`
Expected: FAIL(集約SQLが生成されない)

- [ ] **Step 3: リポジトリを実装する**

`displayCellSizeMeters` を受け取り、倍数でなければ `throw`。`ratio === 1` なら従来クエリ。それ以外は集約クエリを実行する。

```typescript
{
  cellId: `${size}:${blockX}:${blockY}`,
  cellSizeMeters: size,
  x: blockX,
  y: blockY,
  firstVisitedAt,
  lastVisitedAt,
  visitCount,
}
```

`AggregatedVisitedCellRow` 型をファイル内に定義する。

- [ ] **Step 4: `aggregateVisitedCells` を削除する**

`gridAggregation.ts` から `aggregateVisitedCells` と、そこだけで使う `getEarlierIsoString` / `getLaterIsoString` / `GridCell` の import を削除する。

Run: `grep -rn "aggregateVisitedCells" src`
Expected: 出力なし

- [ ] **Step 5: 成功を確認する**

Run: `npx jest src/features/location src/ui/hooks/__tests__/useVisitedGridOverlay.test.tsx`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/features/location src/features/location/grid
git commit -m "feat(map): 200m以上の表示セルをSQLite側で集約する"
```

---

### Task 7: ドキュメント更新と全体検証

**Files:** Modify `docs/map-rendering.md`

- [ ] **Step 1: 4.2 の「隣接セルの矩形結合は…行わない」段落を差し替える**

fresh cell / stable cell の区別、整列正方形ブロック(`4x4` / `2x2`)の結合条件、未訪問セルを塗らないこと、全ズーム段階へ適用すること(200m以上では fresh を考慮しない)、任意長方形と `8x8` 以上を行わないことを記述する。

- [ ] **Step 2: 4.2 へ Grid 更新タイミングを追記する**

ユーザー操作中(`onPanDrag` 以降)はGrid取得用の表示範囲を更新しないこと、`onRegionChangeComplete` でまとめて追従すること、イベント欠落時は最後の操作から1000msのアイドルタイマーで同期すること、プログラム移動は対象外であることを記述する。

- [ ] **Step 3: 9 パフォーマンス方針へ3行追記する**

SQL側ブロック集約 / 正方形ブロックのPolygon結合 / `EXPO_PUBLIC_LOG_VISITED_GRID_METRICS` による開発時計測(座標は出力しない旨を含む)。

- [ ] **Step 4: 全体検証**

```bash
npm run typecheck
npm test
npm run lint
npm run format:check
```

Expected: typecheck 成功 / test 全件 PASS / lint error 0 / format 差分なし(あれば `npm run format` を実行して差分を含める)

- [ ] **Step 5: コミット**

```bash
git add docs/map-rendering.md
git commit -m "docs(map): Visited Gridの更新タイミングとPolygon結合方針を追記"
```

- [ ] **Step 6: 手動確認手順をPR説明用にまとめる**

1. `EXPO_PUBLIC_LOG_VISITED_GRID_METRICS=true` で起動する
2. 密集地域を100m表示で開き `[VisitedGrid] raw=… render=… reduction=…%` で `render < raw` を確認する
3. ドラッグ中に `fetchMs` / `aggregationMs` が連発せず、離した後に1回更新されることを確認する
4. 現在地ボタンで追従再開と Grid の即時追従を確認する
5. 別画面から地図へ戻ったときの表示範囲・Grid 復元を確認する

---

## 自己レビュー結果

- **issue #138 受け入れ条件との対応**: スクロール中のGrid更新停止=Task 4 / fresh cell のフェード限定=Task 2・5 / fresh の非結合と画面外での stable 化=Task 2・5 / 正方形ブロック結合=Task 3 / `8x8`・任意長方形の除外=Task 3 / 未訪問セルを塗らない=Task 3 / `renderPolygonCount < rawCellCount` の確認=Task 1・5・7 / 市松模様のフォールバック=Task 3 / SQL集約=Task 6 / ドキュメント=Task 7 / typecheck・lint・test=Task 7。
- **設計書との整合**: fresh は100m基本セルIDで保持(Task 2)、画面外判定は余白なし範囲で取得とは独立(Task 2・5)、フェード上限は結合除外に波及しない(Task 2)、アイドルタイマー(Task 4)、計測は現行経路へ先に接続(Task 1)、結合は全ズーム段階(Task 5・Task 8)。
- **`MapScreen` は変更不要**: props の形は変わらず、既存の `MapScreen.test.tsx` が回帰テストになる。
