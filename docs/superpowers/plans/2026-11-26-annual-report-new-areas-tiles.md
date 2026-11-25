# 年間レポート: エリアページの斜め見下ろしタイル化と実績ページの調整 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ページ8(新しく塗ったエリア)を、地図を使わない「斜めから見下ろしたタイルの広場」と身近な広さの比較に作り直し、ページ9(実績)の金色の丸座布団をやめて件数超過時の「ほか N 件」を出す。

**Architecture:** 面積は集計時に緯度ごとのセル数から実面積(m²)を求めて payload に保存し、比較対象の選択は純粋関数にする。タイルは最大100枚に間引き/まとめ、1枚の板(コンテナ)に `perspective` + `rotateX` + `rotateZ` をかけて斜め見下ろしにする(タイル個別に transform しない)。塗りは従来どおり段階数を絞った静的スタイルの切り替えで描く。

**Tech Stack:** Expo 58 / RN 0.88 (New Architecture) / TypeScript / jest + RTL v14

**Spec:** `docs/superpowers/specs/2026-11-24-annual-report-story-design.md`(本計画の Task 4 で §ページ8・9 を更新する)

## Global Constraints

- 文言・テスト名は日本語。`@/` import、`../` 禁止、`src/ui/components/**` で `StyleSheet.create` 禁止(スタイルは `annualReportStyles.ts`)。
- 1ページ7秒(`STORY_PAGE_DURATION_MS`)。ページ内の演出はすべて **4.8秒以内** に終える。
- 描画するタイルは **最大100枚**。マス数に比例して View を増やさない。
- 地図(react-native-maps)は使わない。位置は描かないので、ページ8は共有時の非表示範囲確認の対象外のまま。
- GPS記録・地図画面のコードには触れない。payload の `version` は 1 のまま、追加フィールドは optional。
- 太字をデフォルトにしない。各関数・型に日本語 JSDoc。
- 作業後に `npm run typecheck` / `npx jest --maxWorkers=50%` / `npm run lint`(error 0)。

## Review Focus

- 新しいエリアが 0 件: ページ自体が出ない(既存のページ判定)。面積関数は 0 を渡されても例外にしない。
- 1〜数件しかない: 最小の比較対象(サッカーコート)未満でも「サッカーコート約0.3面分」のように小数で出す。
- 非常に多い(10万マス超): タイルは100枚のまま、1枚あたりの代表マス数が増えるだけで描画負荷は変わらない。
- 古い保存データ(`newAreaSquareMeters` が無い): `newCellCount` から日本付近の緯度(35°)で概算して表示する。
- 実績・スポット合計が3件以下: 「ほか N 件」を出さない。

---

### Task 1: 新しいエリアの実面積を集計して保存する

**Files:**
- Modify: `src/features/annualReport/annualReportQueries.ts`, `src/features/annualReport/annualReportAggregator.ts`, `src/features/annualReport/annualReportTypes.ts`
- Create: `src/features/annualReport/annualReportArea.ts`
- Test: `src/features/annualReport/__tests__/annualReportQueries.test.ts`, `__tests__/annualReportAggregator.test.ts`, `__tests__/annualReportArea.test.ts`

**Interfaces:**
- Produces: `getNewCellCountsByRow(fromIso: string, toIsoExclusive: string): Promise<{ cellSizeMeters: number; y: number; count: number }[]>` — `SELECT cell_size_meters, y, COUNT(*) ... WHERE first_visited_at >= ? AND first_visited_at < ? GROUP BY cell_size_meters, y`(列名は `visited_cells` の実スキーマに合わせる)。
- Produces: `cellRowGroundAreaSquareMeters(cellSizeMeters: number, y: number): number` — Web Mercator の Y 番号から中心緯度を求め、`(cellSizeMeters * cos(lat))²` を返す。`sumGroundAreaSquareMeters(rows): number`。
- Produces: `AnnualReportPayloadV1.newAreaSquareMeters?: number`(JSDoc: 地表での実面積 m²。古い保存データには無い)。

- [ ] テスト: 赤道付近(y=0)の100mセル1件は 10,000m²、緯度35°付近の行は約6,700m²(±1%)、複数行の合計。クエリは渡した期間で GROUP BY することを検証。集計結果の payload に `newAreaSquareMeters` が入ること。
- [ ] 失敗を確認 → 実装 → 通過を確認 → コミット `feat(annual-report): 新しく塗ったエリアの実面積を集計して保存する`

### Task 2: 面積を身近な広さに置き換える

**Files:**
- Modify: `src/features/annualReport/annualReportCopy.ts`
- Test: `src/features/annualReport/__tests__/annualReportCopy.test.ts`

**Interfaces:**
- Produces: `type AreaComparison = { label: string; value: number; suffix: string }`、`resolveAreaComparison(squareMeters: number): AreaComparison`、`resolveNewAreaSquareMeters(payload): number`(`newAreaSquareMeters` が無ければ `newCellCount * 6_700`)。
- 比較対象(大きい順に並べ、`value >= 1` になる最大のものを採用。どれも1未満ならサッカーコートの小数):

| label | 基準 m² | 表示例 |
| --- | --- | --- |
| 四国 | 18_800_000_000 | 四国の約1.2倍 |
| 東京都 | 2_194_000_000 | 東京都の約1.5倍 |
| 琵琶湖 | 669_000_000 | 琵琶湖の約1.3倍 |
| 東京23区 | 627_000_000 | (琵琶湖と近いので採用しない。表に載せない) |
| 山手線の内側 | 63_000_000 | 山手線の内側の約2.1倍 |
| 皇居 | 1_150_000 | 皇居の約2.8倍 |
| 東京ドーム | 46_755 | 東京ドーム 約104個分 |
| サッカーコート | 7_140 | サッカーコート 約3.4面分 |

  東京23区の行は表から除く(琵琶湖と同規模のため)。地域・皇居は「〇〇の約X倍」、東京ドームは「〇〇 約X個分」、サッカーコートは「約X面分」。value は 10 以上なら整数、未満なら小数1桁。
- [ ] テスト: 各境目ちょうど・直前、0、0.5面、古いデータの概算。→ 失敗確認 → 実装 → 通過 → コミット `feat(annual-report): 新しいエリアの広さを身近な場所に置き換える`

### Task 3: タイルの間引き・まとめ方を決める純粋関数

**Files:**
- Modify: `src/features/annualReport/annualReportVisuals.ts`(旧 `buildAreaSampleCells` 等、ページ8でしか使わないものは削除)
- Test: `src/features/annualReport/__tests__/annualReportVisuals.test.ts`

**Interfaces:**
- Produces: `buildAreaTileLayout(cellCount: number, maxTiles = 100): { columns: number; rows: number; tileCount: number; cellsPerTile: number }`
  - `tileCount = min(cellCount, maxTiles)`、`cellsPerTile = ceil(cellCount / tileCount)`、`columns = ceil(sqrt(tileCount))`、`rows = ceil(tileCount / columns)`(正方形に近い形)。0件は全部0。
- [ ] テスト: 1件→1×1、7件→3列3行で7枚、100件→10×10、487件→100枚・1枚5マス、100万件→100枚。→ 実装 → コミット `feat(annual-report): エリアのタイルを最大100枚にまとめる配置を追加`

### Task 4: ページ8を斜め見下ろしのタイル広場にする

**Files:**
- Modify: `src/ui/components/annualReport/AnnualReportNewAreasPage.tsx`, `annualReportStyles.ts`, `src/features/annualReport/annualReportCopy.ts`(必要なら文言関数)
- Modify docs: `docs/superpowers/specs/2026-11-24-annual-report-story-design.md`(ページ8の行と §集計の「表示用のサンプル」を本計画の内容に更新)
- Test: `src/ui/components/annualReport/__tests__/AnnualReportScreen.test.tsx`

**画面:**
- 見出し「新しく塗ったエリア」、本文「新しく `N` エリアに\n訪れました！」(N はカウントアップ)。
- 中央にタイルの広場: 1枚の板(View)に `transform: [{ perspective: 800 }, { rotateX: '55deg' }, { rotateZ: '45deg' }]` をかけ、中にタイルを `columns × rows` の格子で並べる。タイルは正方形・角丸2・隙間2。各タイルに厚み感を出すため右と下に暗い縁(`borderRightWidth`/`borderBottomWidth` 2、`accentDeep`)。板は画面幅に収まるよう一辺を `min(画面幅 - 余白×2, 280)` 程度にする。
- 比較の一文: 「`皇居の約2.8倍` の広さです」をアクセント色で(ラベルと数値のみアクセント、太字にしない)。下に小さく「約3.3km²」(1km² 未満は「約0.4km²」のように小数1桁、0.1 未満は m² を千の位で丸めて表示)。
- 凡例・前年までのマスは出さない。

**タイムライン(すべて 4.8 秒以内):**
- 0〜: 見出し・本文が既存の `RISE_DELAYS_MS` で上がる。
- 900ms〜3,300ms: タイルを手前から奥へ斜めの波(`column + row` の小さい順)で塗る。塗った直後は白、500ms 後に `accent`。`quantizeRevealCount` を使い **段階数 16** で静的スタイルを切り替える(タイル個別に Animated を作らない)。
- 900ms〜3,300ms: N のカウントアップ。
- 3,600ms: 比較の一文と km² を `AnnualReportRise` で上げる。

- [ ] テスト(画面テスト): 487 マス(`newAreaSquareMeters` 3,263,000)の payload でページ8を開き、十分時間を進めると「新しく 487 エリアに」相当の文言、「皇居の約2.8倍」、タイルが100枚(testID `annual-report-area-tile` の数)、`newAreaSquareMeters` 無しの payload でも比較文が出ること。
- [ ] 失敗確認 → 実装 → 通過 → コミット `feat(annual-report): 新しく塗ったエリアを斜めから見たタイルと広さの比較で見せる`

### Task 5: ページ9の金色の丸座布団をやめ、「ほか N 件」を出す

**Files:**
- Modify: `src/ui/components/annualReport/AnnualReportAchievementsPage.tsx`, `annualReportStyles.ts`
- Test: `src/ui/components/annualReport/__tests__/AnnualReportScreen.test.tsx` または同ディレクトリの既存の実績ページテスト

**Interfaces:**
- Produces: `resolveRemainingTrophyCount(payload, shown: number): number` = `achievements.count + spots.count - shown`(0未満は0)。
- `trophyIcon` の背景色・枠線をやめ、トロフィー画像を 52×52 で直接表示。スポットは `map-marker-star` を `accent` 色 36 で。光る輪(`trophyGlow`)は残すが色を `accent` 系の半透明に変える。
- 残りが1件以上なら、トロフィー3件の下に「ほか N 件」(`subtle` 色、15px)を最後のトロフィーが落ちた後(`DROP_START_MS + 3 × DROP_INTERVAL_MS`)に `AnnualReportRise` で出す。
- 使わなくなった `trophyOuter` / `trophyInner` を削除。
- [ ] テスト: 実績10・スポット3 → 「ほか 10 件」、合計3件 → 出ない。→ 実装 → コミット `fix(annual-report): 実績ページの金色の丸を外し、表示しきれない件数を出す`
