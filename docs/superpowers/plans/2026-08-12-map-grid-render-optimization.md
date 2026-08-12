# メイン地図 Visited Grid 描画軽量化 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 100m四方の表示意味を保ったまま、メイン地図の Visited Grid Overlay の取得・集約・Polygon描画コストを下げ、密集地域でのスクロールを軽くする(GitHub issue #138)。

**Architecture:** 4つの独立した純粋モジュール(効果測定 / fresh cell 判定 / Polygon結合 / SQL集約)を先に作り、最後に `useVisitedGridOverlay` と `useMapFollowState` へ結線する。地図カメラ用の `visibleRegion` と Grid取得用の `gridSyncRegion` を分離し、`onPanDrag` で立てたユーザー操作フラグが立っている間は `gridSyncRegion` を更新しない。描画では「新規GPS記録で開いた fresh cell」だけを100mセル・フェード対象として残し、既存の stable cell は完全に埋まった正方形ブロック(4x4 / 2x2)へ結合して Polygon 数を減らす。

**Tech Stack:** TypeScript 6.0 (strict) / React 19.2 / React Native 0.86 / expo-sqlite / react-native-maps / jest + @testing-library/react-native

## Global Constraints

- 作業ディレクトリは worktree `/Users/kazuki19992/gits/footspot/.worktrees/claude-map-grid-render-optimization`(ブランチ `claude/map-grid-render-optimization`、`develop` 起点)。
- TDD厳守。各タスクは「失敗するテストを書く → 失敗を確認 → 最小実装 → 成功を確認 → コミット」の順で進める。
- `describe` / `it` / `test` の説明文は日本語。JSDoc も日本語で、「なぜその設計か」を必要に応じて書く。
- import は `@/` エイリアスを使う。`../` 始まりの相対 import は ESLint error。同一ディレクトリは `./`。
- コミットメッセージは Semantic Commit Message(`type(scope): 日本語の説明`)。
- 合格条件: `npm run typecheck` 成功、`npm test` 成功、`npm run lint` の error 0。
- **100m四方の表示意味を壊さないこと**: 未訪問の100mセルを塗る変更は不可。結合は「ブロック内の表示セルがすべて visited のときだけ」。
- **既存挙動を変えない箇所**: 現在地追従の状態機械(初期ON / ドラッグでOFF / 現在地ボタンでON)、現在地ボタン、地図復帰時のセンタリング、`GRID_OVERLAY_CONFIG.boundsPaddingRatio: 0.5`。
- ログ出力に GPS 座標・個人の移動履歴を含めない。件数・処理時間・削減率のみ。ログは開発フラグ有効時に限定する。
- 結合対象は正方形のみ。`8x8` 以上と任意長方形結合は対象外。
- 確定済みの設計判断(ユーザー承認済み):
  - フェード対象は fresh cell のみ。アプリ起動直後の初回描画・画面復帰時のセルはフェードなしの即時表示でよい。
  - Polygon結合は100m表示だけでなく全ズーム段階(200m/500m…の集約表示セル)にも適用する。

---

## ファイル構成

| ファイル | 区分 | 責務 |
| --- | --- | --- |
| `src/config/developmentFlags.ts` | 変更 | Grid 計測ログ用の開発フラグ `logVisitedGridMetrics` を追加 |
| `src/features/map/visitedGridMetrics.ts` | 新規 | 計測値の型・削減率計算・ログ整形・ログ出力(開発フラグ配下) |
| `src/features/map/visitedGridFreshCells.ts` | 新規 | 「GPS記録で新しく開いたセル」の判定(純粋関数) |
| `src/features/map/visitedGridCoalescing.ts` | 新規 | 完全に埋まった正方形ブロックの Polygon 結合(純粋関数) |
| `src/features/location/visitedCellRepository.ts` | 変更 | `getVisitedCellsInBounds` に表示セルサイズ引数を足し、200m以上はSQL側で集約 |
| `src/features/location/grid/gridAggregation.ts` | 変更 | SQL集約へ移行して不要になる `aggregateVisitedCells` を削除 |
| `src/ui/hooks/useMapFollowState.ts` | 変更 | `gridSyncRegion` の追加とユーザー操作中の更新抑止 |
| `src/ui/hooks/useVisitedGridOverlay.ts` | 変更 | fresh/stable 分離・結合・stable/fresh 別メモ化・計測ログ |
| `src/ui/state/AppStateProvider.tsx` | 変更 | Grid 用 region を `gridSyncRegion` へ差し替え |
| `docs/map-rendering.md` | 変更 | 仕様追記(スクロール中のGrid更新方針 / fresh・stable cell / Polygon結合) |

テストは各対象と同じ階層の `__tests__/` に置く。

---

### Task 1: 計測モジュールと開発フラグ

**Files:**

- Create: `src/features/map/visitedGridMetrics.ts`
- Create: `src/features/map/__tests__/visitedGridMetrics.test.ts`
- Modify: `src/config/developmentFlags.ts`
- Modify: `src/config/__tests__/developmentFlags.test.ts`

**Interfaces:**

- Consumes: なし
- Produces:
  - `type VisitedGridMetrics = { rawCellCount: number; stableCellCount: number; freshCellCount: number; renderPolygonCount: number; coalescedBlockCountBySize: Record<string, number>; fetchMs: number; aggregationMs: number; overlayBuildMs: number }`
  - `function calculatePolygonReductionRatio(rawCellCount: number, renderPolygonCount: number): number`
  - `function formatVisitedGridMetrics(metrics: VisitedGridMetrics): string`
  - `function logVisitedGridMetrics(metrics: VisitedGridMetrics): void`
  - `developmentFlags.logVisitedGridMetrics: boolean`(環境変数 `EXPO_PUBLIC_LOG_VISITED_GRID_METRICS`)

- [ ] **Step 1: 失敗するテストを書く**

`src/features/map/__tests__/visitedGridMetrics.test.ts`:

```typescript
import { calculatePolygonReductionRatio, formatVisitedGridMetrics, logVisitedGridMetrics } from '@/features/map/visitedGridMetrics';
import { developmentFlags } from '@/config/developmentFlags';

/** テスト用の計測値。 */
const METRICS = {
  rawCellCount: 160,
  stableCellCount: 158,
  freshCellCount: 2,
  renderPolygonCount: 22,
  coalescedBlockCountBySize: { '4x4': 9, '2x2': 3, '1x1': 8 },
  fetchMs: 12,
  aggregationMs: 3,
  overlayBuildMs: 4,
};

describe('Visited Grid計測 visitedGridMetrics', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('calculatePolygonReductionRatio', () => {
    it('結合でPolygon数が減った割合を返す', () => {
      expect(calculatePolygonReductionRatio(160, 40)).toBeCloseTo(0.75);
    });

    it('元のセル数が0の場合は0を返す', () => {
      expect(calculatePolygonReductionRatio(0, 0)).toBe(0);
    });

    it('結合できずPolygon数が変わらない場合は0を返す', () => {
      expect(calculatePolygonReductionRatio(10, 10)).toBe(0);
    });
  });

  describe('formatVisitedGridMetrics', () => {
    it('件数・処理時間・削減率を含む1行の文字列を返す', () => {
      const formatted = formatVisitedGridMetrics(METRICS);

      expect(formatted).toContain('raw=160');
      expect(formatted).toContain('stable=158');
      expect(formatted).toContain('fresh=2');
      expect(formatted).toContain('render=22');
      expect(formatted).toContain('4x4=9');
      expect(formatted).toContain('fetchMs=12');
      expect(formatted).toContain('aggregationMs=3');
      expect(formatted).toContain('overlayBuildMs=4');
      expect(formatted).toContain('reduction=86.3%');
    });

    it('緯度経度など位置そのものを示す値は含めない', () => {
      const formatted = formatVisitedGridMetrics(METRICS);

      expect(formatted).not.toMatch(/latitude|longitude|cellId/i);
    });
  });

  describe('logVisitedGridMetrics', () => {
    it('開発フラグが無効なら出力しない', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      jest.replaceProperty(developmentFlags, 'logVisitedGridMetrics', false);

      logVisitedGridMetrics(METRICS);

      expect(logSpy).not.toHaveBeenCalled();
    });

    it('開発フラグが有効なら整形済み文字列を出力する', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      jest.replaceProperty(developmentFlags, 'logVisitedGridMetrics', true);

      logVisitedGridMetrics(METRICS);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[VisitedGrid]'));
    });
  });
});
```

`src/config/__tests__/developmentFlags.test.ts` に追記(既存の `loadDevelopmentFlagsModule` を拡張する。`setEnvValue` の対象へ新しい環境変数を追加すること):

```typescript
  it('環境変数でVisited Grid計測ログを有効にできる', () => {
    const { developmentFlags, hasEnabledDevelopmentFlags } = loadDevelopmentFlagsModule({
      EXPO_PUBLIC_LOG_VISITED_GRID_METRICS: 'true',
    });

    expect(developmentFlags.logVisitedGridMetrics).toBe(true);
    expect(hasEnabledDevelopmentFlags()).toBe(true);
  });
```

`loadDevelopmentFlagsModule` の中で以下の2行を既存の保存・復元処理と同じ形で追加する:

```typescript
  const originalVisitedGridMetricsFlag = process.env.EXPO_PUBLIC_LOG_VISITED_GRID_METRICS;
  setEnvValue('EXPO_PUBLIC_LOG_VISITED_GRID_METRICS', env.EXPO_PUBLIC_LOG_VISITED_GRID_METRICS);
  // require の後で
  setEnvValue('EXPO_PUBLIC_LOG_VISITED_GRID_METRICS', originalVisitedGridMetricsFlag);
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx jest src/features/map/__tests__/visitedGridMetrics.test.ts src/config/__tests__/developmentFlags.test.ts`
Expected: FAIL(`Cannot find module '@/features/map/visitedGridMetrics'`)

- [ ] **Step 3: 開発フラグを追加する**

`src/config/developmentFlags.ts` の型引数へ `'logVisitedGridMetrics'` を足し、値を追加する:

```typescript
/** 開発・検証用の一時フラグを集約する。 */
export const developmentFlags: Record<
  'enablePremiumAccessWithoutRevenueCat' | 'resetAchievementsOnLaunch' | 'logVisitedGridMetrics',
  boolean
> = {
  /** RevenueCat導入前にStrollia Plus特典を仮に有効化する。 */
  enablePremiumAccessWithoutRevenueCat: process.env.EXPO_PUBLIC_ENABLE_PREMIUM_ACCESS_WITHOUT_REVENUECAT === ENABLED_ENV_VALUE,
  /** 開発中に起動時の実績解除状態と通知キューをリセットして再評価する。 */
  resetAchievementsOnLaunch: process.env.EXPO_PUBLIC_RESET_ACHIEVEMENTS_ON_LAUNCH === ENABLED_ENV_VALUE,
  /** Visited Grid Overlayの取得・結合・描画コストを開発中に確認する。 */
  logVisitedGridMetrics: process.env.EXPO_PUBLIC_LOG_VISITED_GRID_METRICS === ENABLED_ENV_VALUE,
};
```

- [ ] **Step 4: 計測モジュールを実装する**

`src/features/map/visitedGridMetrics.ts`:

```typescript
import { developmentFlags } from '@/config/developmentFlags';

/**
 * Visited Grid Overlay 1回ぶんの取得・結合・描画コスト。
 *
 * 位置そのものを示す値(緯度経度・cellId)は持たせない。開発中に件数と処理時間だけを確認するための型。
 */
export type VisitedGridMetrics = {
  /** DBから取得した表示セル数。 */
  rawCellCount: number;
  /** 結合対象になり得る既存セル数。 */
  stableCellCount: number;
  /** 新規で開いたため結合しないセル数。 */
  freshCellCount: number;
  /** 最終的にMapViewへ渡すPolygon数。 */
  renderPolygonCount: number;
  /** `4x4` などブロック倍率ごとの結合数。 */
  coalescedBlockCountBySize: Record<string, number>;
  /** SQLite取得時間。単位はms。 */
  fetchMs: number;
  /** fresh判定とPolygon結合にかかった時間。単位はms。 */
  aggregationMs: number;
  /** Polygon用データ変換時間。単位はms。 */
  overlayBuildMs: number;
};

/**
 * Polygon結合による削減率を返す。
 *
 * @param rawCellCount - 結合前の表示セル数。
 * @param renderPolygonCount - 結合後のPolygon数。
 * @returns 0から1の削減率。元が0件、または削減されていない場合は0。
 */
export function calculatePolygonReductionRatio(rawCellCount: number, renderPolygonCount: number): number {
  if (rawCellCount <= 0) {
    return 0;
  }

  return Math.max(0, 1 - renderPolygonCount / rawCellCount);
}

/**
 * 計測値を1行のログ文字列へ整形する。
 *
 * @param metrics - 計測値。
 * @returns 開発ログ用の1行文字列。
 */
export function formatVisitedGridMetrics(metrics: VisitedGridMetrics): string {
  const reductionPercent = (calculatePolygonReductionRatio(metrics.rawCellCount, metrics.renderPolygonCount) * 100).toFixed(1);
  const blocks = Object.entries(metrics.coalescedBlockCountBySize)
    .map(([size, count]) => `${size}=${count}`)
    .join(' ');

  return [
    '[VisitedGrid]',
    `raw=${metrics.rawCellCount}`,
    `stable=${metrics.stableCellCount}`,
    `fresh=${metrics.freshCellCount}`,
    `render=${metrics.renderPolygonCount}`,
    `reduction=${reductionPercent}%`,
    `blocks(${blocks})`,
    `fetchMs=${metrics.fetchMs}`,
    `aggregationMs=${metrics.aggregationMs}`,
    `overlayBuildMs=${metrics.overlayBuildMs}`,
  ].join(' ');
}

/**
 * 開発フラグが有効な場合だけ計測値を出力する。
 *
 * 本番ユーザーのログを汚さないよう、`EXPO_PUBLIC_LOG_VISITED_GRID_METRICS` 有効時に限定する。
 *
 * @param metrics - 計測値。
 * @returns なし。
 */
export function logVisitedGridMetrics(metrics: VisitedGridMetrics): void {
  if (!developmentFlags.logVisitedGridMetrics) {
    return;
  }

  console.log(formatVisitedGridMetrics(metrics));
}
```

- [ ] **Step 5: テストを実行して成功を確認する**

Run: `npx jest src/features/map/__tests__/visitedGridMetrics.test.ts src/config/__tests__/developmentFlags.test.ts`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/features/map/visitedGridMetrics.ts src/features/map/__tests__/visitedGridMetrics.test.ts src/config/developmentFlags.ts src/config/__tests__/developmentFlags.test.ts
git commit -m "feat(map): Visited Grid描画コストの開発用計測を追加"
```

---

### Task 2: fresh cell 判定の純粋関数

**Files:**

- Create: `src/features/map/visitedGridFreshCells.ts`
- Create: `src/features/map/__tests__/visitedGridFreshCells.test.ts`

**Interfaces:**

- Consumes: `GridBounds`, `GridCell`(`@/features/location/grid/gridCell`)
- Produces:
  - `type ResolveFreshVisitedCellIdsParams = { previousFreshCellIds: ReadonlySet<string>; previousCellIds: ReadonlySet<string>; previousBounds: GridBounds | null; nextCells: readonly GridCell[]; displayCellSizeMeters: number; baseCellSizeMeters: number; maxFreshCellCount: number }`
  - `function resolveFreshVisitedCellIds(params: ResolveFreshVisitedCellIdsParams): Set<string>`
  - `const MAX_FRESH_VISITED_CELL_COUNT = 64`

**判定ルール(なぜこの設計か):**

GPS記録で開いたセルなのか、スクロールで画面に入っただけの既存セルなのかは、DBの行だけでは区別できない。そこで「前回取得済みの範囲内に**完全に含まれる**のに前回は返ってこなかったセル」だけを fresh と見なす。前回範囲の外側は「スクロールで入ってきた既存セル」の可能性があるため fresh にしない(保守的側=フェードしない側へ倒す)。
すでに fresh のセルは、次の取得でも表示され続けている限り fresh のまま(結合対象外)。表示範囲から外れたら fresh から落として stable 化する。1回で大量に fresh 判定された場合はフェード嵐を避けるため fresh を空にする。

- [ ] **Step 1: 失敗するテストを書く**

`src/features/map/__tests__/visitedGridFreshCells.test.ts`:

```typescript
import type { GridCell } from '@/features/location/grid/gridCell';
import { MAX_FRESH_VISITED_CELL_COUNT, resolveFreshVisitedCellIds } from '@/features/map/visitedGridFreshCells';

/** 100m表示セルを組み立てるヘルパー。 */
function cell(x: number, y: number): GridCell {
  return { cellId: `100:${x}:${y}`, cellSizeMeters: 100, x, y };
}

/** 既定の判定引数。テストごとに必要な項目だけ上書きする。 */
function params(overrides: Partial<Parameters<typeof resolveFreshVisitedCellIds>[0]> = {}) {
  return {
    previousFreshCellIds: new Set<string>(),
    previousCellIds: new Set<string>(),
    previousBounds: { minX: 0, maxX: 10, minY: 0, maxY: 10 },
    nextCells: [] as GridCell[],
    displayCellSizeMeters: 100,
    baseCellSizeMeters: 100,
    maxFreshCellCount: MAX_FRESH_VISITED_CELL_COUNT,
    ...overrides,
  };
}

describe('Visited Grid新規セル判定 resolveFreshVisitedCellIds', () => {
  it('前回取得済み範囲の内側に現れた新しいセルはfreshになる', () => {
    const result = resolveFreshVisitedCellIds(
      params({
        previousCellIds: new Set(['100:5:5']),
        nextCells: [cell(5, 5), cell(5, 6)],
      }),
    );

    expect([...result]).toEqual(['100:5:6']);
  });

  it('前回取得範囲の外にあるセルはスクロールで入った既存セルとして扱いfreshにしない', () => {
    const result = resolveFreshVisitedCellIds(
      params({
        previousBounds: { minX: 0, maxX: 3, minY: 0, maxY: 3 },
        previousCellIds: new Set(['100:1:1']),
        nextCells: [cell(1, 1), cell(9, 9)],
      }),
    );

    expect(result.size).toBe(0);
  });

  it('初回取得(前回範囲なし)ではfreshなしとして即時表示する', () => {
    const result = resolveFreshVisitedCellIds(
      params({
        previousBounds: null,
        nextCells: [cell(1, 1), cell(2, 2)],
      }),
    );

    expect(result.size).toBe(0);
  });

  it('表示され続けているfresh cellはfreshのまま維持する', () => {
    const result = resolveFreshVisitedCellIds(
      params({
        previousFreshCellIds: new Set(['100:5:6']),
        previousCellIds: new Set(['100:5:5', '100:5:6']),
        nextCells: [cell(5, 5), cell(5, 6)],
      }),
    );

    expect([...result]).toEqual(['100:5:6']);
  });

  it('表示範囲から外れたfresh cellはstable扱いになる', () => {
    const result = resolveFreshVisitedCellIds(
      params({
        previousFreshCellIds: new Set(['100:5:6']),
        previousCellIds: new Set(['100:5:5', '100:5:6']),
        nextCells: [cell(5, 5)],
      }),
    );

    expect(result.size).toBe(0);
  });

  it('一度に大量のセルがfresh判定された場合はフェードを止めるためfreshなしにする', () => {
    const nextCells = Array.from({ length: 100 }, (unused, index) => cell(1, index));

    const result = resolveFreshVisitedCellIds(
      params({
        previousBounds: { minX: 0, maxX: 200, minY: 0, maxY: 200 },
        previousCellIds: new Set(['100:0:0']),
        nextCells,
        maxFreshCellCount: 64,
      }),
    );

    expect(result.size).toBe(0);
  });

  it('200m表示セルは元の100mセル範囲が前回取得範囲に収まる場合だけfreshになる', () => {
    const aggregated = { cellId: '200:2:2', cellSizeMeters: 200, x: 2, y: 2 };

    // 200:2:2 は 100mセル x=4..5 / y=4..5 に対応する
    expect(
      resolveFreshVisitedCellIds(
        params({
          previousBounds: { minX: 4, maxX: 5, minY: 4, maxY: 5 },
          previousCellIds: new Set(['200:1:1']),
          nextCells: [aggregated],
          displayCellSizeMeters: 200,
        }),
      ).size,
    ).toBe(1);

    expect(
      resolveFreshVisitedCellIds(
        params({
          previousBounds: { minX: 5, maxX: 6, minY: 4, maxY: 5 },
          previousCellIds: new Set(['200:1:1']),
          nextCells: [aggregated],
          displayCellSizeMeters: 200,
        }),
      ).size,
    ).toBe(0);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx jest src/features/map/__tests__/visitedGridFreshCells.test.ts`
Expected: FAIL(`Cannot find module '@/features/map/visitedGridFreshCells'`)

- [ ] **Step 3: 実装する**

`src/features/map/visitedGridFreshCells.ts`:

```typescript
import type { GridBounds, GridCell } from '@/features/location/grid/gridCell';

/**
 * 1回の取得でfresh扱いにする上限。
 *
 * これを超える場合は「GPSで開いた新規セル」ではなく大量再表示とみなし、
 * 50ms間隔のフェード再計算が大量セルに波及しないようfreshなしへ倒す。
 */
export const MAX_FRESH_VISITED_CELL_COUNT = 64;

/** `resolveFreshVisitedCellIds` の引数。 */
export type ResolveFreshVisitedCellIdsParams = {
  /** 前回時点でfreshだった表示セルID。 */
  previousFreshCellIds: ReadonlySet<string>;
  /** 前回取得で得られた表示セルID。 */
  previousCellIds: ReadonlySet<string>;
  /** 前回取得に使った基本セル番号範囲。初回取得ならnull。 */
  previousBounds: GridBounds | null;
  /** 今回取得した表示セル。 */
  nextCells: readonly GridCell[];
  /** 現在の表示セルサイズ。単位はm。 */
  displayCellSizeMeters: number;
  /** 保存に使う基本セルサイズ。単位はm。 */
  baseCellSizeMeters: number;
  /** fresh扱いにする上限数。 */
  maxFreshCellCount: number;
};

/**
 * GPS記録で新しく開いた表示セルIDを判定する。
 *
 * DBの行だけではスクロールで表示範囲に入った既存セルと区別できないため、
 * 「前回取得済み範囲に完全に含まれるのに前回は返らなかったセル」だけをfreshとする。
 * 判定が曖昧なセルはfreshにしない(=フェードせず即時表示する)側へ倒す。
 *
 * @param params - 前回状態と今回取得結果。
 * @returns fresh扱いにする表示セルIDの集合。
 */
export function resolveFreshVisitedCellIds({
  previousFreshCellIds,
  previousCellIds,
  previousBounds,
  nextCells,
  displayCellSizeMeters,
  baseCellSizeMeters,
  maxFreshCellCount,
}: ResolveFreshVisitedCellIdsParams): Set<string> {
  const freshCellIds = new Set<string>();

  if (!previousBounds) {
    return freshCellIds;
  }

  const ratio = Math.max(1, Math.round(displayCellSizeMeters / baseCellSizeMeters));

  for (const cell of nextCells) {
    // 表示され続けているfresh cellはfreshのまま維持する。画面外に出た場合はここへ来ないためstable化する。
    if (previousFreshCellIds.has(cell.cellId)) {
      freshCellIds.add(cell.cellId);
      continue;
    }

    if (previousCellIds.has(cell.cellId)) {
      continue;
    }

    if (isCellFullyInsideBounds(cell, ratio, previousBounds)) {
      freshCellIds.add(cell.cellId);
    }
  }

  if (freshCellIds.size > maxFreshCellCount) {
    return new Set<string>();
  }

  return freshCellIds;
}

/**
 * 表示セルが占める基本セル範囲が、前回取得範囲に完全に含まれるか返す。
 *
 * @param cell - 判定対象の表示セル。
 * @param ratio - 表示セル1つが含む基本セル数(1辺)。
 * @param bounds - 前回取得に使った基本セル番号範囲。
 * @returns 完全に含まれる場合はtrue。
 */
function isCellFullyInsideBounds(cell: GridCell, ratio: number, bounds: GridBounds): boolean {
  const minX = cell.x * ratio;
  const minY = cell.y * ratio;
  const maxX = minX + ratio - 1;
  const maxY = minY + ratio - 1;

  return minX >= bounds.minX && maxX <= bounds.maxX && minY >= bounds.minY && maxY <= bounds.maxY;
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

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

- Create: `src/features/map/visitedGridCoalescing.ts`
- Create: `src/features/map/__tests__/visitedGridCoalescing.test.ts`

**Interfaces:**

- Consumes: `GridCellPolygonSource`(`@/features/location/grid/gridCell`)
- Produces:
  - `const VISITED_GRID_COALESCE_BLOCK_SIZES: readonly number[] = [4, 2]`
  - `type CoalescedVisitedGrid = { stableCells: GridCellPolygonSource[]; freshCells: GridCellPolygonSource[]; blockCountBySize: Record<string, number> }`
  - `function coalesceVisitedGridCells(cells: readonly GridCellPolygonSource[], freshCellIds: ReadonlySet<string>, blockSizes?: readonly number[]): CoalescedVisitedGrid`

**設計メモ:**

- ブロックはグリッド整列(原点は `Math.floor(x / blockSize) * blockSize`)のみを対象にする。整列ブロックは同一サイズ同士で必ず互いに素になるため貪欲でも結果が一意に決まり、スクロールしてもキーが変わらない。
- 結合後セルは `cellSizeMeters = 表示セルサイズ * blockSize`、`x/y = ブロック座標`、`cellId = ${結合後サイズ}:${x}:${y}`。`cellToPolygonCoordinates` はこの形をそのまま矩形へ変換できる。
- fresh cell は結合対象から除外し、そのままのサイズで返す。
- 4x4 → 2x2 → 単体 の順に試す。2x2の整列ブロックは4x4の整列ブロックの部分集合なので、順序による取りこぼしは起きない。

- [ ] **Step 1: 失敗するテストを書く**

`src/features/map/__tests__/visitedGridCoalescing.test.ts`:

```typescript
import type { GridCellPolygonSource } from '@/features/location/grid/gridCell';
import { coalesceVisitedGridCells } from '@/features/map/visitedGridCoalescing';

/** 指定サイズの表示セルを作る。 */
function cell(x: number, y: number, cellSizeMeters = 100): GridCellPolygonSource {
  return { cellId: `${cellSizeMeters}:${x}:${y}`, cellSizeMeters, x, y };
}

/** originを左下とするsize x sizeのセル集合を作る。 */
function block(originX: number, originY: number, size: number): GridCellPolygonSource[] {
  const cells: GridCellPolygonSource[] = [];

  for (let y = originY; y < originY + size; y += 1) {
    for (let x = originX; x < originX + size; x += 1) {
      cells.push(cell(x, y));
    }
  }

  return cells;
}

describe('Visited Grid Polygon結合 coalesceVisitedGridCells', () => {
  it('4x4が完全に埋まっていれば1つの400mセルへ結合する', () => {
    const result = coalesceVisitedGridCells(block(0, 0, 4), new Set());

    expect(result.stableCells).toHaveLength(1);
    expect(result.stableCells[0]).toEqual(expect.objectContaining({ cellId: '400:0:0', cellSizeMeters: 400, x: 0, y: 0 }));
    expect(result.blockCountBySize['4x4']).toBe(1);
  });

  it('4x4の一部が欠けている場合は2x2と単体へ落とす', () => {
    // 4x4から右上の1セル(3,3)を欠けさせる。左下2x2・右下2x2・左上2x2は成立し、右上ブロックだけ3セルが単体で残る。
    const cells = block(0, 0, 4).filter((target) => !(target.x === 3 && target.y === 3));

    const result = coalesceVisitedGridCells(cells, new Set());

    expect(result.blockCountBySize['4x4']).toBeUndefined();
    expect(result.blockCountBySize['2x2']).toBe(3);
    expect(result.blockCountBySize['1x1']).toBe(3);
    expect(result.stableCells).toHaveLength(6);
  });

  it('市松模様状では誤って結合せず100mセルのまま返す', () => {
    const cells: GridCellPolygonSource[] = [];

    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < 4; x += 1) {
        if ((x + y) % 2 === 0) {
          cells.push(cell(x, y));
        }
      }
    }

    const result = coalesceVisitedGridCells(cells, new Set());

    expect(result.stableCells).toHaveLength(8);
    expect(result.stableCells.every((target) => target.cellSizeMeters === 100)).toBe(true);
  });

  it('未訪問セルを含むブロックは結合せず未訪問エリアを塗らない', () => {
    const cells = block(0, 0, 2).filter((target) => !(target.x === 1 && target.y === 1));

    const result = coalesceVisitedGridCells(cells, new Set());

    expect(result.stableCells.map((target) => target.cellId).sort()).toEqual(['100:0:0', '100:0:1', '100:1:0']);
  });

  it('fresh cellは結合対象から除外し100mセルのまま返す', () => {
    const result = coalesceVisitedGridCells(block(0, 0, 2), new Set(['100:1:1']));

    expect(result.freshCells.map((target) => target.cellId)).toEqual(['100:1:1']);
    expect(result.stableCells.map((target) => target.cellId).sort()).toEqual(['100:0:0', '100:0:1', '100:1:0']);
  });

  it('結合後セルは範囲内の最古・最新訪問日時と訪問回数を引き継ぐ', () => {
    const cells = block(0, 0, 2).map((target, index) => ({
      ...target,
      firstVisitedAt: `2026-05-0${index + 1}T00:00:00.000Z`,
      lastVisitedAt: `2026-06-0${index + 1}T00:00:00.000Z`,
      visitCount: index + 1,
    }));

    const result = coalesceVisitedGridCells(cells, new Set());

    expect(result.stableCells[0]).toEqual(
      expect.objectContaining({
        firstVisitedAt: '2026-05-01T00:00:00.000Z',
        lastVisitedAt: '2026-06-04T00:00:00.000Z',
        visitCount: 10,
      }),
    );
  });

  it('負のセル番号でもブロック整列を崩さず結合する', () => {
    const result = coalesceVisitedGridCells(block(-4, -4, 4), new Set());

    expect(result.stableCells).toHaveLength(1);
    expect(result.stableCells[0]).toEqual(expect.objectContaining({ cellId: '400:-1:-1', x: -1, y: -1 }));
  });

  it('200m表示セルにも同じ結合を適用する', () => {
    const cells = [cell(0, 0, 200), cell(1, 0, 200), cell(0, 1, 200), cell(1, 1, 200)];

    const result = coalesceVisitedGridCells(cells, new Set());

    expect(result.stableCells).toHaveLength(1);
    expect(result.stableCells[0]).toEqual(expect.objectContaining({ cellId: '400:0:0', cellSizeMeters: 400 }));
  });

  it('空配列を渡しても壊れない', () => {
    const result = coalesceVisitedGridCells([], new Set());

    expect(result.stableCells).toEqual([]);
    expect(result.freshCells).toEqual([]);
    expect(result.blockCountBySize).toEqual({});
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx jest src/features/map/__tests__/visitedGridCoalescing.test.ts`
Expected: FAIL(`Cannot find module '@/features/map/visitedGridCoalescing'`)

- [ ] **Step 3: 実装する**

`src/features/map/visitedGridCoalescing.ts`:

```typescript
import type { GridCellPolygonSource } from '@/features/location/grid/gridCell';

/**
 * 結合を試すブロック倍率。大きい順に試す。
 *
 * `8x8` 以上は初回実装では扱わない。市街地でも完全に埋まる確率が下がり、
 * 判定コストに対する削減効果が読みにくいため。
 */
export const VISITED_GRID_COALESCE_BLOCK_SIZES: readonly number[] = [4, 2];

/** Polygon結合の結果。 */
export type CoalescedVisitedGrid = {
  /** 結合済み、または結合できなかった既存セル。 */
  stableCells: GridCellPolygonSource[];
  /** 結合対象外の新規セル。 */
  freshCells: GridCellPolygonSource[];
  /** `4x4` などブロック倍率ごとの採用数。開発用の効果測定に使う。 */
  blockCountBySize: Record<string, number>;
};

/**
 * 完全に埋まった正方形ブロックだけを1つの大きいPolygonへ結合する。
 *
 * 「大セル内に1つでもvisitedがあれば塗る」集約とは異なり、ブロック内の表示セルが
 * すべてvisitedの場合しか結合しないため、未訪問セルを塗らず表示意味を保てる。
 * ブロックはグリッド整列(原点が倍率の倍数)のみを対象にする。整列ブロックは
 * 同一倍率どうしで必ず互いに素になり、貪欲でも結果とReact keyが安定するため。
 *
 * @param cells - 表示セル。表示セルサイズが混在していてもサイズごとに独立して処理する。
 * @param freshCellIds - 結合対象から除外する新規セルID。
 * @param blockSizes - 試すブロック倍率。大きい順に指定する。
 * @returns 結合結果と、倍率ごとの採用数。
 */
export function coalesceVisitedGridCells(
  cells: readonly GridCellPolygonSource[],
  freshCellIds: ReadonlySet<string>,
  blockSizes: readonly number[] = VISITED_GRID_COALESCE_BLOCK_SIZES,
): CoalescedVisitedGrid {
  const freshCells: GridCellPolygonSource[] = [];
  const stableCells: GridCellPolygonSource[] = [];
  const blockCountBySize: Record<string, number> = {};
  /** 表示セルサイズごとの未処理セル。キーは `${x}:${y}`。 */
  const remainingBySize = new Map<number, Map<string, GridCellPolygonSource>>();

  for (const cell of cells) {
    if (freshCellIds.has(cell.cellId)) {
      freshCells.push(cell);
      continue;
    }

    const remaining = remainingBySize.get(cell.cellSizeMeters) ?? new Map<string, GridCellPolygonSource>();
    remaining.set(`${cell.x}:${cell.y}`, cell);
    remainingBySize.set(cell.cellSizeMeters, remaining);
  }

  for (const [cellSizeMeters, remaining] of remainingBySize) {
    for (const blockSize of blockSizes) {
      if (blockSize < 2) {
        continue;
      }

      for (const origin of collectBlockOrigins(remaining, blockSize)) {
        const members = collectBlockMembers(remaining, origin, blockSize);

        if (!members) {
          continue;
        }

        for (const member of members) {
          remaining.delete(`${member.x}:${member.y}`);
        }

        stableCells.push(mergeBlock(members, cellSizeMeters, blockSize, origin));
        incrementBlockCount(blockCountBySize, blockSize);
      }
    }

    for (const cell of remaining.values()) {
      stableCells.push(cell);
      incrementBlockCount(blockCountBySize, 1);
    }
  }

  stableCells.sort((a, b) => a.cellSizeMeters - b.cellSizeMeters || a.y - b.y || a.x - b.x);

  return { stableCells, freshCells, blockCountBySize };
}

/** ブロック原点の座標。 */
type BlockOrigin = { x: number; y: number };

/**
 * 未処理セルから、重複を除いたブロック原点を列挙する。
 *
 * @param remaining - 未処理セル。
 * @param blockSize - ブロック倍率。
 * @returns ブロック原点(セル番号単位)。
 */
function collectBlockOrigins(remaining: Map<string, GridCellPolygonSource>, blockSize: number): BlockOrigin[] {
  const origins = new Map<string, BlockOrigin>();

  for (const cell of remaining.values()) {
    const x = Math.floor(cell.x / blockSize) * blockSize;
    const y = Math.floor(cell.y / blockSize) * blockSize;
    origins.set(`${x}:${y}`, { x, y });
  }

  return [...origins.values()];
}

/**
 * ブロックが完全に埋まっている場合だけ、その構成セルを返す。
 *
 * @param remaining - 未処理セル。
 * @param origin - ブロック原点。
 * @param blockSize - ブロック倍率。
 * @returns 構成セル。1つでも欠けていればnull。
 */
function collectBlockMembers(
  remaining: Map<string, GridCellPolygonSource>,
  origin: BlockOrigin,
  blockSize: number,
): GridCellPolygonSource[] | null {
  const members: GridCellPolygonSource[] = [];

  for (let y = origin.y; y < origin.y + blockSize; y += 1) {
    for (let x = origin.x; x < origin.x + blockSize; x += 1) {
      const member = remaining.get(`${x}:${y}`);

      if (!member) {
        return null;
      }

      members.push(member);
    }
  }

  return members;
}

/**
 * ブロック構成セルを1つの大きい表示セルへまとめる。
 *
 * @param members - ブロック構成セル。
 * @param cellSizeMeters - 元の表示セルサイズ。
 * @param blockSize - ブロック倍率。
 * @param origin - ブロック原点。
 * @returns 結合後の表示セル。
 */
function mergeBlock(
  members: GridCellPolygonSource[],
  cellSizeMeters: number,
  blockSize: number,
  origin: BlockOrigin,
): GridCellPolygonSource {
  const mergedSizeMeters = cellSizeMeters * blockSize;
  const x = origin.x / blockSize;
  const y = origin.y / blockSize;
  let firstVisitedAt: string | undefined;
  let lastVisitedAt: string | undefined;
  let visitCount = 0;

  for (const member of members) {
    if (member.firstVisitedAt && (!firstVisitedAt || member.firstVisitedAt < firstVisitedAt)) {
      firstVisitedAt = member.firstVisitedAt;
    }

    if (member.lastVisitedAt && (!lastVisitedAt || member.lastVisitedAt > lastVisitedAt)) {
      lastVisitedAt = member.lastVisitedAt;
    }

    visitCount += member.visitCount ?? 0;
  }

  return {
    cellId: `${mergedSizeMeters}:${x}:${y}`,
    cellSizeMeters: mergedSizeMeters,
    x,
    y,
    firstVisitedAt,
    lastVisitedAt,
    visitCount,
  };
}

/**
 * ブロック倍率ごとの採用数を1つ増やす。
 *
 * @param blockCountBySize - 集計先。
 * @param blockSize - ブロック倍率。
 * @returns なし。
 */
function incrementBlockCount(blockCountBySize: Record<string, number>, blockSize: number): void {
  const key = `${blockSize}x${blockSize}`;
  blockCountBySize[key] = (blockCountBySize[key] ?? 0) + 1;
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx jest src/features/map/__tests__/visitedGridCoalescing.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/features/map/visitedGridCoalescing.ts src/features/map/__tests__/visitedGridCoalescing.test.ts
git commit -m "feat(map): 完全に埋まった正方形ブロックのPolygon結合を追加"
```

---

### Task 4: ユーザースクロール中のGrid更新停止

**Files:**

- Modify: `src/ui/hooks/useMapFollowState.ts`
- Modify: `src/ui/hooks/__tests__/useMapFollowState.test.tsx`
- Modify: `src/ui/state/AppStateProvider.tsx:557`

**Interfaces:**

- Consumes: なし
- Produces: `UseMapFollowStateResult.gridSyncRegion: Region | null`(Grid取得に使う表示範囲。ユーザー操作中は更新されない)

**設計メモ:**

- `visibleRegion` は既存どおり更新する(写真クラスタ半径などが参照する)。Grid取得だけを遅らせる。
- ユーザー操作の判定は `onPanDrag` で立てるフラグに限定する。`onRegionChangeComplete` の発火だけで推測しない。
- `centerOnCoordinate`(現在地追従・現在地ボタン・地図復帰の共通経路)と `prepareMapRegionRestore` はプログラム移動なので、フラグを下ろして `gridSyncRegion` を即時更新する。

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/hooks/__tests__/useMapFollowState.test.tsx` の末尾へ追加(ファイル先頭の `renderMapFollowState` ヘルパーを使う):

```typescript
/** テスト用の表示範囲。 */
const GESTURE_REGION = { latitude: 35.68, longitude: 139.76, latitudeDelta: 0.01, longitudeDelta: 0.01 };
/** ジェスチャー完了後の表示範囲。 */
const COMPLETED_REGION = { latitude: 35.7, longitude: 139.8, latitudeDelta: 0.02, longitudeDelta: 0.02 };

describe('Grid取得用region gridSyncRegion', () => {
  it('初期状態ではnullを返す', () => {
    const { result } = renderMapFollowState();

    expect(result.current.gridSyncRegion).toBeNull();
  });

  it('ユーザーのドラッグ中のonRegionChangeではgridSyncRegionを更新しない', () => {
    const { result } = renderMapFollowState();

    act(() => {
      result.current.handleMapPanDrag();
    });
    act(() => {
      result.current.handleRegionChange(GESTURE_REGION);
    });

    expect(result.current.visibleRegion).toEqual(GESTURE_REGION);
    expect(result.current.gridSyncRegion).toBeNull();
  });

  it('ユーザー操作が完了するとgridSyncRegionを更新する', () => {
    const { result } = renderMapFollowState();

    act(() => {
      result.current.handleMapPanDrag();
    });
    act(() => {
      result.current.handleRegionChange(GESTURE_REGION);
    });
    act(() => {
      result.current.handleRegionChangeComplete(COMPLETED_REGION);
    });

    expect(result.current.gridSyncRegion).toEqual(COMPLETED_REGION);
  });

  it('ユーザー操作がない状態のonRegionChangeではgridSyncRegionを更新する', () => {
    const { result } = renderMapFollowState();

    act(() => {
      result.current.handleRegionChange(GESTURE_REGION);
    });

    expect(result.current.gridSyncRegion).toEqual(GESTURE_REGION);
  });

  it('現在地ボタンによるプログラム移動ではgridSyncRegionを即時更新する', () => {
    const { result } = renderMapFollowState();

    act(() => {
      result.current.applyUserLocation(35.69, 139.77, 1);
    });
    act(() => {
      result.current.handleMapPanDrag();
    });
    act(() => {
      result.current.recenterOnUserLocation();
    });

    expect(result.current.gridSyncRegion?.latitude).toBeCloseTo(35.69);
    expect(result.current.gridSyncRegion?.longitude).toBeCloseTo(139.77);
  });

  it('現在地ボタン後のonRegionChangeはユーザー操作扱いにせずgridSyncRegionを更新する', () => {
    const { result } = renderMapFollowState();

    act(() => {
      result.current.applyUserLocation(35.69, 139.77, 1);
    });
    act(() => {
      result.current.handleMapPanDrag();
    });
    act(() => {
      result.current.recenterOnUserLocation();
    });
    act(() => {
      result.current.handleRegionChange(GESTURE_REGION);
    });

    expect(result.current.gridSyncRegion).toEqual(GESTURE_REGION);
  });
});
```

注意: `handleRegionChange` は150msのスロットルを持つ。`handleRegionChangeComplete` / `centerOnCoordinate` の直後に `handleRegionChange` を呼ぶテストではスロットルで無視される可能性があるため、必要なら `jest.useFakeTimers()` + `jest.advanceTimersByTime(200)` ではなく `jest.spyOn(Date, 'now')` で時刻を進める。最後のテストは `recenterOnUserLocation` がスロットル基準時刻を更新しない実装であればそのまま通る。通らない場合は次を最後のテストの前に入れる:

```typescript
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(Date.now() + 1000);
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx jest src/ui/hooks/__tests__/useMapFollowState.test.tsx -t gridSyncRegion`
Expected: FAIL(`gridSyncRegion` が undefined)

- [ ] **Step 3: `useMapFollowState` を変更する**

1. `UseMapFollowStateResult` へ追加:

```typescript
  /**
   * Visited Grid の取得・描画に使う表示範囲。
   * ユーザーが指で地図を動かしている間は更新せず、操作完了後にまとめて追従する。
   * 追従中の自動移動・現在地ボタン・地図復帰などのプログラム移動では即時更新する。
   */
  gridSyncRegion: Region | null;
```

2. state と ref を追加(`visibleRegion` の宣言直後):

```typescript
  const [gridSyncRegion, setGridSyncRegion] = useState<Region | null>(null);
  /**
   * ユーザーが指で地図を動かしている最中かどうか。
   * onRegionChangeComplete の発火だけではプログラム移動と区別できないため、
   * onPanDrag で明示的に立てて操作完了時に下ろす。
   */
  const isUserMapGestureActiveRef = useRef(false);
```

3. `centerOnCoordinate` の `setVisibleRegion(region);` の直後へ追加:

```typescript
      // 追従・現在地ボタン・地図復帰はプログラム移動なので、Grid取得を遅らせない。
      isUserMapGestureActiveRef.current = false;
      setGridSyncRegion(region);
```

4. `handleMapPanDrag`:

```typescript
  function handleMapPanDrag(): void {
    isUserMapGestureActiveRef.current = true;
    setIsFollowingUserLocation(false);
  }
```

5. `handleRegionChangeComplete` の末尾へ追加:

```typescript
    isUserMapGestureActiveRef.current = false;
    setGridSyncRegion(region);
```

6. `handleRegionChange` の `setVisibleRegion(region);` の直後へ追加:

```typescript
    // ユーザー操作中はGrid取得・大量Polygon更新を走らせない。操作完了時にまとめて追従する。
    if (!isUserMapGestureActiveRef.current) {
      setGridSyncRegion(region);
    }
```

7. `prepareMapRegionRestore` 内の `setVisibleRegion(createUserCenteredRegion(userCoordinate));` を次へ置き換える:

```typescript
      const restoredRegion = createUserCenteredRegion(userCoordinate);
      isUserMapGestureActiveRef.current = false;
      setVisibleRegion(restoredRegion);
      setGridSyncRegion(restoredRegion);
```

8. 戻り値へ `gridSyncRegion,` を追加する。JSDoc のフック概要コメントにも `gridSyncRegion` を追記する。

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx jest src/ui/hooks/__tests__/useMapFollowState.test.tsx`
Expected: PASS(既存テストも含めて全件)

- [ ] **Step 5: AppStateProvider を接続する**

`src/ui/state/AppStateProvider.tsx` の分割代入(`const { mapRef, ... } = mapFollowState;`)へ `gridSyncRegion,` を追加し、557行付近を変更する:

```typescript
  // Grid取得はユーザー操作中に走らせないため visibleRegion ではなく gridSyncRegion を使う。
  const gridOverlayRegion = gridSyncRegion ?? initialRegion;
```

- [ ] **Step 6: 地図まわりの既存テストが壊れていないことを確認する**

Run: `npx jest src/ui/__tests__ src/ui/components/__tests__/MapScreen.test.tsx src/ui/hooks/__tests__/useMapFollowState.test.tsx`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
git add src/ui/hooks/useMapFollowState.ts src/ui/hooks/__tests__/useMapFollowState.test.tsx src/ui/state/AppStateProvider.tsx
git commit -m "feat(map): ユーザースクロール中のVisited Grid更新を止める"
```

---

### Task 5: `useVisitedGridOverlay` へ fresh判定・結合・計測を結線する

**Files:**

- Modify: `src/ui/hooks/useVisitedGridOverlay.ts`
- Modify: `src/ui/hooks/__tests__/useVisitedGridOverlay.test.tsx`

**Interfaces:**

- Consumes: `resolveFreshVisitedCellIds` / `MAX_FRESH_VISITED_CELL_COUNT`(Task 2)、`coalesceVisitedGridCells`(Task 3)、`logVisitedGridMetrics`(Task 1)
- Produces: `UseVisitedGridOverlayResult` は変更しない(`visitedGridCells` / `gridOverlayOpacity` / `incrementVisitedGridRefreshVersion`)

**設計メモ:**

- 「新しく表示されたセル全部」ではなく fresh cell だけをフェード対象にする。stable 側の Polygon データは opacity とテーマ色が変わらない限り再計算しないため、フェード中の50ms再描画で全セルの座標変換が走らなくなる。
- `visitedGridCells` は `stableOverlayCells.concat(freshOverlayCells)` として組み立てる。stable 側は同じ配列参照を使い回すので、フェード中でも stable Polygon の props は変化しない。

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/hooks/__tests__/useVisitedGridOverlay.test.tsx` を次の内容へ置き換える(既存の初期状態・isReady・refreshVersion のテストは残す)。冒頭のモックを実物ベースへ変更する点に注意:

```typescript
import { act, renderHook } from '@testing-library/react-native';

import { getVisitedCellsInBounds } from '@/features/location/visitedCellRepository';
import { useVisitedGridOverlay } from '@/ui/hooks/useVisitedGridOverlay';

jest.mock('@/features/location/visitedCellRepository', () => ({
  getVisitedCellsInBounds: jest.fn().mockResolvedValue([]),
}));

/** テスト用の標準マップ表示範囲。 */
const TEST_REGION = {
  latitude: 35.68,
  longitude: 139.76,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

/** 100m表示セル行を作る。 */
function cellRow(x: number, y: number) {
  return {
    cellId: `100:${x}:${y}`,
    cellSizeMeters: 100,
    x,
    y,
    firstVisitedAt: '2026-05-01T00:00:00.000Z',
    lastVisitedAt: '2026-05-01T00:10:00.000Z',
    visitCount: 1,
  };
}

/** originを左下とするsize x sizeの100mセル行を作る。 */
function cellRowBlock(originX: number, originY: number, size: number) {
  const rows = [];

  for (let y = originY; y < originY + size; y += 1) {
    for (let x = originX; x < originX + size; x += 1) {
      rows.push(cellRow(x, y));
    }
  }

  return rows;
}

/** hookの非同期取得を流し切る。 */
async function flush() {
  await act(async () => {
    for (let index = 0; index < 5; index += 1) {
      await Promise.resolve();
    }
  });
}

describe('訪問グリッドオーバーレイフック useVisitedGridOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getVisitedCellsInBounds as jest.Mock).mockResolvedValue([]);
  });

  describe('初期状態', () => {
    it('初期 visitedGridCells は空配列になる', () => {
      const { result } = renderHook(() =>
        useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: '#1f7a5c' }),
      );

      expect(result.current.visitedGridCells).toEqual([]);
    });

    it('gridOverlayOpacity は数値で返される', () => {
      const { result } = renderHook(() =>
        useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: '#1f7a5c' }),
      );

      expect(typeof result.current.gridOverlayOpacity).toBe('number');
    });
  });

  describe('isReady が false の場合', () => {
    it('isReady が false のときは getVisitedCellsInBounds を呼ばない', async () => {
      const { result } = renderHook(() =>
        useVisitedGridOverlay({ isReady: false, gridOverlayRegion: TEST_REGION, themePrimaryColor: '#1f7a5c' }),
      );

      await flush();

      expect(getVisitedCellsInBounds).not.toHaveBeenCalled();
      expect(result.current.visitedGridCells).toEqual([]);
    });
  });

  describe('isReady が true の場合', () => {
    it('isReady が true のときは表示セルサイズを渡して取得する', async () => {
      renderHook(() => useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: '#1f7a5c' }));

      await flush();

      expect(getVisitedCellsInBounds).toHaveBeenCalledTimes(1);
      expect(getVisitedCellsInBounds).toHaveBeenCalledWith(expect.anything(), 100);
    });
  });

  describe('incrementVisitedGridRefreshVersion', () => {
    it('呼び出すと getVisitedCellsInBounds が再度呼ばれる', async () => {
      const { result } = renderHook(() =>
        useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: '#1f7a5c' }),
      );

      await flush();

      const callCountBefore = (getVisitedCellsInBounds as jest.Mock).mock.calls.length;

      await act(async () => {
        result.current.incrementVisitedGridRefreshVersion();
        await Promise.resolve();
      });

      expect((getVisitedCellsInBounds as jest.Mock).mock.calls.length).toBeGreaterThan(callCountBefore);
    });
  });

  describe('Polygon結合', () => {
    it('完全に埋まった4x4ブロックは1つのPolygonへ結合される', async () => {
      (getVisitedCellsInBounds as jest.Mock).mockResolvedValue(cellRowBlock(0, 0, 4));

      const { result } = renderHook(() =>
        useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: '#1f7a5c' }),
      );

      await flush();

      expect(result.current.visitedGridCells).toHaveLength(1);
      expect(result.current.visitedGridCells[0].id).toBe('400:0:0');
    });

    it('結合できないデータでは100mセルのPolygonとして描画する', async () => {
      (getVisitedCellsInBounds as jest.Mock).mockResolvedValue([cellRow(0, 0), cellRow(2, 2)]);

      const { result } = renderHook(() =>
        useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: '#1f7a5c' }),
      );

      await flush();

      expect(result.current.visitedGridCells.map((cell) => cell.id).sort()).toEqual(['100:0:0', '100:2:2']);
    });
  });

  describe('fresh cell', () => {
    it('初回取得のセルはフェードせず即時表示する', async () => {
      (getVisitedCellsInBounds as jest.Mock).mockResolvedValue([cellRow(0, 0)]);

      const { result } = renderHook(() =>
        useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: '#1f7a5c' }),
      );

      await flush();

      // フェード中(進捗0)ならalphaが0になる。即時表示ならgridOverlayOpacityがそのまま乗る。
      expect(result.current.visitedGridCells[0].fillColor).not.toContain(', 0)');
    });

    it('再取得で新しく現れたセルは結合されず100mセルのまま残る', async () => {
      (getVisitedCellsInBounds as jest.Mock).mockResolvedValue(cellRowBlock(0, 0, 4));

      const { result } = renderHook(() =>
        useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: '#1f7a5c' }),
      );

      await flush();
      expect(result.current.visitedGridCells.map((cell) => cell.id)).toEqual(['400:0:0']);

      // 4x4の外側に新しいセルがGPS記録で開いた状況を再現する
      (getVisitedCellsInBounds as jest.Mock).mockResolvedValue([...cellRowBlock(0, 0, 4), cellRow(0, 4)]);

      await act(async () => {
        result.current.incrementVisitedGridRefreshVersion();
      });
      await flush();

      expect(result.current.visitedGridCells.map((cell) => cell.id).sort()).toEqual(['100:0:4', '400:0:0']);
    });
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx jest src/ui/hooks/__tests__/useVisitedGridOverlay.test.tsx`
Expected: FAIL(結合されず16個のPolygonが返る、`getVisitedCellsInBounds` が1引数で呼ばれる)

- [ ] **Step 3: `useVisitedGridOverlay` を書き換える**

ファイル全体を次の内容にする:

```typescript
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Region } from 'react-native-maps';

import { getStableDisplayCellSizeMeters } from '@/features/location/grid/gridAggregation';
import { getGridBoundsForRegion, GridBounds, GridCellPolygonSource, isGridBoundsContained } from '@/features/location/grid/gridCell';
import { getVisitedCellsInBounds } from '@/features/location/visitedCellRepository';
import { VisitedGridOverlayCell, getFogOpacity, toVisitedGridOverlayCells } from '@/features/map/gridOverlay';
import { GRID_OVERLAY_CONFIG } from '@/features/map/config/gridOverlayConfig';
import { coalesceVisitedGridCells } from '@/features/map/visitedGridCoalescing';
import { MAX_FRESH_VISITED_CELL_COUNT, resolveFreshVisitedCellIds } from '@/features/map/visitedGridFreshCells';
import { logVisitedGridMetrics } from '@/features/map/visitedGridMetrics';

/** visited cellフェードの持続時間。 */
const VISITED_GRID_FADE_DURATION_MS = 500;
/** visited cellフェード中の再描画間隔。 */
const VISITED_GRID_FADE_FRAME_MS = 50;

/** DBから取得した表示セルと、そのうち新規で開いたセルID。 */
type VisitedGridSource = {
  /** 表示セルサイズへ集約済みのvisited cell。 */
  cells: GridCellPolygonSource[];
  /** GPS記録で新しく開いたセルID。フェード対象かつ結合対象外。 */
  freshCellIds: Set<string>;
};

/** `useVisitedGridOverlay` フックの引数。 */
export type UseVisitedGridOverlayParams = {
  /**
   * 初期化完了フラグ。
   * false の間はグリッド取得を行わない。
   */
  isReady: boolean;
  /**
   * グリッド描画に使う地図表示範囲。
   * AppStateProvider の `gridSyncRegion ?? initialRegion` に相当する。
   * ユーザーが指で地図を動かしている間は更新されないため、操作中のDB取得が走らない。
   */
  gridOverlayRegion: Region;
  /**
   * visited cellの塗り色に使うテーマのprimary色。
   * フェード込みの描画用セルを計算するために必要。
   */
  themePrimaryColor: string;
};

/** `useVisitedGridOverlay` が返す状態と操作の型。 */
export type UseVisitedGridOverlayResult = {
  /**
   * MapView Polygon 用に変換済みの visited cell 配列。
   * 結合済みの既存セルと、フェード中の新規セルを連結した最終描画データ。
   */
  visitedGridCells: VisitedGridOverlayCell[];
  /**
   * 現在の表示範囲に応じた fog opacity。
   * AppStateProvider 側でも参照するため公開する。
   */
  gridOverlayOpacity: number;
  /**
   * visitedGridRefreshVersion をインクリメントして DB 再取得をトリガーする。
   * refreshData / centerOnCoordinate / openMap から呼ぶ。
   */
  incrementVisitedGridRefreshVersion: () => void;
};

/**
 * 訪問グリッドオーバーレイの状態・取得・結合・フェードを束ねるカスタムフック。
 *
 * 描画コストを下げるため、次の3点を分けて扱う。
 * - GPS記録で新しく開いた fresh cell だけをフェード対象にし、スクロールで表示範囲に
 *   入った既存セルは即時表示する
 * - 既存セルは完全に埋まった正方形ブロックだけを大きいPolygonへ結合する
 *   (未訪問セルは塗らないため100m四方の表示意味は保たれる)
 * - stable / fresh の描画データを別々にメモ化し、フェード中の再計算を fresh 側に限定する
 */
export function useVisitedGridOverlay({
  isReady,
  gridOverlayRegion,
  themePrimaryColor,
}: UseVisitedGridOverlayParams): UseVisitedGridOverlayResult {
  const [visitedGridSource, setVisitedGridSource] = useState<VisitedGridSource>({ cells: [], freshCellIds: new Set() });
  const [visitedGridRefreshVersion, setVisitedGridRefreshVersion] = useState(0);
  /** 新規visited cellの0.5秒フェードを進めるため、50ms間隔で表示セルを再計算する。 */
  const [visitedGridFadeFrame, setVisitedGridFadeFrame] = useState(0);
  const visitedGridDisplayCellSizeRef = useRef<number | null>(null);
  /** 直近にvisited cellを取得したときの範囲・表示セルサイズ・データ版・セルID。 */
  const lastVisitedGridFetchRef = useRef<{
    bounds: GridBounds;
    cellSizeMeters: number;
    version: number;
    cellIds: Set<string>;
    freshCellIds: Set<string>;
  } | null>(null);
  const visitedGridFadeStartedAtRef = useRef(new Map<string, number>());
  /** 直近の取得・結合にかかった時間。開発用の効果測定ログでのみ使う。 */
  const visitedGridTimingRef = useRef({ fetchMs: 0, aggregationMs: 0 });

  /**
   * fresh cellの初回描画時刻を同期し、fresh でなくなったセルのフェード状態を掃除する。
   *
   * @param freshCellIds - 今回fresh扱いにするセルID。
   * @returns なし。
   */
  function syncVisitedGridFadeState(freshCellIds: ReadonlySet<string>): void {
    const now = Date.now();

    for (const cellId of freshCellIds) {
      if (!visitedGridFadeStartedAtRef.current.has(cellId)) {
        visitedGridFadeStartedAtRef.current.set(cellId, now);
      }
    }

    for (const cellId of visitedGridFadeStartedAtRef.current.keys()) {
      if (!freshCellIds.has(cellId)) {
        visitedGridFadeStartedAtRef.current.delete(cellId);
      }
    }

    setVisitedGridFadeFrame((frame) => frame + 1);
  }

  /**
   * 新規visited cellのフェード進捗を返す。
   *
   * @param cellId - 表示セルID。
   * @param now - 現在時刻。単位はms。
   * @returns 0から1のフェード進捗。
   */
  function getVisitedGridFadeProgress(cellId: string, now: number): number {
    const startedAt = visitedGridFadeStartedAtRef.current.get(cellId);

    if (!startedAt) {
      return 1;
    }

    return Math.min(1, Math.max(0, (now - startedAt) / VISITED_GRID_FADE_DURATION_MS));
  }

  /** visitedGridRefreshVersion をインクリメントして DB 再取得をトリガーする。 */
  const incrementVisitedGridRefreshVersion = useCallback((): void => {
    setVisitedGridRefreshVersion((version) => version + 1);
  }, []);

  /**
   * 表示範囲に含まれるvisited cellを読み込み、新規セルを判定する。
   */
  useEffect(() => {
    if (!isReady) {
      return;
    }

    const bounds = getGridBoundsForRegion(gridOverlayRegion, { paddingRatio: GRID_OVERLAY_CONFIG.boundsPaddingRatio });
    const displayCellSizeMeters = getStableDisplayCellSizeMeters(
      gridOverlayRegion,
      visitedGridDisplayCellSizeRef.current,
      GRID_OVERLAY_CONFIG,
    );
    visitedGridDisplayCellSizeRef.current = displayCellSizeMeters;

    // 取得済み範囲内かつデータ未更新なら再取得を省く。
    const lastFetch = lastVisitedGridFetchRef.current;
    const coveredByLastFetch =
      lastFetch != null &&
      lastFetch.version === visitedGridRefreshVersion &&
      lastFetch.cellSizeMeters === displayCellSizeMeters &&
      isGridBoundsContained(lastFetch.bounds, bounds);

    if (coveredByLastFetch) {
      return;
    }

    let isCancelled = false;
    const fetchStartedAt = Date.now();

    getVisitedCellsInBounds(bounds, displayCellSizeMeters)
      .then((cells) => {
        if (isCancelled) {
          return;
        }

        const fetchedAt = Date.now();
        // 表示セルサイズが変わるとセルIDの意味が変わるため、前回状態を引き継がない。
        const isSameCellSize = lastFetch != null && lastFetch.cellSizeMeters === displayCellSizeMeters;
        const freshCellIds = resolveFreshVisitedCellIds({
          previousFreshCellIds: isSameCellSize ? lastFetch.freshCellIds : new Set<string>(),
          previousCellIds: isSameCellSize ? lastFetch.cellIds : new Set<string>(),
          previousBounds: isSameCellSize ? lastFetch.bounds : null,
          nextCells: cells,
          displayCellSizeMeters,
          baseCellSizeMeters: GRID_OVERLAY_CONFIG.baseCellSizeMeters,
          maxFreshCellCount: MAX_FRESH_VISITED_CELL_COUNT,
        });

        lastVisitedGridFetchRef.current = {
          bounds,
          cellSizeMeters: displayCellSizeMeters,
          version: visitedGridRefreshVersion,
          cellIds: new Set(cells.map((cell) => cell.cellId)),
          freshCellIds,
        };
        visitedGridTimingRef.current = { fetchMs: fetchedAt - fetchStartedAt, aggregationMs: Date.now() - fetchedAt };
        syncVisitedGridFadeState(freshCellIds);
        setVisitedGridSource({ cells, freshCellIds });
      })
      .catch((error: unknown) => {
        console.warn('Failed to refresh visited grid cells:', error);
      });

    return () => {
      isCancelled = true;
    };
  }, [gridOverlayRegion, isReady, visitedGridRefreshVersion]);

  /** 既存セルを結合し、新規セルと分けた描画元データ。 */
  const coalescedVisitedGrid = useMemo(
    () => coalesceVisitedGridCells(visitedGridSource.cells, visitedGridSource.freshCellIds),
    [visitedGridSource],
  );

  /**
   * 新規visited cellのフェード中だけ短い間隔で再描画する。
   * 対象はfresh cellだけなので、大量セルの再表示ではフレーム更新が走らない。
   */
  useEffect(() => {
    const now = Date.now();
    const hasActiveFade = coalescedVisitedGrid.freshCells.some((cell) => getVisitedGridFadeProgress(cell.cellId, now) < 1);

    if (!hasActiveFade) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setVisitedGridFadeFrame((frame) => frame + 1);
    }, VISITED_GRID_FADE_FRAME_MS);

    return () => clearTimeout(timeoutId);
  }, [visitedGridFadeFrame, coalescedVisitedGrid]);

  const gridOverlayOpacity = useMemo(() => getFogOpacity(gridOverlayRegion, GRID_OVERLAY_CONFIG), [gridOverlayRegion]);

  /**
   * 結合済みの既存セルのPolygonデータ。
   * フェードの影響を受けないため、フェード中も同じ配列を使い回してPolygonのprops更新を避ける。
   */
  const stableOverlayCells = useMemo<VisitedGridOverlayCell[]>(
    () => toVisitedGridOverlayCells(coalescedVisitedGrid.stableCells, gridOverlayOpacity, themePrimaryColor, GRID_OVERLAY_CONFIG),
    [coalescedVisitedGrid, gridOverlayOpacity, themePrimaryColor],
  );

  /** フェード進捗を適用した新規セルのPolygonデータ。 */
  const freshOverlayCells = useMemo<VisitedGridOverlayCell[]>(() => {
    // eslint-disable-next-line react-hooks/purity -- フェード進捗は visitedGridFadeFrame の更新を契機に現在時刻で再計算する
    const now = Date.now();

    return toVisitedGridOverlayCells(
      coalescedVisitedGrid.freshCells,
      gridOverlayOpacity,
      themePrimaryColor,
      GRID_OVERLAY_CONFIG,
      (cell) => getVisitedGridFadeProgress(cell.cellId, now),
    );
    // visitedGridFadeFrame はフェード中の再計算を強制するための意図的な依存(値自体は未使用)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- フェード再計算のトリガーとして依存に残す
  }, [coalescedVisitedGrid, gridOverlayOpacity, themePrimaryColor, visitedGridFadeFrame]);

  const visitedGridCells = useMemo<VisitedGridOverlayCell[]>(
    () => [...stableOverlayCells, ...freshOverlayCells],
    [stableOverlayCells, freshOverlayCells],
  );

  /** 開発フラグ有効時だけ、取得・結合・描画のコストを出力する。 */
  useEffect(() => {
    logVisitedGridMetrics({
      rawCellCount: visitedGridSource.cells.length,
      stableCellCount: visitedGridSource.cells.length - coalescedVisitedGrid.freshCells.length,
      freshCellCount: coalescedVisitedGrid.freshCells.length,
      renderPolygonCount: visitedGridCells.length,
      coalescedBlockCountBySize: coalescedVisitedGrid.blockCountBySize,
      fetchMs: visitedGridTimingRef.current.fetchMs,
      aggregationMs: visitedGridTimingRef.current.aggregationMs,
      overlayBuildMs: 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 描画データが確定したときだけ出力する
  }, [visitedGridCells]);

  return {
    visitedGridCells,
    gridOverlayOpacity,
    incrementVisitedGridRefreshVersion,
  };
}
```

`overlayBuildMs` は Step 4 で埋める。

- [ ] **Step 4: overlayBuildMs を実測値にする**

`stableOverlayCells` / `freshOverlayCells` の memo をそれぞれ次の形にして、`visitedGridTimingRef` に加算する。

```typescript
  const stableOverlayCells = useMemo<VisitedGridOverlayCell[]>(() => {
    // eslint-disable-next-line react-hooks/purity -- 開発用の処理時間計測。描画結果には影響しない
    const startedAt = Date.now();
    const overlayCells = toVisitedGridOverlayCells(
      coalescedVisitedGrid.stableCells,
      gridOverlayOpacity,
      themePrimaryColor,
      GRID_OVERLAY_CONFIG,
    );
    visitedGridTimingRef.current.overlayBuildMs = Date.now() - startedAt;

    return overlayCells;
  }, [coalescedVisitedGrid, gridOverlayOpacity, themePrimaryColor]);
```

`visitedGridTimingRef` の初期値へ `overlayBuildMs: 0` を追加し、計測ログでは `visitedGridTimingRef.current.overlayBuildMs` を渡す。

- [ ] **Step 5: テストを実行して成功を確認する**

Run: `npx jest src/ui/hooks/__tests__/useVisitedGridOverlay.test.tsx`
Expected: PASS

- [ ] **Step 6: 地図関連の既存テストを回す**

Run: `npx jest src/ui src/features/map`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
git add src/ui/hooks/useVisitedGridOverlay.ts src/ui/hooks/__tests__/useVisitedGridOverlay.test.tsx
git commit -m "feat(map): 新規セルのみフェードし既存セルのPolygonを結合する"
```

---

### Task 6: 200m以上の表示セルをSQLite側で集約する

**Files:**

- Modify: `src/features/location/visitedCellRepository.ts`
- Modify: `src/features/location/__tests__/visitedCellRepository.test.ts`
- Modify: `src/features/location/grid/gridAggregation.ts`
- Modify: `src/features/location/grid/__tests__/gridAggregation.test.ts`

**Interfaces:**

- Consumes: `GridBounds`
- Produces: `function getVisitedCellsInBounds(bounds: GridBounds, displayCellSizeMeters?: number): Promise<VisitedCellRow[]>`(既定値は `GRID_OVERLAY_CONFIG.baseCellSizeMeters`)

**設計メモ:**

- SQLite の `/` と `%` は0方向への切り捨てのため、負のセル番号(西半球・南半球)で `Math.floor` と結果がずれる。`(x - ((x % r) + r) % r) / r` の形で真の floor 除算にする。
- `SUM` / `MIN` / `MAX` はJS側集約と同じ意味(訪問回数の合計、最古、最新)。
- 100m表示では従来どおり行をそのまま返す。
- SQL集約へ移すことで `aggregateVisitedCells` の呼び出し元がなくなるため削除する。表示セルサイズの選択(`getDisplayCellSizeMeters` / `getStableDisplayCellSizeMeters`)は残す。

- [ ] **Step 1: 失敗するテストを書く**

`src/features/location/__tests__/visitedCellRepository.test.ts` へ追記:

```typescript
  it('100m表示では100mセルをそのまま取得する', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValue([]);

    await getVisitedCellsInBounds({ minX: 1, maxX: 3, minY: 5, maxY: 8 }, 100);

    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('WHERE x BETWEEN ? AND ?'), 1, 3, 5, 8);
    expect(db.getAllAsync).toHaveBeenCalledWith(expect.not.stringContaining('GROUP BY'), 1, 3, 5, 8);
  });

  it('200m表示ではSQL側でブロック集約して行数を減らす', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValue([
      { blockX: -3, blockY: 4, firstVisitedAt: '2026-05-01T00:00:00.000Z', lastVisitedAt: '2026-05-02T00:00:00.000Z', visitCount: 7 },
    ]);

    const cells = await getVisitedCellsInBounds({ minX: -6, maxX: 3, minY: 5, maxY: 8 }, 200);

    const [sql] = (db.getAllAsync as jest.Mock).mock.calls[0];
    expect(sql).toContain('GROUP BY blockX, blockY');
    expect(sql).toContain('MIN(first_visited_at)');
    expect(sql).toContain('MAX(last_visited_at)');
    expect(sql).toContain('SUM(visit_count)');
    expect(cells).toEqual([
      {
        cellId: '200:-3:4',
        cellSizeMeters: 200,
        x: -3,
        y: 4,
        firstVisitedAt: '2026-05-01T00:00:00.000Z',
        lastVisitedAt: '2026-05-02T00:00:00.000Z',
        visitCount: 7,
      },
    ]);
  });

  it('集約時の除算は負のセル番号でも切り捨て方向を揃える', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValue([]);

    await getVisitedCellsInBounds({ minX: -6, maxX: 3, minY: 5, maxY: 8 }, 500);

    const [sql, ...params] = (db.getAllAsync as jest.Mock).mock.calls[0];
    // 0方向へ切り捨てるSQLiteの除算を、負値でも floor と一致させる式になっていること
    expect(sql).toContain('((x % ?) + ?) % ?');
    expect(params.slice(-4)).toEqual([-6, 3, 5, 8]);
  });

  it('基本セルサイズの倍数でない表示セルサイズは拒否する', async () => {
    await expect(getVisitedCellsInBounds({ minX: 0, maxX: 1, minY: 0, maxY: 1 }, 150)).rejects.toThrow();
  });
```

`src/features/location/grid/__tests__/gridAggregation.test.ts` からは `aggregateVisitedCells` の import と、その関数を対象にした `it` ブロックをすべて削除する(`getDisplayCellSizeMeters` / `getStableDisplayCellSizeMeters` のテストは残す)。

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx jest src/features/location/__tests__/visitedCellRepository.test.ts`
Expected: FAIL(集約SQLが生成されない)

- [ ] **Step 3: リポジトリを実装する**

`src/features/location/visitedCellRepository.ts` の `getVisitedCellsInBounds` を置き換え、`GRID_OVERLAY_CONFIG` を import する:

```typescript
/**
 * 表示範囲に含まれるvisited cellを取得する。
 *
 * 表示セルサイズが基本セルサイズより大きい場合は、JSへ大量の100mセルを渡さないよう
 * SQLite側でブロック集約する。SQLiteの除算・剰余は0方向への切り捨てのため、
 * 負のセル番号でも `Math.floor` と一致するよう補正した式を使う。
 *
 * @param bounds - 基本100mセル番号範囲。
 * @param displayCellSizeMeters - 表示に使うセルサイズ。基本セルサイズの倍数であること。
 * @returns 範囲内のvisited cell。表示セルサイズで集約済み。
 */
export async function getVisitedCellsInBounds(
  bounds: GridBounds,
  displayCellSizeMeters: number = GRID_OVERLAY_CONFIG.baseCellSizeMeters,
): Promise<VisitedCellRow[]> {
  const baseCellSizeMeters = GRID_OVERLAY_CONFIG.baseCellSizeMeters;

  if (displayCellSizeMeters % baseCellSizeMeters !== 0 || displayCellSizeMeters < baseCellSizeMeters) {
    throw new Error(`displayCellSizeMeters must be a multiple of base cell size (${baseCellSizeMeters}).`);
  }

  const ratio = displayCellSizeMeters / baseCellSizeMeters;

  if (ratio === 1) {
    return db.getAllAsync<VisitedCellRow>(
      `SELECT ${visitedCellColumns}
       FROM visited_cells
       WHERE x BETWEEN ? AND ?
         AND y BETWEEN ? AND ?
       ORDER BY cell_size_meters ASC, y ASC, x ASC, cell_id ASC`,
      bounds.minX,
      bounds.maxX,
      bounds.minY,
      bounds.maxY,
    );
  }

  const rows = await db.getAllAsync<AggregatedVisitedCellRow>(
    `SELECT
       (x - ((x % ?) + ?) % ?) / ? as blockX,
       (y - ((y % ?) + ?) % ?) / ? as blockY,
       MIN(first_visited_at) as firstVisitedAt,
       MAX(last_visited_at) as lastVisitedAt,
       SUM(visit_count) as visitCount
     FROM visited_cells
     WHERE x BETWEEN ? AND ?
       AND y BETWEEN ? AND ?
     GROUP BY blockX, blockY
     ORDER BY blockY ASC, blockX ASC`,
    ratio,
    ratio,
    ratio,
    ratio,
    ratio,
    ratio,
    ratio,
    ratio,
    bounds.minX,
    bounds.maxX,
    bounds.minY,
    bounds.maxY,
  );

  return rows.map((row) => ({
    cellId: `${displayCellSizeMeters}:${row.blockX}:${row.blockY}`,
    cellSizeMeters: displayCellSizeMeters,
    x: row.blockX,
    y: row.blockY,
    firstVisitedAt: row.firstVisitedAt,
    lastVisitedAt: row.lastVisitedAt,
    visitCount: row.visitCount,
  }));
}
```

型定義をファイル上部へ追加:

```typescript
/** SQL側でブロック集約したvisited cell行。 */
type AggregatedVisitedCellRow = {
  /** 表示セル単位のX番号。 */
  blockX: number;
  /** 表示セル単位のY番号。 */
  blockY: number;
  /** ブロック内の最古の訪問日時。 */
  firstVisitedAt: string;
  /** ブロック内の最新の訪問日時。 */
  lastVisitedAt: string;
  /** ブロック内の訪問回数合計。 */
  visitCount: number;
};
```

- [ ] **Step 4: `aggregateVisitedCells` を削除する**

`src/features/location/grid/gridAggregation.ts` から `aggregateVisitedCells` と、そこだけで使う `getEarlierIsoString` / `getLaterIsoString` と `GridCell` の import を削除する。

Run: `grep -rn "aggregateVisitedCells" src`
Expected: 出力なし

- [ ] **Step 5: テストを実行して成功を確認する**

Run: `npx jest src/features/location src/ui/hooks/__tests__/useVisitedGridOverlay.test.tsx`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/features/location/visitedCellRepository.ts src/features/location/__tests__/visitedCellRepository.test.ts src/features/location/grid/gridAggregation.ts src/features/location/grid/__tests__/gridAggregation.test.ts
git commit -m "feat(map): 200m以上の表示セルをSQLite側で集約する"
```

---

### Task 7: ドキュメント更新と全体検証

**Files:**

- Modify: `docs/map-rendering.md`(4.2 Visited Grid Overlay / 9 パフォーマンス方針)

- [ ] **Step 1: `docs/map-rendering.md` の 4.2 を更新する**

「表示セルは1セル1Polygonとして描画し、セル同士の境界線は描画しない。隣接セルの矩形結合は、ズーム・パン・再取得時に表示IDやフェード単位が変わりやすくなるため行わない。」の段落を、次の内容へ置き換える:

```markdown
表示セル同士の境界線は描画しない。描画コストを下げるため、既存セル(stable cell)については、グリッド整列した正方形ブロック(`4x4`、`2x2`)が**完全に埋まっている場合だけ**1つの大きいPolygonへ結合する。ブロック内に未訪問セルが1つでもあれば結合せず、より小さいブロックか単体セルへ落とす。この結合は保存データの集約ではなく描画最適化であり、未訪問エリアを塗らないため100m四方の表示意味は保たれる。ブロックはグリッド整列のみを対象とし、任意長方形結合と `8x8` 以上の結合は行わない。整列ブロックに限定することで、スクロールしてもPolygonのIDが安定する。

visited cell は fresh cell と stable cell に分けて扱う。fresh cell はGPS記録で新しく開いたセルで、0.5秒のフェードイン対象かつPolygon結合の対象外(100mセルのまま表示)とする。fresh cell は表示範囲から外れた時点で stable cell 扱いになり、再表示時に周囲が完全に埋まっていれば結合対象になる。スクロールや定期再取得で表示範囲に入っただけの既存セルはフェードせず即時表示する。判定は「前回取得済み範囲に完全に含まれるのに前回は返らなかったセル」を fresh とするルールで行い、判定が曖昧なセルはフェードしない側へ倒す。一度に大量のセルがfresh判定された場合はフェードを行わない。
```

- [ ] **Step 2: `docs/map-rendering.md` の 4.2 へGrid更新タイミングを追記する**

「表示範囲内のvisited cell取得では、…」の段落の直後へ次を追加する:

```markdown
Visited Grid の取得に使う表示範囲は、地図カメラの表示範囲とは別に保持する。ユーザーが指で地図を動かしている間(`onPanDrag` 以降、操作完了まで)はGrid取得用の表示範囲を更新せず、SQLite取得と大量Polygon更新を走らせない。操作が完了した時点(`onRegionChangeComplete`)でまとめて追従する。現在地追従モードの自動移動、現在地ボタン、地図復帰などのプログラム移動はユーザー操作として扱わず、従来どおり即時にGridを同期する。
```

- [ ] **Step 3: `docs/map-rendering.md` の 9 へパフォーマンス方針を追記する**

「メインマップでは表示範囲内のvisited cellを取得し、ズームに応じて集約して描画する」の直後へ次の3行を追加する:

```markdown
- 200m以上の表示セルでは、100mセルをすべてJSへ渡さずSQLite側でブロック集約する(`MIN(first_visited_at)` / `MAX(last_visited_at)` / `SUM(visit_count)`)
- 既存セルは完全に埋まった正方形ブロックだけをPolygon結合し、MapViewへ渡すPolygon数を減らす
- 開発中は `EXPO_PUBLIC_LOG_VISITED_GRID_METRICS=true` でセル数・Polygon数・削減率・処理時間を確認できる(本番ユーザーには出力しない。座標や移動履歴は出力しない)
```

- [ ] **Step 4: 全体検証を実行する**

```bash
npm run typecheck
npm test
npm run lint
npm run format:check
```

Expected: typecheck 成功 / test 全件 PASS / lint error 0 / format 差分なし(差分があれば `npm run format` を実行して差分をコミットへ含める)

- [ ] **Step 5: コミット**

```bash
git add docs/map-rendering.md
git commit -m "docs(map): Visited Gridの更新タイミングとPolygon結合方針を追記"
```

- [ ] **Step 6: 実機・シミュレータでの確認手順をPR説明用にまとめる**

自動テストでは検証できない項目のため、手動確認手順として記録する。

1. `EXPO_PUBLIC_LOG_VISITED_GRID_METRICS=true` で起動する
2. visited cell が密な地域を100m表示で開き、`[VisitedGrid] raw=... render=... reduction=...%` のログで `render < raw` を確認する
3. 地図を指でドラッグしている最中に `fetchMs` / `aggregationMs` / `overlayBuildMs` のログが連発しないこと、指を離した後に1回更新されることを確認する
4. 現在地ボタンを押すと追従が再開し、Grid が即時追従することを確認する
5. 別画面から地図へ戻ったときに表示範囲と Grid が復元されることを確認する

---

## 自己レビュー結果

- **issue の受け入れ条件との対応**: スクロール中のGrid更新停止=Task 4 / fresh cell のフェード限定=Task 2・5 / fresh cell の非結合と画面外でのstable化=Task 2・3・5 / 正方形ブロック結合=Task 3 / `8x8`・任意長方形の除外=Task 3(`VISITED_GRID_COALESCE_BLOCK_SIZES`) / 未訪問セルを塗らない=Task 3 / `renderPolygonCount < rawCellCount` の確認=Task 1・5・7 / 市松模様のフォールバック=Task 3 / SQL集約=Task 6 / ドキュメント=Task 7 / テスト=各タスク / typecheck・lint・test=Task 7。
- **`incrementVisitedGridRefreshVersion` は公開APIとして維持**するため、`useLocationRecordingSync` / `useMapFollowState` からの呼び出しは変更不要。
- **`MapScreen` は変更不要**: `visitedGridCells` の要素数と `coordinates` が変わるだけで、props の形は同じ。既存の `MapScreen.test.tsx` がそのまま回帰テストになる。
