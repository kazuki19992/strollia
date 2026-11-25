# 年間レポート「新しく塗ったエリア」地図表示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ページ8「新しく塗ったエリア」を、抽象的なマス目のサンプルから、実際の地図上にその年はじめて塗ったマスを描く表示に変える。

**Architecture:** 集計の最終ステップ(`buildPayload`)で、期間内に初めて塗った 100m マスを地図画面と同じ段階のマスへ SQL でまとめ、`newAreaMap`(セル番号の配列)を payload に保存する。ページはそれを `react-native-maps` の `Polygon` で描き、塗る件数を量子化して光らせる。共有時は地図ページとして扱い、非表示範囲にかかるマスを除く。

**Tech Stack:** Expo 58 / React Native 0.88 / expo-sqlite / react-native-maps / jest + RTL v14

**Spec:** `docs/superpowers/specs/2026-11-24-annual-report-story-design.md` §4.3, §6, §7.3

## Global Constraints

- 新しいマス最大 **150個**、前からのマス最大 **150個**。マスの段階は `GRID_OVERLAY_CONFIG.displayCellSizesMeters`(`[100, 200, 500, 1000, 2000, 5000, 10000]`)、基本セルは 100m(`GRID_OVERLAY_CONFIG.baseCellSizeMeters`)。
- 塗る演出の段階数は **20**(従来 40)。前からのマスは最初に描いたら再描画しない。
- payload の形式バージョン(`ANNUAL_REPORT_PAYLOAD_VERSION = 1`)は上げない(未リリース)。`newAreaMap` は省略可能にし、無い古いデータでは地図なしで数字と凡例だけ出す。
- SQLite の `/` `%` は0方向切り捨て。負のセル番号の floor 除算は `src/features/location/visitedCellRepository.ts` の `getVisitedCellsInBounds` と同じ式 `(x - ((x % r) + r) % r) / r` を使う。`floor()` 関数は使わない。
- GPS記録コード(`src/features/location/` の記録処理)は変更しない。読み出しクエリは `src/features/annualReport/annualReportQueries.ts` に置く。
- 規約: `@/` import、`../` 禁止、`src/ui/components/**` で `StyleSheet.create` 禁止(スタイルは `annualReportStyles.ts`)、日本語JSDoc、テスト名は日本語、RTL v14 は全て `await`。
- コミットは Semantic Commit(type/scope 英語、本文日本語)、末尾 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。develop/main へ直接コミットしない(現在のブランチのまま)。

## Review Focus

- 西半球・南半球(負のセル番号)で、まとめたマスの番号がずれないこと(SQL の floor 除算)。
- 非表示範囲の円が 10km などの大きいマスの内側にすっぽり入り、辺に触れない場合も「範囲にかかる」と判定すること(円の中心がマス内にあるか、も見る)。
- 非表示設定が壊れているときは安全側(全マスを隠す・確認ダイアログを出す)に倒れること。
- 新しいマスと同じブロックに前年までのマスもある場合、そのブロックは「新しい」扱いで `previousCells` に重複しないこと。
- `newAreaMap` が `undefined`(古い保存データ)でもページが落ちないこと。

---

### Task 1: 集計で `newAreaMap` を作って保存する

**Files:**
- Modify: `src/features/annualReport/annualReportTypes.ts`
- Modify: `src/features/annualReport/annualReportQueries.ts`
- Modify: `src/features/annualReport/annualReportAggregator.ts`
- Test: `src/features/annualReport/__tests__/annualReportQueries.test.ts`, `src/features/annualReport/__tests__/annualReportAggregator.test.ts`

**Interfaces (Produces):**
- `annualReportTypes.ts`:
  ```ts
  /** マスのセル番号 [x, y](Web Mercator、cellSizeMeters 単位)。 */
  export type AnnualReportAreaCell = [number, number];
  export type AnnualReportAreaMap = { cellSizeMeters: number; newCells: AnnualReportAreaCell[]; previousCells: AnnualReportAreaCell[] };
  // AnnualReportPayloadV1 に追加
  newAreaMap?: AnnualReportAreaMap | null;
  ```
  (注意: `annualReportVisuals.ts` に既存の `AnnualReportAreaCell`(サンプル用の 'old'|'new'|'empty')がある。Task 3 でサンプルを削除するが、名前衝突を避けるため Task 1 の時点で既存側を参照している箇所を確認し、必要なら新しい型名を `AnnualReportAreaCellIndex` にする。どちらかに統一し、以降のタスクもその名前を使う。)
- `annualReportQueries.ts`:
  - `countNewAreaBlocks(fromIso: string, toIsoExclusive: string, ratio: number): Promise<number>` — 期間内に `first_visited_at` がある 100m マスを `ratio` 倍のブロックへまとめた個数。
  - `getNewAreaBlocks(fromIso: string, toIsoExclusive: string, ratio: number, limit: number): Promise<AnnualReportAreaCell[]>` — 同じブロックを `MIN(first_visited_at) ASC`(同時刻は blockY, blockX)で `limit` 件。
  - `getPreviousAreaBlocks(fromIso: string, ratio: number, baseBounds: GridBounds, limit: number): Promise<AnnualReportAreaCell[]>` — `first_visited_at < fromIso` かつ 100m 番号が `baseBounds` 内のマスをブロックへまとめ、`SUM(visit_count) DESC` で `limit` 件。
- `annualReportAggregator.ts`: `buildPayload` が `newAreaMap` を入れる。内部関数 `loadNewAreaMap(fromIso, toIsoExclusive, newCellCount): Promise<AnnualReportAreaMap | null>`:
  1. `newCellCount === 0` なら `null`。
  2. 段階を小さい順に `countNewAreaBlocks` し、150 以下になった最初の段階を使う。どれも超えたら最大段階(10000)。
  3. `getNewAreaBlocks(..., 150)`。
  4. 新しいブロックの min/max に1ブロックの余白を足し、100m 番号の範囲 `{minX: (minBX-1)*ratio, maxX: (maxBX+2)*ratio-1, ...}` を作る。
  5. `getPreviousAreaBlocks(fromIso, ratio, bounds, 300)` から新しいブロックと同じ番号を除き、先頭 150 件。
  6. `{ cellSizeMeters, newCells, previousCells }`。

- [ ] **Step 1: クエリのテストを書く**(`annualReportQueries.test.ts` の既存の `db` モック方式に合わせる)
  - `countNewAreaBlocks` は SQL に期間条件と floor 除算式を含み、引数に `fromIso, toIsoExclusive` と ratio を渡し、`count` を返す。行が無ければ 0。
  - `getNewAreaBlocks` は `ORDER BY` に `MIN(first_visited_at)` を含み、`LIMIT ?` に limit を渡し、行 `{blockX, blockY}` を `[x, y]` に変換して返す。
  - `getPreviousAreaBlocks` は `first_visited_at < ?`、`x BETWEEN ? AND ?`、`y BETWEEN ? AND ?`、`SUM(visit_count) DESC` を含む。
- [ ] **Step 2: 失敗を確認** `npx jest src/features/annualReport/__tests__/annualReportQueries.test.ts`
- [ ] **Step 3: 3クエリを実装**
- [ ] **Step 4: 集計のテストを書く**(`annualReportAggregator.test.ts` の既存クエリモックに3関数を追加)
  - 新しいマスが0なら `newAreaMap` は `null` で、ブロック系クエリを呼ばない。
  - 100m で 150 を超え 200m で 150 以下なら `cellSizeMeters: 200`、`getNewAreaBlocks` に ratio 2 と limit 150。
  - 全段階で超えたら `cellSizeMeters: 10000`。
  - `previousCells` から `newCells` と同じ番号を除き、150件までにする。
  - `getPreviousAreaBlocks` に渡す範囲が新しいブロックの範囲＋1ブロック分の余白(100m 番号)になっている(負の番号を含むケースも1つ)。
- [ ] **Step 5: 失敗を確認 → 実装 → 通過を確認**
- [ ] **Step 6: コミット** `feat(annual-report): 新しく塗ったエリアの地図用マスを集計して保存する`

### Task 2: 非表示範囲の判定と、地図ページとしての共有

**Files:**
- Modify: `src/features/annualReport/annualReportVisuals.ts`, `src/features/annualReport/annualReportPages.ts`
- Modify: `src/ui/components/annualReport/AnnualReportScreen.tsx`
- Test: `src/features/annualReport/__tests__/annualReportVisuals.test.ts`, `src/features/annualReport/__tests__/annualReportPages.test.ts`, `src/ui/components/annualReport/__tests__/AnnualReportScreen.test.tsx`

**Interfaces:**
- Consumes: Task 1 の `AnnualReportAreaMap`。
- Produces (`annualReportVisuals.ts`):
  - `areaCellToPolygon(cell: AnnualReportAreaCell, cellSizeMeters: number): AnnualReportCoordinate[]` — `cellToPolygonCoordinates`(`@/features/location/grid/gridCell`)で4頂点。
  - `isAreaCellHiddenByPrivacy(cell, cellSizeMeters, stayPlaces: StayPlace[]): boolean` — マスの外周(始点に戻る閉じた線)に `hasPrivacyRadiusInSegments` が true、または非表示半径を持つ滞在場所の中心がマスの緯度経度範囲内なら true。設定が壊れていれば `hasPrivacyRadiusInSegments` が true を返すのでそのまま true。
  - `hideAreaMapCellsByPrivacy(areaMap: AnnualReportAreaMap, stayPlaces: StayPlace[]): AnnualReportAreaMap` — new/previous から隠すマスを除く。
  - `hasPrivacyRadiusInAreaMap(areaMap: AnnualReportAreaMap, stayPlaces: StayPlace[]): boolean`。
- `annualReportPages.ts`: `MAP_PAGE_IDS` に `'newAreas'` を追加。
- `AnnualReportScreen.tsx`: 確認ダイアログ判定を「ページごとに非表示範囲にかかるか」の関数にまとめ、`newAreas` では `payload.newAreaMap` があれば `hasPrivacyRadiusInAreaMap`、無ければ false。撮影時(`capture.hiddenStayPlaces` あり)は `hideAreaMapCellsByPrivacy` 済みの `areaMap` を作り、Task 3 のページへ `areaMap` prop で渡す(`yearSegments` と同じ useMemo の形)。

- [ ] **Step 1: visuals のテスト** — 中心が大きいマス(10000m)の内側にあり辺に触れない円でも隠す / 遠い滞在場所では隠さない / `privacyRadiusMeters: null` の滞在場所は無視 / 壊れた設定では全マス隠す / `hasPrivacyRadiusInAreaMap` が new/previous のどちらでも true。
- [ ] **Step 2: pages のテスト** — `isMapPage('newAreas')` が true。
- [ ] **Step 3: 失敗確認 → 実装 → 通過確認**
- [ ] **Step 4: 画面のテスト**(既存の `react-native-maps` モックと共有テストの書き方に合わせる) — `newAreas` ページで、マスが非表示範囲にかかると共有前に確認ダイアログが出る / かからなければ出ずに共有する。
- [ ] **Step 5: 失敗確認 → 実装 → 通過確認**
- [ ] **Step 6: コミット** `feat(annual-report): 新しく塗ったエリアのページも共有時に非表示範囲を確認する`

### Task 3: ページを地図表示にする

**Files:**
- Modify: `src/ui/components/annualReport/AnnualReportNewAreasPage.tsx`, `src/ui/components/annualReport/annualReportStyles.ts`
- Modify: `src/features/annualReport/annualReportVisuals.ts`(サンプル用 `buildAreaSampleCells` と関連型・定数・テストを、使われなくなったら削除)
- Test: `src/ui/components/annualReport/__tests__/AnnualReportScreen.test.tsx`

**Interfaces:**
- Consumes: Task 2 の `areaCellToPolygon`、画面から渡す `areaMap`。
- Produces: `AnnualReportNewAreasPageProps = AnnualReportPageProps & { /** 描くマス。隠して共有では非表示範囲を除いたもの。null/undefined なら地図なし。 */ areaMap: AnnualReportAreaMap | null }`

実装方針:
- 地図は `AnnualReportRouteMap`(`segments={[]}`、`regionCoordinates` に新しいマスの全頂点)を全面背景にし、children に Polygon を描く(最遠日ページと同じ配置。文字は上、凡例は `contentBottom` を使って下)。
- 前からのマス: `useMemo` で Polygon 要素の配列を一度だけ作る(`fillColor` は `annualReportColors.cellOld`、`strokeWidth={0}`)。演出で再描画しない。
- 新しいマス: key をセル番号から作り(色が変わってもマウントし直さない)、既存の `resolveCellColor` と同じ規則(未塗りは描かない、塗った直後 `#ffffff`、落ち着いたら `annualReportColors.accent`)。未塗りのマスは描かないか透明にする。
- `PAINT_STEPS = 20`。`quantizeRevealCount` と `PAINT_START_MS`/`FLASH_MS`/`PAINT_INTERVAL_MAX_MS`/`PAINT_TOTAL_MS` の考え方は流用。
- `areaMap` が無いときは、見出し・カウントアップ・凡例だけ(マス目のサンプルは出さない)。

- [ ] **Step 1: 画面のテスト** — `newAreaMap` ありの payload で newAreas ページを開くと、モックした Polygon が `newCells.length + previousCells.length` 個まで描かれ(完了状態)、隠して共有で撮影するときは非表示範囲のマスが減っている / `newAreaMap` 無しの payload でも見出しと数が出て落ちない。
- [ ] **Step 2: 失敗確認 → 実装 → 通過確認**
- [ ] **Step 3: 未使用になったサンプル関数・型・テスト・スタイル(`cells` など)を削除**
- [ ] **Step 4: 全体確認** `npm run typecheck` / `npm run lint`(error 0) / `npx jest --maxWorkers=50%`
- [ ] **Step 5: コミット** `feat(annual-report): 新しく塗ったエリアを地図の上に描く`
