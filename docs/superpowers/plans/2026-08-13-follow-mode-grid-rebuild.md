# 追従モード中のVisited Grid全再生成を抑える 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 追従モードで歩いている間、visited cell の集合に変化がなければ Visited Grid の Polygon を再生成しないようにする。

**Architecture:** DB取得結果の表示セルサイズと表示セルID集合が前回と同一で、かつ fresh cell の検出がなければ `useVisitedGridOverlay` の state 更新をスキップし、後続の Polygon 結合・座標変換・Polygon生成を一切走らせない。あわせて `MapScreen` の Polygon 要素配列を `useMemo` 化し、追従中の再レンダーで Polygon サブツリーの再構築も止める。判定と整形はすべて `src/features/map/` の純粋関数へ切り出し、単体テストで固定する。

**Tech Stack:** TypeScript 6.0 (strict) / React 19.2 / React Native 0.86 / Expo ~57 / expo-sqlite / react-native-maps / jest + jest-expo + @testing-library/react-native

**設計書:** `docs/superpowers/specs/2026-08-13-follow-mode-grid-rebuild-design.md`(承認済み)
**対象issue:** [#151](https://github.com/kazuki19992/strollia/issues/151)

## Global Constraints

- GPS記録、バックグラウンド記録、`visited_cells` の保存・upsert、100mセルの永続的な意味には**触れない**。変更は表示層に閉じる
- 再取得の頻度は変えない。`getVisitedCellsInBounds` の呼び出し自体は従来どおり毎回行う
- 取得effectの依存配列・早期リターン条件(`coveredByLastFetch`)・`boundsPaddingRatio`・fresh検出・フェード・Polygon結合のロジックは変更しない
- 同一性判定に `visitCount` / `firstVisitedAt` / `lastVisitedAt` を**含めてはいけない**。現在地セルのこれらの値はGPS記録のたびに更新されるため、含めると最適化が成立しない
- [#152](https://github.com/kazuki19992/strollia/issues/152)(Android旧Polygon残留)は本変更では解消しない。Android実機での重複描画検証は本計画のスコープ外
- 追加する開発用ログは `developmentFlags.logVisitedGridMetrics` でゲートし、座標・cellId は一切出力しない
- import は `@/` エイリアスを使う(`../` 始まりの相対 import は ESLint error)。`jest.mock` のパス文字列も同じルール
- テストの `describe` / `test` / `it` の説明文は日本語で書く
- 関数・型・自明でない変数には日本語JSDocを付ける
- 各タスクの最後に `npx prettier --write <変更ファイル>` を実行してからコミットする。リポジトリ標準は `npm run format` / `npm run lint`(リポジトリ全体)だが、タスク単位では変更ファイルへスコープした `npx prettier --write` / `npx eslint <ファイル>` を使い、リポジトリ全体の `npm run lint` と `npm run format:check` は Task 5 の全体検証でまとめて通す
- コミットメッセージは `type(scope): 日本語の説明` 形式

---

## File Structure

| ファイル                                                 | 区分 | 責務                                                                      |
| -------------------------------------------------------- | ---- | ------------------------------------------------------------------------- |
| `src/features/map/visitedGridIdentity.ts`                | 新規 | 取得結果の同一性判定と更新スキップ判定(純粋関数)                          |
| `src/features/map/__tests__/visitedGridIdentity.test.ts` | 新規 | 上記の単体テスト                                                          |
| `src/features/map/visitedGridMetrics.ts`                 | 変更 | 更新/スキップを観測する開発用ログの型・整形・出力を追加                   |
| `src/features/map/__tests__/visitedGridMetrics.test.ts`  | 変更 | 追加した整形関数のテスト                                                  |
| `src/ui/hooks/useVisitedGridOverlay.ts`                  | 変更 | 取得effectへスキップ判定とログを結線                                      |
| `src/ui/hooks/__tests__/useVisitedGridOverlay.test.tsx`  | 変更 | スキップ/更新の振る舞いテストを追加。既存モックへ新関数を追加             |
| `src/ui/components/MapScreen.tsx`                        | 変更 | Polygon 要素配列を `useMemo` 化                                           |
| `src/ui/components/__tests__/MapScreen.test.tsx`         | 変更 | Polygon の再レンダー有無のテストを追加。Polygonモックへレンダー計数を追加 |
| `docs/map-rendering.md`                                  | 変更 | §4.2 / §9 へ更新スキップ・メモ化・`source=` ログを追記                    |

---

### Task 1: 同一性判定の純粋関数

**Files:**

- Create: `src/features/map/visitedGridIdentity.ts`
- Test: `src/features/map/__tests__/visitedGridIdentity.test.ts`

**Interfaces:**

- Consumes: `GridCellPolygonSource`(`@/features/location/grid/gridCell`)。`{ cellId: string; cellSizeMeters: number; x: number; y: number; firstVisitedAt?: string; lastVisitedAt?: string; visitCount?: number }`
- Produces:
  - `hasSameVisitedGridCellIds(previousCellIds: ReadonlySet<string>, nextCells: readonly GridCellPolygonSource[]): boolean`
  - `canSkipVisitedGridSourceUpdate(params: CanSkipVisitedGridSourceUpdateParams): boolean`
  - `type PreviousVisitedGridFetchSummary = { cellIds: ReadonlySet<string>; cellSizeMeters: number }`
  - `type CanSkipVisitedGridSourceUpdateParams = { previousFetch: PreviousVisitedGridFetchSummary | null; nextCells: readonly GridCellPolygonSource[]; displayCellSizeMeters: number; detectedFreshCellIds: ReadonlySet<string> }`

- [ ] **Step 1: 失敗するテストを書く**

`src/features/map/__tests__/visitedGridIdentity.test.ts` を新規作成する。

```typescript
import type { GridCellPolygonSource } from '@/features/location/grid/gridCell';
import { canSkipVisitedGridSourceUpdate, hasSameVisitedGridCellIds } from '@/features/map/visitedGridIdentity';

/** テスト用の表示セルを作る。メタデータは同一性判定の対象外であることを示すため引数で差し替えられる。 */
function makeCell(x: number, y: number, metadata: Partial<GridCellPolygonSource> = {}): GridCellPolygonSource {
  return {
    cellId: `100:${x}:${y}`,
    cellSizeMeters: 100,
    x,
    y,
    firstVisitedAt: '2026-08-01T00:00:00.000Z',
    lastVisitedAt: '2026-08-01T00:00:00.000Z',
    visitCount: 1,
    ...metadata,
  };
}

describe('表示セル同一性判定 hasSameVisitedGridCellIds', () => {
  it('同じセルIDの集合なら順序が違ってもtrueを返す', () => {
    const previousCellIds = new Set(['100:1:1', '100:2:2', '100:3:3']);
    const nextCells = [makeCell(3, 3), makeCell(1, 1), makeCell(2, 2)];

    expect(hasSameVisitedGridCellIds(previousCellIds, nextCells)).toBe(true);
  });

  it('セルIDが同じでメタデータだけ違う場合もtrueを返す', () => {
    // 現在地セルの visit_count / last_visited_at はGPS記録のたびに更新される。
    // これを差分として扱うと更新スキップがほぼ成立しなくなるため、判定対象から外す仕様。
    const previousCellIds = new Set(['100:1:1']);
    const nextCells = [makeCell(1, 1, { visitCount: 99, lastVisitedAt: '2026-08-13T12:00:00.000Z' })];

    expect(hasSameVisitedGridCellIds(previousCellIds, nextCells)).toBe(true);
  });

  it('件数が同じでもセルIDが1つ違えばfalseを返す', () => {
    const previousCellIds = new Set(['100:1:1', '100:2:2']);
    const nextCells = [makeCell(1, 1), makeCell(9, 9)];

    expect(hasSameVisitedGridCellIds(previousCellIds, nextCells)).toBe(false);
  });

  it('セルが増えた場合はfalseを返す', () => {
    const previousCellIds = new Set(['100:1:1']);
    const nextCells = [makeCell(1, 1), makeCell(2, 2)];

    expect(hasSameVisitedGridCellIds(previousCellIds, nextCells)).toBe(false);
  });

  it('セルが減った場合はfalseを返す', () => {
    const previousCellIds = new Set(['100:1:1', '100:2:2']);
    const nextCells = [makeCell(1, 1)];

    expect(hasSameVisitedGridCellIds(previousCellIds, nextCells)).toBe(false);
  });

  it('前回も今回も0件ならtrueを返す', () => {
    expect(hasSameVisitedGridCellIds(new Set<string>(), [])).toBe(true);
  });
});

describe('更新スキップ判定 canSkipVisitedGridSourceUpdate', () => {
  /** 判定がtrueになる既定の引数。各テストで1条件だけ崩して使う。 */
  function makeSkippableParams() {
    return {
      previousFetch: { cellIds: new Set(['100:1:1', '100:2:2']), cellSizeMeters: 100 },
      nextCells: [makeCell(1, 1), makeCell(2, 2)],
      displayCellSizeMeters: 100,
      detectedFreshCellIds: new Set<string>(),
    };
  }

  it('前回取得と同じセルID集合でfresh検出が0件ならtrueを返す', () => {
    expect(canSkipVisitedGridSourceUpdate(makeSkippableParams())).toBe(true);
  });

  it('初回取得(previousFetchがnull)ではfalseを返す', () => {
    expect(canSkipVisitedGridSourceUpdate({ ...makeSkippableParams(), previousFetch: null })).toBe(false);
  });

  it('表示セルサイズが前回と違う場合はfalseを返す', () => {
    expect(canSkipVisitedGridSourceUpdate({ ...makeSkippableParams(), displayCellSizeMeters: 200 })).toBe(false);
  });

  it('fresh検出が1件でもあればfalseを返す', () => {
    const params = { ...makeSkippableParams(), detectedFreshCellIds: new Set(['100:5:5']) };

    expect(canSkipVisitedGridSourceUpdate(params)).toBe(false);
  });

  it('セルIDの集合が変わっていればfalseを返す', () => {
    const params = { ...makeSkippableParams(), nextCells: [makeCell(1, 1), makeCell(2, 2), makeCell(3, 3)] };

    expect(canSkipVisitedGridSourceUpdate(params)).toBe(false);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test -- src/features/map/__tests__/visitedGridIdentity.test.ts`
Expected: FAIL(`Cannot find module '@/features/map/visitedGridIdentity'`)

- [ ] **Step 3: 実装を書く**

`src/features/map/visitedGridIdentity.ts` を新規作成する。

```typescript
import type { GridCellPolygonSource } from '@/features/location/grid/gridCell';

/** 更新スキップ判定に使う直近取得の要約。 */
export type PreviousVisitedGridFetchSummary = {
  /** 前回取得できた表示セルID。 */
  cellIds: ReadonlySet<string>;
  /** 前回取得時の表示セルサイズ。単位はm。 */
  cellSizeMeters: number;
};

/** `canSkipVisitedGridSourceUpdate` の引数。 */
export type CanSkipVisitedGridSourceUpdateParams = {
  /** 直近取得の要約。初回取得ならnull。 */
  previousFetch: PreviousVisitedGridFetchSummary | null;
  /** 今回取得した表示セル。 */
  nextCells: readonly GridCellPolygonSource[];
  /** 今回の表示セルサイズ。単位はm。 */
  displayCellSizeMeters: number;
  /** 今回fresh(GPS記録で新しく開いた)と判定されたセルID。 */
  detectedFreshCellIds: ReadonlySet<string>;
};

/**
 * 前回取得の表示セルID集合と今回の取得結果が同一かを返す。
 *
 * 比較対象はセルIDだけで、`visitCount` / `firstVisitedAt` / `lastVisitedAt` は見ない。
 * 現在地セルのこれらの値はGPS記録のたびに更新されるため、比較へ含めると「変化なし」と
 * 判定できる回がほぼなくなり、更新スキップによる軽量化が成立しなくなる。
 * 描画側(`toVisitedGridOverlayCells` → MapView Polygon)はセルIDと座標・テーマ色だけを
 * 使うため、セルID集合が同じなら描画結果も同一である。
 *
 * 将来メタデータを描画へ反映する場合は、この判定も合わせて見直すこと。
 *
 * 取得結果のセルIDはSQLの `GROUP BY` により一意なため、件数一致と包含だけで集合の一致と等価になる。
 *
 * @param previousCellIds - 前回取得できた表示セルID。
 * @param nextCells - 今回取得した表示セル。
 * @returns セルID集合が同一ならtrue。
 */
export function hasSameVisitedGridCellIds(previousCellIds: ReadonlySet<string>, nextCells: readonly GridCellPolygonSource[]): boolean {
  if (previousCellIds.size !== nextCells.length) {
    return false;
  }

  for (const cell of nextCells) {
    if (!previousCellIds.has(cell.cellId)) {
      return false;
    }
  }

  return true;
}

/**
 * 今回の取得結果で描画データの更新を省略してよいかを返す。
 *
 * 追従モード中は現在地更新のたびに再取得が走るが、その大半は表示セルの集合が変わらない。
 * 変わらない回の state 更新を止めることで、Polygon結合・座標変換・Polygon生成を丸ごと省く。
 *
 * @param params - 直近取得の要約と今回の取得結果。
 * @returns 更新を省略してよいならtrue。
 */
export function canSkipVisitedGridSourceUpdate({
  previousFetch,
  nextCells,
  displayCellSizeMeters,
  detectedFreshCellIds,
}: CanSkipVisitedGridSourceUpdateParams): boolean {
  // 初回取得は比較対象がないため必ず更新する。
  if (!previousFetch) {
    return false;
  }

  // 表示セルサイズが変わるとセルIDの体系ごと変わるため、必ず作り直す。
  if (previousFetch.cellSizeMeters !== displayCellSizeMeters) {
    return false;
  }

  // freshは結合除外とフェードの対象になるため、検出があれば必ず更新する。
  if (detectedFreshCellIds.size > 0) {
    return false;
  }

  return hasSameVisitedGridCellIds(previousFetch.cellIds, nextCells);
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm test -- src/features/map/__tests__/visitedGridIdentity.test.ts`
Expected: PASS(11テスト)

- [ ] **Step 5: 整形してコミットする**

```bash
npx prettier --write src/features/map/visitedGridIdentity.ts src/features/map/__tests__/visitedGridIdentity.test.ts
git add src/features/map/visitedGridIdentity.ts src/features/map/__tests__/visitedGridIdentity.test.ts
git commit -m "feat(map): visited grid取得結果の同一性判定を追加"
```

---

### Task 2: 更新/スキップを観測する開発用ログ

**Files:**

- Modify: `src/features/map/visitedGridMetrics.ts`(末尾へ追記)
- Test: `src/features/map/__tests__/visitedGridMetrics.test.ts`(末尾へ追記)

**Interfaces:**

- Consumes: `developmentFlags`(`@/config/developmentFlags`)。既存の `logVisitedGridMetrics` と同じフラグ `developmentFlags.logVisitedGridMetrics` を使う
- Produces:
  - `type VisitedGridSourceUpdateOutcome = 'updated' | 'skipped'`
  - `type VisitedGridSourceUpdateMetrics = { outcome: VisitedGridSourceUpdateOutcome; cellCount: number; updatedCount: number; skippedCount: number }`
  - `formatVisitedGridSourceUpdate(metrics: VisitedGridSourceUpdateMetrics): string`
  - `logVisitedGridSourceUpdate(metrics: VisitedGridSourceUpdateMetrics): void`

- [ ] **Step 1: 失敗するテストを書く**

`src/features/map/__tests__/visitedGridMetrics.test.ts` の**末尾**(既存の `describe` の後ろ)へ追加する。ファイル冒頭の import 文へ `formatVisitedGridSourceUpdate` を追加すること。

```typescript
describe('取得結果の更新/スキップログ formatVisitedGridSourceUpdate', () => {
  it('スキップした回は source=skipped と累計値を含む1行を返す', () => {
    const line = formatVisitedGridSourceUpdate({ outcome: 'skipped', cellCount: 1234, updatedCount: 3, skippedCount: 57 });

    expect(line).toBe('[VisitedGrid] source=skipped cells=1234 updated=3 skipped=57');
  });

  it('更新した回は source=updated になる', () => {
    const line = formatVisitedGridSourceUpdate({ outcome: 'updated', cellCount: 10, updatedCount: 1, skippedCount: 0 });

    expect(line).toBe('[VisitedGrid] source=updated cells=10 updated=1 skipped=0');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test -- src/features/map/__tests__/visitedGridMetrics.test.ts`
Expected: FAIL(`formatVisitedGridSourceUpdate is not a function`)

- [ ] **Step 3: 実装を書く**

`src/features/map/visitedGridMetrics.ts` の**末尾**へ追加する。既存の `VisitedGridMetrics` / `logVisitedGridMetrics` は変更しない。

```typescript
/** `visitedGridSource` を更新したか、同一結果としてスキップしたか。 */
export type VisitedGridSourceUpdateOutcome = 'updated' | 'skipped';

/**
 * 1回の取得で描画データを更新したか、スキップしたかの計測値。
 *
 * 既存の `VisitedGridMetrics` は描画データが変わったときにしか出力されないため、
 * スキップした回を観測できない。ログの少なさが「位置更新が来なかった」のか
 * 「取得したうえでスキップした」のかを区別するために、取得のたびに1行出す。
 */
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

/**
 * 更新/スキップの計測値を1行のログ文字列へ整形する。
 *
 * @param metrics - 計測値。
 * @returns 開発ログ用の1行文字列。
 */
export function formatVisitedGridSourceUpdate(metrics: VisitedGridSourceUpdateMetrics): string {
  return [
    '[VisitedGrid]',
    `source=${metrics.outcome}`,
    `cells=${metrics.cellCount}`,
    `updated=${metrics.updatedCount}`,
    `skipped=${metrics.skippedCount}`,
  ].join(' ');
}

/**
 * 開発フラグが有効な場合だけ更新/スキップの計測値を出力する。
 *
 * @param metrics - 計測値。
 * @returns なし。
 */
export function logVisitedGridSourceUpdate(metrics: VisitedGridSourceUpdateMetrics): void {
  if (!developmentFlags.logVisitedGridMetrics) {
    return;
  }

  console.log(formatVisitedGridSourceUpdate(metrics));
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm test -- src/features/map/__tests__/visitedGridMetrics.test.ts`
Expected: PASS(既存テスト + 追加2テスト)

- [ ] **Step 5: 整形してコミットする**

```bash
npx prettier --write src/features/map/visitedGridMetrics.ts src/features/map/__tests__/visitedGridMetrics.test.ts
git add src/features/map/visitedGridMetrics.ts src/features/map/__tests__/visitedGridMetrics.test.ts
git commit -m "feat(map): visited grid更新/スキップの開発用ログを追加"
```

---

### Task 3: フックへスキップ判定を結線する

**Files:**

- Modify: `src/ui/hooks/useVisitedGridOverlay.ts:1-11`(import)、`:116-123`(ref追加箇所の近く)、`:220-260`(取得effectの `.then`)
- Test: `src/ui/hooks/__tests__/useVisitedGridOverlay.test.tsx`(モック更新 + テスト追加)

**Interfaces:**

- Consumes: Task 1 の `canSkipVisitedGridSourceUpdate`、Task 2 の `logVisitedGridSourceUpdate`
- Produces: フックの公開APIは変更しない(`visitedGridCells` / `gridOverlayOpacity` / `incrementVisitedGridRefreshVersion`)

**重要:** 既存テストの `jest.mock('@/features/map/visitedGridMetrics', ...)` は `logVisitedGridMetrics` しか定義していない。新しい import を足すとモックが `undefined` を返して `TypeError` になるため、**Step 1 でモックを先に更新すること**。

**既存テストで担保済みのケース:** 設計書 §5.3 が挙げるうち「表示セルサイズが変わった再取得では更新される」は既存の `it('200m以上へズームアウトすると、完全な表示セルブロックは結合される')` と `it('表示セルサイズ変更(latitudeDelta 0.01→0.1)ではfreshが落ちない')` が、「fresh cell が検出された再取得では更新されフェードが始まる」は既存の `it('再取得で新しく現れた2x2ブロックは結合されず100mセル4個のまま残り、フェード開始直後の低いalphaで表示される')` が既に固定している。スキップ判定がこれらのケースを誤って飲み込むと既存テストが落ちるため、重複するテストは追加しない。

- [ ] **Step 1: 既存モックを更新し、失敗するテストを書く**

`src/ui/hooks/__tests__/useVisitedGridOverlay.test.tsx` の既存モックを次へ差し替える。

```typescript
// 計測ログは出力の有無と内訳だけを検証するためモックする。
jest.mock('@/features/map/visitedGridMetrics', () => ({
  logVisitedGridMetrics: jest.fn(),
  logVisitedGridSourceUpdate: jest.fn(),
}));
```

ファイル冒頭の import を次へ差し替える。

```typescript
import { logVisitedGridMetrics, logVisitedGridSourceUpdate } from '@/features/map/visitedGridMetrics';
```

そのうえで、既存の `describe('効果測定ログ', ...)` の**後ろ**へ新しい describe を追加する。

```typescript
describe('取得結果が同一な場合の更新スキップ', () => {
  it('メタデータだけが変化した再取得では visitedGridCells の参照を維持する', async () => {
    // 本issueの最重要ケース。現在地セルの visit_count / last_visited_at はGPS記録のたびに
    // 更新されるため、これを差分として扱うと追従中のスキップがほぼ成立しなくなる。
    // 純粋関数のテストとは別に、フックへ正しく結線されていることをここで固定する。
    (getVisitedCellsInBounds as jest.Mock).mockResolvedValue(makeFullBlockRows(BLOCK_ORIGIN));

    const { result } = renderHook(() =>
      useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: THEME_PRIMARY_COLOR }),
    );

    await flushFetch();

    const cellsBefore = result.current.visitedGridCells;
    expect(cellsBefore.length).toBeGreaterThan(0);

    // 同じセルIDのまま visitCount / lastVisitedAt だけを進めた行を返す。
    (getVisitedCellsInBounds as jest.Mock).mockResolvedValue(
      makeFullBlockRows(BLOCK_ORIGIN).map((row) => ({ ...row, visitCount: 99, lastVisitedAt: '2026-08-13T12:00:00.000Z' })),
    );

    await flushAct(() => result.current.incrementVisitedGridRefreshVersion());

    // toEqualではなくtoBe(参照一致)であることが重要。中身が同じでも新しい配列が
    // 作られていればPolygon propsの参照が変わり、ネイティブ側の更新コストが発生する。
    expect(result.current.visitedGridCells).toBe(cellsBefore);
  });

  it('完全に同じ結果を返す再取得でも visitedGridCells の参照を維持する', async () => {
    (getVisitedCellsInBounds as jest.Mock).mockResolvedValue(makeFullBlockRows(BLOCK_ORIGIN));

    const { result } = renderHook(() =>
      useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: THEME_PRIMARY_COLOR }),
    );

    await flushFetch();

    const cellsBefore = result.current.visitedGridCells;

    await flushAct(() => result.current.incrementVisitedGridRefreshVersion());

    expect(result.current.visitedGridCells).toBe(cellsBefore);
  });

  it('スキップしても getVisitedCellsInBounds の呼び出し自体は従来どおり行う', async () => {
    // 再取得の頻度は変えない(新しいセルが開いた瞬間の表示遅延を増やさない)ことの確認。
    (getVisitedCellsInBounds as jest.Mock).mockResolvedValue(makeFullBlockRows(BLOCK_ORIGIN));

    const { result } = renderHook(() =>
      useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: THEME_PRIMARY_COLOR }),
    );

    await flushFetch();

    const callCountBefore = (getVisitedCellsInBounds as jest.Mock).mock.calls.length;

    await flushAct(() => result.current.incrementVisitedGridRefreshVersion());

    expect((getVisitedCellsInBounds as jest.Mock).mock.calls.length).toBeGreaterThan(callCountBefore);
  });

  it('セルが増えた再取得では visitedGridCells を更新する', async () => {
    (getVisitedCellsInBounds as jest.Mock).mockResolvedValue(makeFullBlockRows(BLOCK_ORIGIN));

    const { result } = renderHook(() =>
      useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: THEME_PRIMARY_COLOR }),
    );

    await flushFetch();

    const cellsBefore = result.current.visitedGridCells;

    (getVisitedCellsInBounds as jest.Mock).mockResolvedValue(makeCombinedRows());

    await flushAct(() => result.current.incrementVisitedGridRefreshVersion());

    expect(result.current.visitedGridCells).not.toBe(cellsBefore);
    expect(result.current.visitedGridCells.length).toBeGreaterThan(cellsBefore.length);
  });

  it('更新した回とスキップした回の両方で source ログを出力する', async () => {
    (getVisitedCellsInBounds as jest.Mock).mockResolvedValue(makeFullBlockRows(BLOCK_ORIGIN));

    const { result } = renderHook(() =>
      useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: THEME_PRIMARY_COLOR }),
    );

    await flushFetch();

    expect(logVisitedGridSourceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'updated', cellCount: 16, updatedCount: 1, skippedCount: 0 }),
    );

    await flushAct(() => result.current.incrementVisitedGridRefreshVersion());

    // 累計値そのものの整形は formatVisitedGridSourceUpdate のテストで固定済みのため、
    // ここでは取得のたびに outcome 付きで呼ばれることだけを確認する。
    expect(logVisitedGridSourceUpdate).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'skipped', cellCount: 16 }));
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test -- src/ui/hooks/__tests__/useVisitedGridOverlay.test.tsx`
Expected: FAIL。参照維持の2テストは `visitedGridCells` が毎回作り直されるため `toBe` に失敗し、ログのテストは `logVisitedGridSourceUpdate` が呼ばれず失敗する。「セルが増えた」「呼び出しは従来どおり」はこの時点でも PASS してよい(退行検知用)

- [ ] **Step 3: 実装を書く**

3-1. `src/ui/hooks/useVisitedGridOverlay.ts` の import へ2行追加する。

```typescript
import { canSkipVisitedGridSourceUpdate } from '@/features/map/visitedGridIdentity';
import { logVisitedGridMetrics, logVisitedGridSourceUpdate } from '@/features/map/visitedGridMetrics';
```

(既存の `import { logVisitedGridMetrics } from '@/features/map/visitedGridMetrics';` を上の形へ置き換える)

3-2. `visitedGridTimingRef` の宣言の直後へ、累計カウンタの ref を追加する。

```typescript
/** 起動後に描画データを更新した回数とスキップした回数。開発用の効果測定ログでのみ使う。 */
const visitedGridSourceUpdateCountsRef = useRef({ updatedCount: 0, skippedCount: 0 });
```

3-3. 取得effectの `.then` 内、`visitedGridTimingRef.current.freshDetectionMs = ...` の**次の行**から `setVisitedGridSource(...)` までを、次の内容へ置き換える。

```typescript
// 表示セルの集合が前回と同じなら、Polygon結合・座標変換・Polygon生成を丸ごと省く。
// 追従モード中は現在地更新のたびに再取得が走るが、その大半がこのケースになる。
const shouldSkipSourceUpdate = canSkipVisitedGridSourceUpdate({
  previousFetch: lastFetch ? { cellIds: lastFetch.cellIds, cellSizeMeters: lastFetch.cellSizeMeters } : null,
  nextCells: rows,
  displayCellSizeMeters,
  detectedFreshCellIds,
});

lastVisitedGridFetchRef.current = {
  bounds,
  cellSizeMeters: displayCellSizeMeters,
  version: visitedGridRefreshVersion,
  // スキップ時は内容が同一なので、前回のSetをそのまま使い回して毎秒の再確保を避ける。
  cellIds: shouldSkipSourceUpdate && lastFetch ? lastFetch.cellIds : new Set(rows.map((cell) => cell.cellId)),
};

const counts = visitedGridSourceUpdateCountsRef.current;

if (shouldSkipSourceUpdate) {
  counts.skippedCount += 1;
} else {
  counts.updatedCount += 1;
}

logVisitedGridSourceUpdate({
  outcome: shouldSkipSourceUpdate ? 'skipped' : 'updated',
  cellCount: rows.length,
  updatedCount: counts.updatedCount,
  skippedCount: counts.skippedCount,
});

if (shouldSkipSourceUpdate) {
  // fresh検出0件のためフェード開始対象もなく、fresh集合も変化しない。
  // フェード進行中の再描画はフェード用effectのsetTimeoutが自走するため、
  // ここでフェードフレームを進める必要もない。
  return;
}

// 表示され続けているfreshセルを維持するため、前回のfresh集合とマージする。
// 100m表示以外(isBaseSizeComparisonがfalse)ではdetectedFreshCellIdsが常に空になるため、
// このマージだけで「広域表示中も既存のfreshを保持する」挙動になる。
const mergedFreshCellIds = new Set([...visitedGridFreshCellIdsRef.current, ...detectedFreshCellIds]);
visitedGridFreshCellIdsRef.current = mergedFreshCellIds;

syncVisitedGridFadeState(fadingCellIds, mergedFreshCellIds);
setVisitedGridSource({ cells: rows, freshCellIds: mergedFreshCellIds, displayCellSizeMeters });
```

**注意:** 既存の `lastVisitedGridFetchRef.current = { ... }` 代入は上の置き換えに含まれているため、**元の代入ブロックは削除する**(二重代入にしない)。

3-4. `VisitedGridSource` 型のJSDoc(`cells` プロパティ)へ、メタデータが古くなりうる旨を追記する。

```typescript
  /**
   * 表示セルサイズへ集約済みのvisited cell。
   *
   * 取得結果のセルID集合が前回と同一の場合はこのstateを更新しない(`canSkipVisitedGridSourceUpdate`)。
   * そのため `visitCount` / `lastVisitedAt` などのメタデータは最新でないことがある。
   * 描画はセルIDと座標・テーマ色だけを使うため表示には影響しないが、
   * 将来メタデータを描画へ反映する場合は同一性判定を見直すこと。
   */
  cells: GridCellPolygonSource[];
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm test -- src/ui/hooks/__tests__/useVisitedGridOverlay.test.tsx`
Expected: PASS(既存テスト全件 + 追加5テスト)。`not wrapped in act(...)` 警告が出ないことも確認する

- [ ] **Step 5: 型チェックとlintを通す**

Run: `npm run typecheck && npx eslint src/ui/hooks/useVisitedGridOverlay.ts src/features/map/visitedGridIdentity.ts`
Expected: エラー0件

- [ ] **Step 6: 整形してコミットする**

```bash
npx prettier --write src/ui/hooks/useVisitedGridOverlay.ts src/ui/hooks/__tests__/useVisitedGridOverlay.test.tsx
git add src/ui/hooks/useVisitedGridOverlay.ts src/ui/hooks/__tests__/useVisitedGridOverlay.test.tsx
git commit -m "perf(map): 取得結果が同一ならvisited grid描画データの更新を省く"
```

---

### Task 4: MapScreen の Polygon 要素をメモ化する

**Files:**

- Modify: `src/ui/components/MapScreen.tsx:5`(import)、`:164`(直後へ `useMemo` 追加)、`:194-206`(JSX 差し替え)
- Test: `src/ui/components/__tests__/MapScreen.test.tsx`(Polygonモックへ計数追加 + テスト追加)

**Interfaces:**

- Consumes: `visitedGridCells: VisitedGridOverlayCell[]`(既存 props)、`gridOverlayOpacity: number`(既存 props)
- Produces: なし(コンポーネントの props も描画結果も変えない)

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/components/__tests__/MapScreen.test.tsx` の `jest.mock('react-native-maps', ...)` の**直前**へ計数用オブジェクトを追加する。変数名は `mock` 始まりにする(jestのモック工場スコープ制限のため)。

```typescript
/** Polygonのレンダー回数。メモ化でPolygon要素が作り直されないことの検証に使う。 */
const mockPolygonRenderCount = { current: 0 };
```

`PolygonMock` の定義を次へ差し替える。

```typescript
const PolygonMock = (props: MockMapComponentProps) => {
  mockPolygonRenderCount.current += 1;
  return React.createElement('Polygon', props, props.children);
};
```

ファイル末尾の `describe('地図画面 MapScreen', ...)` の**中**へ、次の describe を追加する。

```typescript
  describe('Visited Gridの再描画抑制', () => {
    /** テスト用のvisited grid描画データ。参照を固定して渡すためテスト内で一度だけ作る。 */
    function makeVisitedGridCells() {
      return [
        {
          id: '100:1:1',
          coordinates: [
            { latitude: 35, longitude: 139 },
            { latitude: 35.001, longitude: 139 },
            { latitude: 35.001, longitude: 139.001 },
            { latitude: 35, longitude: 139.001 },
          ],
          fillColor: 'rgba(31, 122, 92, 0.3)',
          strokeColor: 'rgba(31, 122, 92, 0)',
          strokeWidth: 0,
        },
      ];
    }

    beforeEach(() => {
      mockPolygonRenderCount.current = 0;
    });

    test('visitedGridCellsが同じ参照なら、他のpropsが変わってもPolygonを再レンダーしない', () => {
      // 追従モード中は現在地更新のたびにMapScreenが再レンダーされる。そのたびに
      // Polygon要素を作り直すと表示セル数ぶんのコストがかかるため、要素配列をメモ化する。
      const props = createProps();
      const visitedGridCells = makeVisitedGridCells();

      const { rerender } = render(<MapScreen {...props} visitedGridCells={visitedGridCells} />);

      const renderCountAfterMount = mockPolygonRenderCount.current;
      expect(renderCountAfterMount).toBeGreaterThan(0);

      // 現在地だけが変わった再レンダーを模す。
      rerender(<MapScreen {...props} visitedGridCells={visitedGridCells} userCoordinate={{ latitude: 35.1, longitude: 139.1 }} />);

      expect(mockPolygonRenderCount.current).toBe(renderCountAfterMount);
    });

    test('visitedGridCellsが差し替わるとPolygonを再レンダーする', () => {
      const props = createProps();

      const { rerender } = render(<MapScreen {...props} visitedGridCells={makeVisitedGridCells()} />);

      const renderCountAfterMount = mockPolygonRenderCount.current;

      rerender(<MapScreen {...props} visitedGridCells={makeVisitedGridCells()} />);

      expect(mockPolygonRenderCount.current).toBeGreaterThan(renderCountAfterMount);
    });
  });
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test -- src/ui/components/__tests__/MapScreen.test.tsx`
Expected: 1件目が FAIL(`Expected: 1, Received: 2` のように、再レンダーでPolygonが作り直される)。2件目は PASS

- [ ] **Step 3: 実装を書く**

3-1. `src/ui/components/MapScreen.tsx:5` の import へ `useMemo` を追加する。

```typescript
import { useEffect, useMemo, useState } from 'react';
```

3-2. `const shouldRenderVisitedGrid = gridOverlayOpacity > 0;` と `const [isCustomMarkerRendered, setIsCustomMarkerRendered] = useState(false);` の**後ろ**へ次を追加する。

```typescript
  /**
   * Visited GridのPolygon要素。
   *
   * 追従モード中は現在地更新のたびにこのコンポーネントが再レンダーされる。要素配列をメモ化して
   * 同じ参照を返すことで、visited cellに変化がない限りReactがPolygonサブツリーの再レンダーを
   * スキップする。Polygonへ渡す値はvisitedGridCells以外に依存しない(tappable/zIndex/testIDは定数)。
   */
  const visitedGridPolygons = useMemo(() => {
    if (!shouldRenderVisitedGrid) {
      return null;
    }

    return visitedGridCells.map((cell) => (
      <Polygon
        key={cell.id}
        coordinates={cell.coordinates}
        fillColor={cell.fillColor}
        strokeColor={cell.strokeColor}
        strokeWidth={cell.strokeWidth}
        testID="visited-grid-cell"
        tappable={false}
        zIndex={1}
      />
    ));
  }, [shouldRenderVisitedGrid, visitedGridCells]);
```

3-3. MapView の子から既存の Polygon 描画ブロックを削除し、`{visitedGridPolygons}` へ置き換える。

置き換え前:

(JSXの断片はそれ単体では有効なファイルにならず、Prettierがブロック文として整形してしまうため `text` フェンスで示す)

```text
        {shouldRenderVisitedGrid &&
          visitedGridCells.map((cell) => (
            <Polygon
              key={cell.id}
              coordinates={cell.coordinates}
              fillColor={cell.fillColor}
              strokeColor={cell.strokeColor}
              strokeWidth={cell.strokeWidth}
              testID="visited-grid-cell"
              tappable={false}
              zIndex={1}
            />
          ))}
```

置き換え後:

```text
        {visitedGridPolygons}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm test -- src/ui/components/__tests__/MapScreen.test.tsx`
Expected: PASS(既存テスト全件 + 追加2テスト)

- [ ] **Step 5: 整形してコミットする**

```bash
npx prettier --write src/ui/components/MapScreen.tsx src/ui/components/__tests__/MapScreen.test.tsx
git add src/ui/components/MapScreen.tsx src/ui/components/__tests__/MapScreen.test.tsx
git commit -m "perf(map): Visited GridのPolygon要素をメモ化して再構築を抑える"
```

---

### Task 5: ドキュメント更新と全体検証

**Files:**

- Modify: `docs/map-rendering.md`(§4.2 / §9)

**Interfaces:**

- Consumes: Task 1〜4 の実装
- Produces: なし

- [ ] **Step 1: §4.2 へ更新スキップとメモ化を追記する**

`docs/map-rendering.md` §4.2 の「表示セルは1セル1Polygonとして描画し、…」で始まる段落の**後ろ**へ、次の段落を追加する。

```markdown
現在地追従中は現在地更新のたびにvisited cellを再取得するが、取得できた表示セルIDの集合が前回と同じで、かつ新しく開いたセル(fresh cell)がない場合は描画データを更新しない。Polygon結合・座標変換・Polygon生成を丸ごと省くことで、同じ場所を歩き続けている間の定常負荷を下げる。同一性の比較にはセルIDだけを使い、`visit_count` や `last_visited_at` は見ない。現在地セルのこれらの値はGPS記録のたびに更新されるため比較へ含めると更新スキップが成立しなくなるうえ、描画はセルIDと座標・テーマ色だけで決まるため表示にも影響しない。再取得そのものは従来どおり行うため、新しいセルが開いたときの表示遅延は増えない。あわせてメインマップ側でもPolygon要素の配列をメモ化し、描画データが変わらない限りPolygonの再構築が起きないようにする。
```

- [ ] **Step 2: §9 のリストへ2項目を追記する**

`docs/map-rendering.md` §9 のリスト末尾(`EXPO_PUBLIC_LOG_VISITED_GRID_METRICS` の行の**後ろ**)へ次を追加する。

```markdown
- 取得した表示セルIDの集合が前回と同一でfresh cellもない場合は、描画データの更新自体を省く。現在地追従中の大半の再取得がこれに該当する
- `EXPO_PUBLIC_LOG_VISITED_GRID_METRICS` 有効時は、取得のたびに更新したかスキップしたかを `source=updated` / `source=skipped` として累計付きで出力する。描画データが変わらない回はセル数・Polygon数のログが出ないため、スキップの発生はこちらで確認する
```

- [ ] **Step 3: 全体検証を実行する**

Run: `npm run typecheck && npm test && npm run lint && npm run format:check`
Expected: typecheck エラー0件 / テスト全件 PASS / lint error 0件 / format:check PASS

失敗した場合は原因を修正してから次へ進む。特に `npm test` は変更ファイル単体ではなく**全件**を実行し、`src/ui` 配下の既存テスト(`AppMapReturn.test.tsx` / `routerIndex.test.tsx` など)が壊れていないことを確認する。

- [ ] **Step 4: コミットする**

```bash
npx prettier --write docs/map-rendering.md
git add docs/map-rendering.md
git commit -m "docs(map): 取得結果同一時の更新スキップとPolygonメモ化を追記"
```

---

## 完了条件

- [ ] `npm run typecheck` エラー0件
- [ ] `npm test` 全件 PASS(`not wrapped in act(...)` 警告なし)
- [ ] `npm run lint` error 0件
- [ ] `npm run format:check` PASS
- [ ] 設計書 §8 の受け入れ条件のうち、実機計測以外がすべて満たされている
- [ ] 実機/シミュレータでの計測(設計書 §6・§6.1)はユーザーが実施する。**位置を固定した観測はしない**(`distanceInterval: 5` のため更新が届かなくなる)。同一の100mセル内で5m以上ずつ動かし、`source=skipped` が大多数を占めることを確認する
