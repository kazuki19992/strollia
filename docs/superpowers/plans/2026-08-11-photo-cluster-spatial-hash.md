# 写真クラスタリング O(N)化(Phase 2 / 2-a)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `clusterMapPhotosByRadius` の計算量を O(N²) から O(N) へ改善し(空間ハッシュ化)、クラスタ半径を離散段階へ量子化してパン時のメモ化ミスを緩和する。クラスタリング結果は現行実装とビット単位で同一に保つ。

**Architecture:** `src/features/photos/photoClusters.ts` 内で完結する変更。`getPhotoClusterRadiusMeters` を連続式から段階選択へ、`clusterMapPhotosByRadius` の内部実装を全走査から `@/features/location/grid/gridCell` の `coordinateToGridCell` を使った空間ハッシュへ置き換える。`usePhotoClusters` フックは新しいヒステリシス関数を呼ぶよう配線し直す。

**Tech Stack:** TypeScript / Jest / React Native (Testing Library `renderHook`)

## Global Constraints

- コミットメッセージは Semantic Commit Message(`type(scope): 日本語の説明`)。type は英語、説明は日本語(`AGENTS.md` §1)
- コード追加・変更には対応するテストを必ず用意する(`AGENTS.md` §2)
- 関数・型・自明でない変数には日本語 JSDoc を付ける。「なぜその設計にしているか」も書く(`AGENTS.md` §8)
- テストの `describe`/`test`/`it` 説明文は日本語(`AGENTS.md` §9)
- `../` を含む相対 import は禁止。`@/` パスエイリアスを使う(`.ai/context/conventions.md`)
- 各タスクのコミット前に `npm run typecheck` と該当テストを実行する
- **クラスタリング結果は現行実装とビット単位で同一でなければならない**(設計書 §3.3)。索引(空間ハッシュ)は候補の絞り込みにのみ使い、距離判定・採用基準(最近傍・半径内・連鎖防止)は一切変更しない
- 対象は `docs/superpowers/specs/2026-08-11-photo-cluster-spatial-hash-design.md`。ネイティブコード変更・Phase 2 の他ステップ(2-b/2-c)は対象外
- 新規コードは `GridOverlayConfig` 型に依存させない(写真クラスタ専用の定数・段階テーブルを持つ)

---

### Task 1: クラスタ半径の量子化とヒステリシス

**Files:**

- Modify: `src/features/photos/photoClusters.ts`
- Modify: `src/features/photos/__tests__/photoClusters.test.ts`

**Interfaces:**

- Produces: `getPhotoClusterRadiusMeters(region: Region | null): number`(既存の公開関数。シグネチャは変えず内部実装のみ変更)
- Produces: `getStablePhotoClusterRadiusMeters(region: Region | null, previousRadiusMeters: number | null): number`(新規 export)

段階テーブルの境界は既存の連続式(`radius = latitudeDelta × METERS_PER_LATITUDE_DEGREE(111000) × REGION_CLUSTER_RATIO(0.03)` = `latitudeDelta × 3330`)に沿って選ぶ。ヒステリシス比率は `gridAggregation.ts` の `GRID_OVERLAY_CONFIG.displayCellSizeHysteresisRatio` と同じ 0.2 を踏襲する。

- [ ] **Step 1: 失敗するテストを書く(段階選択)**

`src/features/photos/__tests__/photoClusters.test.ts` の `describe('写真クラスタ半径 getPhotoClusterRadiusMeters', ...)` ブロック全体を、以下へ置き換える(連続値・線形増加を前提にした既存アサーションは段階制と両立しないため、段階制を直接検証する内容へ刷新する)。

```typescript
describe('写真クラスタ半径 getPhotoClusterRadiusMeters', () => {
  it('各段階の境界でちょうど切り替わる', () => {
    // 境界未満は手前の段階、境界以上は次の段階になる。
    expect(getPhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.0029 })).toBe(10);
    expect(getPhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.003 })).toBe(30);
    expect(getPhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.0089 })).toBe(30);
    expect(getPhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.009 })).toBe(75);
  });

  it('極端に狭い表示範囲では最小段階(10m)になる', () => {
    expect(getPhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.00001 })).toBe(10);
  });

  it('最終段階(15000m, 境界4.5)を超える広域表示では世界地図相当のフォールバック値になる', () => {
    expect(getPhotoClusterRadiusMeters({ ...region, latitudeDelta: 4.5 })).toBe(3_000_000);
    expect(getPhotoClusterRadiusMeters({ ...region, latitudeDelta: 180 })).toBe(3_000_000);
  });

  it('表示範囲がない場合は近距離用の既定値(latitudeDelta=0.01相当)を使う', () => {
    expect(getPhotoClusterRadiusMeters(null)).toBe(75);
  });

  // パン(中心移動のみ)でクラスタを再計算しないメモ化は、この性質が前提になっている。
  it('中心座標だけが変わっても(パン)クラスタ範囲は変化しない', () => {
    const beforePan = getPhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.08 });
    const afterPan = getPhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.08, latitude: 40, longitude: -73 });

    expect(afterPan).toBe(beforePan);
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npm test -- src/features/photos/__tests__/photoClusters.test.ts`
Expected: FAIL(既存の `getPhotoClusterRadiusMeters` は連続値を返すため、上記の段階値アサーションと一致しない)

- [ ] **Step 3: 段階テーブルと `getPhotoClusterRadiusMeters` を実装する**

`src/features/photos/photoClusters.ts` の `FALLBACK_LATITUDE_DELTA` 等の定数定義の直後に追加する。

```typescript
/** 写真クラスタ半径の1段階。 */
type PhotoClusterRadiusStage = {
  /** この段階で使う半径メートル。 */
  radiusMeters: number;
  /** この段階を使う latitudeDelta の上限(この値未満まで)。 */
  maxLatitudeDelta: number;
};

/**
 * 写真クラスタ半径の段階テーブル。連続値だった半径を離散段階へ丸めることで、
 * Web Mercator投影の緯度歪みによりパン時にlatitudeDeltaがbit単位で変化しても
 * メモ化(usePhotoClusters)がヒットしやすくなる。境界は旧来の連続式
 * (radius = latitudeDelta × METERS_PER_LATITUDE_DEGREE × REGION_CLUSTER_RATIO)の
 * 傾きに沿って選んでいるため、量子化以外の挙動変化を最小にしている。
 */
const PHOTO_CLUSTER_RADIUS_STAGES: PhotoClusterRadiusStage[] = [
  { radiusMeters: 10, maxLatitudeDelta: 0.003 },
  { radiusMeters: 30, maxLatitudeDelta: 0.009 },
  { radiusMeters: 75, maxLatitudeDelta: 0.0225 },
  { radiusMeters: 150, maxLatitudeDelta: 0.045 },
  { radiusMeters: 300, maxLatitudeDelta: 0.09 },
  { radiusMeters: 750, maxLatitudeDelta: 0.225 },
  { radiusMeters: 1500, maxLatitudeDelta: 0.45 },
  { radiusMeters: 3000, maxLatitudeDelta: 0.9 },
  { radiusMeters: 7500, maxLatitudeDelta: 2.25 },
  { radiusMeters: 15000, maxLatitudeDelta: 4.5 },
];

/**
 * 段階テーブルを超える広域表示(latitudeDelta >= 4.5)で使うフォールバック半径。
 * 世界地図相当の大きさにすることで、地図が表現できる現実的な範囲内では
 * 実質「上限なし」だった旧来の挙動と区別がつかないようにする。
 */
const PHOTO_CLUSTER_RADIUS_WORLD_FALLBACK_METERS = 3_000_000;

/** 段階境界のちらつき防止に使うヒステリシス比率。visited grid(GRID_OVERLAY_CONFIG)と同じ値を踏襲する。 */
const PHOTO_CLUSTER_RADIUS_HYSTERESIS_RATIO = 0.2;

/**
 * 表示範囲の広さから写真クラスタ半径の段階indexを選ぶ。
 *
 * @param latitudeDelta - 絶対値化済みのlatitudeDelta。
 * @returns 0始まりの段階index。定義済み範囲より広い場合は段階数(=フォールバックを示す)。
 */
function getPhotoClusterRadiusStageIndex(latitudeDelta: number): number {
  const stageIndex = PHOTO_CLUSTER_RADIUS_STAGES.findIndex((stage) => latitudeDelta < stage.maxLatitudeDelta);

  return stageIndex >= 0 ? stageIndex : PHOTO_CLUSTER_RADIUS_STAGES.length;
}
```

既存の `getPhotoClusterRadiusMeters` 関数本体を、以下へ置き換える(シグネチャ・JSDocの対象は同じ)。

```typescript
/**
 * 地図の表示範囲から写真クラスタ半径をメートル単位で求める(段階選択のみ、ヒステリシスなし)。
 *
 * @param region - 現在の地図表示範囲。未取得の場合は近距離用の既定値を使う。
 * @returns 段階選択されたクラスタ半径メートル。
 */
export function getPhotoClusterRadiusMeters(region: Region | null): number {
  const latitudeDelta = Math.abs(region?.latitudeDelta ?? FALLBACK_LATITUDE_DELTA);
  const stageIndex = getPhotoClusterRadiusStageIndex(latitudeDelta);

  return stageIndex < PHOTO_CLUSTER_RADIUS_STAGES.length
    ? PHOTO_CLUSTER_RADIUS_STAGES[stageIndex].radiusMeters
    : PHOTO_CLUSTER_RADIUS_WORLD_FALLBACK_METERS;
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npm test -- src/features/photos/__tests__/photoClusters.test.ts`
Expected: `写真クラスタ半径 getPhotoClusterRadiusMeters` の5件 PASS(他ブロックは既存実装のままなので現時点では無視してよい)

- [ ] **Step 5: 失敗するテストを書く(ヒステリシス)**

`describe('写真クラスタ半径 getPhotoClusterRadiusMeters', ...)` ブロックの直後に新しい describe を追加する。

```typescript
describe('写真クラスタ半径のヒステリシス getStablePhotoClusterRadiusMeters', () => {
  it('前回値がない場合は段階選択した値をそのまま返す', () => {
    expect(getStablePhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.04 }, null)).toBe(150);
  });

  it('段階境界をわずかに超えるだけならヒステリシス帯の範囲内で前回値を維持する', () => {
    // 段階3(150m)→4(300m)の境界は0.045。ヒステリシス比率0.2により、
    // 0.045 * 1.2 = 0.054 未満なら前回値を維持する。
    const stableRadius = getStablePhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.05 }, 150);

    expect(stableRadius).toBe(150);
  });

  it('ヒステリシス帯を明確に超えたら次の段階へ切り替える', () => {
    const stableRadius = getStablePhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.06 }, 150);

    expect(stableRadius).toBe(300);
  });

  it('段階を縮小方向にまたぐときも同じヒステリシスが働く', () => {
    // 境界0.045未満、かつヒステリシス帯の下限(0.045 * 0.8 = 0.036)以上なら前回値(300)を維持する。
    const stableWithinBand = getStablePhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.04 }, 300);
    expect(stableWithinBand).toBe(300);

    const stableBelowBand = getStablePhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.03 }, 300);
    expect(stableBelowBand).toBe(150);
  });

  it('2段階以上離れた変化ではヒステリシスを無視して即座に切り替える', () => {
    const stableRadius = getStablePhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.08 }, 75);

    expect(stableRadius).toBe(300);
  });

  it('前回値が段階テーブルに存在しない場合は素直に段階選択した値を返す', () => {
    const stableRadius = getStablePhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.05 }, 999);

    expect(stableRadius).toBe(300);
  });
});
```

このテストが `getStablePhotoClusterRadiusMeters` を import できるよう、ファイル冒頭の import 文を以下に変更する。

```typescript
import {
  clusterMapPhotos,
  clusterMapPhotosByRadius,
  getPhotoClusterRadiusMeters,
  getStablePhotoClusterRadiusMeters,
  paginateMapPhotos,
} from '@/features/photos/photoClusters';
```

- [ ] **Step 6: テストを実行し失敗を確認する**

Run: `npm test -- src/features/photos/__tests__/photoClusters.test.ts`
Expected: FAIL(`getStablePhotoClusterRadiusMeters` が未エクスポート)

- [ ] **Step 7: `getStablePhotoClusterRadiusMeters` を実装する**

`getPhotoClusterRadiusMeters` 関数の直後に追加する。

```typescript
/**
 * 表示セルサイズの切替境界付近で直前の半径を維持し、ズーム操作中のちらつきと
 * パン時のメモ化ミスを抑える。gridAggregation.ts の getStableDisplayCellSizeMeters と
 * 同じヒステリシスパターンだが、写真クラスタ専用の段階テーブル・比率を使う。
 *
 * @param region - 現在の地図表示範囲。
 * @param previousRadiusMeters - 直前に使った半径。初回は null。
 * @returns ヒステリシスを加味した半径メートル。
 */
export function getStablePhotoClusterRadiusMeters(region: Region | null, previousRadiusMeters: number | null): number {
  const nextRadiusMeters = getPhotoClusterRadiusMeters(region);

  if (!previousRadiusMeters || previousRadiusMeters === nextRadiusMeters) {
    return nextRadiusMeters;
  }

  const radiusValues = [...PHOTO_CLUSTER_RADIUS_STAGES.map((stage) => stage.radiusMeters), PHOTO_CLUSTER_RADIUS_WORLD_FALLBACK_METERS];
  const previousIndex = radiusValues.indexOf(previousRadiusMeters);
  const nextIndex = radiusValues.indexOf(nextRadiusMeters);

  if (previousIndex < 0 || nextIndex < 0 || Math.abs(previousIndex - nextIndex) > 1) {
    return nextRadiusMeters;
  }

  const boundary = PHOTO_CLUSTER_RADIUS_STAGES[Math.min(previousIndex, nextIndex)]?.maxLatitudeDelta;

  if (!boundary) {
    return nextRadiusMeters;
  }

  const latitudeDelta = Math.abs(region?.latitudeDelta ?? FALLBACK_LATITUDE_DELTA);

  if (nextIndex > previousIndex && latitudeDelta < boundary * (1 + PHOTO_CLUSTER_RADIUS_HYSTERESIS_RATIO)) {
    return previousRadiusMeters;
  }

  if (nextIndex < previousIndex && latitudeDelta >= boundary * (1 - PHOTO_CLUSTER_RADIUS_HYSTERESIS_RATIO)) {
    return previousRadiusMeters;
  }

  return nextRadiusMeters;
}
```

- [ ] **Step 8: テストを実行し成功を確認する**

Run: `npm test -- src/features/photos/__tests__/photoClusters.test.ts`
Expected: 追加した6件 PASS。他のブロック(`clusterMapPhotosByRadius`/`clusterMapPhotos`/`paginateMapPhotos`)は Task 2 で扱うため、この時点では未修正で FAIL のままで構わない

- [ ] **Step 9: 型チェックを実行する**

Run: `npm run typecheck`
Expected: エラー0件

- [ ] **Step 10: コミット**

```bash
git add src/features/photos/photoClusters.ts src/features/photos/__tests__/photoClusters.test.ts
git commit -m "feat(photos): 写真クラスタ半径を離散段階へ量子化しヒステリシスを追加する"
```

---

### Task 2: 空間ハッシュによる O(N) クラスタリング

**Files:**

- Modify: `src/features/photos/photoClusters.ts`
- Modify: `src/features/photos/__tests__/photoClusters.test.ts`

**Interfaces:**

- Consumes: `coordinateToGridCell(coordinate: LatLng, cellSizeMeters?: number): GridCell`(`@/features/location/grid/gridCell` の既存 export。`GridCell` は `{ cellId: string; cellSizeMeters: number; x: number; y: number; ... }`。`cellId` の形式は `` `${cellSizeMeters}:${x}:${y}` ``)
- Consumes: `distanceMeters(a: CoordinateLike, b: CoordinateLike): number`(`@/utils/distance` の既存 export。`photoClusters.ts` で既に import 済み)
- Produces: `clusterMapPhotosByRadius(photos: MapPhoto[], clusterRadiusMeters: number): MapPhotoCluster[]`(既存の公開関数。シグネチャ不変、内部実装のみ変更)

**この設計により、現行実装とビット単位で同一の出力になる。** 空間ハッシュは候補を絞り込むための索引としてのみ使い、距離判定(`distanceMeters`)・採用基準(最近傍・半径内)は一切変更しない。

**Task 1 完了後に判明した前提修正**: Task 1 の量子化により、既定 `region`(`latitudeDelta: 0.01`)の半径が 33.3m → 75m へ変わった。この結果、`写真クラスタ clusterMapPhotos` describe block 内の2件のテストが、この既定半径をそのまま使った固定座標のせいで**期待値と矛盾するようになっている**(クラスタリングアルゴリズム自体は正しいまま)。空間ハッシュ化はアルゴリズムを変えないためこの2件は自然には直らない。Step 0 として先に修正する。

- [ ] **Step 0: 量子化で無効になった既存フィクスチャを修正する**

`src/features/photos/__tests__/photoClusters.test.ts` の `describe('写真クラスタ clusterMapPhotos', ...)` 内、以下の2テストの本体をそれぞれ置き換える(テスト名・アサーションの意図は変えない。座標だけを新半径75mに合わせて調整する)。

置き換え前後で座標だけが変わる。旧: `createPhoto('a', 35.0001, 139.0001, 1), createPhoto('b', 35.0007, 139.0001, 2)`(緯度差0.0006° ≒ 66.8m。旧半径33.3mでは「別クラスタ」だったが、新半径75mでは同一クラスタに吸収されてしまい `toHaveLength(2)` に矛盾する)。

```typescript
it('同じ場所と言えない距離の写真は別クラスタに分ける', () => {
  // 緯度差0.0009°(約100m)。段階量子化後の既定半径(75m)より明確に離す。
  const clusters = clusterMapPhotos([createPhoto('a', 35.0001, 139.0001, 1), createPhoto('b', 35.001, 139.0001, 2)], region);

  expect(clusters).toHaveLength(2);
});
```

旧: `a(35.0001) / b(35.00035) / c(35.0006)`。連鎖防止(seedとの距離のみで判定)を検証する意図だったが、a-c間(緯度差0.0005°≒55.7m)が新半径75m以内に収まってしまい、chain-preventionが働く前に直接1クラスタへまとまってしまい `toBeGreaterThan(1)` に矛盾する。

```typescript
it('連鎖的に離れた写真を巨大クラスタにまとめない', () => {
  // a-b、b-cはそれぞれ約50m(新半径75m以内で直接隣接可能。境界から25m の余裕)だが、
  // a-c間は約100m(新半径75mを25m超える)。b経由で連鎖してもseedはaのまま動かないため、
  // cはaとの直接距離で判定され別クラスタになる(連鎖防止の検証)。
  const clusters = clusterMapPhotos(
    [createPhoto('a', 35.0001, 139.0001, 3), createPhoto('b', 35.00055, 139.0001, 2), createPhoto('c', 35.001, 139.0001, 1)],
    region,
  );

  expect(clusters.length).toBeGreaterThan(1);
});
```

- [ ] **Step 0-確認: テストを実行し、この2件が新半径のもとで正しく PASS することを確認する**

Run: `npm test -- src/features/photos/__tests__/photoClusters.test.ts`
Expected: 上記2件は PASS。他のブロック(`clusterMapPhotosByRadius`/`paginateMapPhotos`/Task 1のヒステリシステスト)も維持されたまま PASS。空間ハッシュ未実装のため、Step 1 以降で追加する等価性テストはまだ存在しない

- [ ] **Step 0-コミット**

```bash
git add src/features/photos/__tests__/photoClusters.test.ts
git commit -m "test(photos): 半径量子化で無効になったクラスタフィクスチャを修正する"
```

- [ ] **Step 1: 失敗するテストを書く(現行実装との等価性)**

`src/features/photos/__tests__/photoClusters.test.ts` の末尾(`describe('写真クラスタページ paginateMapPhotos', ...)` の直後)に追加する。ファイル冒頭の import に `distanceMeters` を追加する。

```typescript
import { distanceMeters } from '@/utils/distance';
```

```typescript
/**
 * テスト用の決定的疑似乱数生成器(mulberry32)。Math.randomを使うとCI環境間で
 * 結果が変わりテストの再現性が失われるため、シード固定の軽量PRNGを使う。
 *
 * @param seed - シード値。
 * @returns 呼ぶたびに0以上1未満の疑似乱数を返す関数。
 */
function createSeededRandom(seed: number): () => number {
  let state = seed;

  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 現行実装(空間ハッシュ)との等価性検証に使う、素朴な全走査のO(N^2)参照実装。
 * clusterMapPhotosByRadius の旧実装(空間ハッシュ導入前)をテスト内に保存したもの。
 *
 * @param photos - クラスタ対象の写真一覧。
 * @param clusterRadiusMeters - 同一クラスタとして扱う半径メートル。
 * @returns 近接写真をまとめたクラスタ一覧。
 */
function referenceClusterMapPhotosByRadius(photos: MapPhoto[], clusterRadiusMeters: number): MapPhotoCluster[] {
  type MutableCluster = { seed: MapPhoto; photos: MapPhoto[] };
  const clusters: MutableCluster[] = [];

  for (const photo of [...photos].sort((a, b) => b.creationTime - a.creationTime)) {
    let nearestCluster: MutableCluster | null = null;
    let nearestDistanceMeters = Number.POSITIVE_INFINITY;

    for (const cluster of clusters) {
      const distanceToSeedMeters = distanceMeters(photo, cluster.seed);

      if (distanceToSeedMeters > clusterRadiusMeters || distanceToSeedMeters >= nearestDistanceMeters) {
        continue;
      }

      nearestCluster = cluster;
      nearestDistanceMeters = distanceToSeedMeters;
    }

    if (!nearestCluster) {
      clusters.push({ seed: photo, photos: [photo] });
      continue;
    }

    nearestCluster.photos.push(photo);
  }

  return clusters.map((cluster, index) => ({
    id: `ref-${index}-${cluster.seed.id}-${cluster.photos.length}`,
    latitude: cluster.seed.latitude,
    longitude: cluster.seed.longitude,
    photos: cluster.photos,
  }));
}

/**
 * クラスタ比較用に、順序に依存しない形へ正規化する。id は実装(空間ハッシュ版/参照版)で
 * 形式が異なるため比較対象から外し、内容(座標・含まれる写真ID集合)だけを比較する。
 *
 * @param clusters - 正規化するクラスタ一覧。
 * @returns 座標順に並べ替えた比較用データ。
 */
function normalizeClustersForComparison(clusters: MapPhotoCluster[]): Array<{ latitude: number; longitude: number; photoIds: string[] }> {
  return clusters
    .map((cluster) => ({
      latitude: cluster.latitude,
      longitude: cluster.longitude,
      photoIds: cluster.photos.map((photo) => photo.id).sort(),
    }))
    .sort((a, b) => (a.photoIds[0] ?? '').localeCompare(b.photoIds[0] ?? ''));
}

describe('新実装(空間ハッシュ)と参照実装(O(N^2))の等価性', () => {
  it('多様な緯度・経度に散らばる写真でも現行実装と同じクラスタリング結果になる', () => {
    const random = createSeededRandom(20260811);
    const photos: MapPhoto[] = Array.from({ length: 300 }, (_, index) => {
      const latitude = random() * 160 - 80; // -80〜80度
      const longitude = random() * 360 - 180; // -180〜180度
      return createPhoto(`photo-${index}`, latitude, longitude, index);
    });

    for (const clusterRadiusMeters of [10, 75, 300, 1500, 7500]) {
      const actual = normalizeClustersForComparison(clusterMapPhotosByRadius(photos, clusterRadiusMeters));
      const expected = normalizeClustersForComparison(referenceClusterMapPhotosByRadius(photos, clusterRadiusMeters));

      expect(actual).toEqual(expected);
    }
  });

  it('高緯度に密集した写真でも現行実装と同じクラスタリング結果になる', () => {
    // 緯度60〜70度(3セル探索で正当性を保証する上限付近、design docの70度に対応)に密集させ、
    // Web Mercatorの緯度歪みが大きい状況で空間ハッシュの候補絞り込みが正しく機能することを確認する。
    const random = createSeededRandom(20260812);
    const photos: MapPhoto[] = Array.from({ length: 200 }, (_, index) => {
      const latitude = 60 + random() * 10; // 60〜70度
      const longitude = random() * 4 - 2; // 狭い経度範囲に密集させ近接ペアを増やす
      return createPhoto(`photo-${index}`, latitude, longitude, index);
    });

    for (const clusterRadiusMeters of [75, 300, 1500]) {
      const actual = normalizeClustersForComparison(clusterMapPhotosByRadius(photos, clusterRadiusMeters));
      const expected = normalizeClustersForComparison(referenceClusterMapPhotosByRadius(photos, clusterRadiusMeters));

      expect(actual).toEqual(expected);
    }
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npm test -- src/features/photos/__tests__/photoClusters.test.ts`
Expected: FAIL または PASS のどちらもありうる(現行の全走査実装自体は正しいアルゴリズムのため、参照実装と一致してしまい意図せず PASS することがある)。**この時点では失敗しなくても問題ない**。このテストの主目的は Step 4 の実装後に「壊した場合に検知できる」回帰テストとして機能させることであり、TDD の RED は Step 6(既存クラスタリングテスト)で確認する

- [ ] **Step 3: 失敗するテストを書く(既存クラスタリングテストの継続)**

既存の `describe('半径指定の写真クラスタ clusterMapPhotosByRadius', ...)` と `describe('写真クラスタ clusterMapPhotos', ...)` はこのタスクでは**変更しない**。空間ハッシュ実装後もこれらが全て PASS することが「外部挙動が変わっていない」ことの回帰確認になる。

- [ ] **Step 4: `clusterMapPhotosByRadius` を空間ハッシュ実装へ置き換える**

`src/features/photos/photoClusters.ts` の import 文に `coordinateToGridCell` を追加する。

```typescript
import { coordinateToGridCell } from '@/features/location/grid/gridCell';
```

既存の `findNearestCluster` 関数を**削除**し、代わりに以下を追加する(配置場所は `clusterMapPhotosByRadius` 関数の直前)。

```typescript
/**
 * クラスタ探索でチェックする隣接セルの半径(自セルを含め (2×3+1)² = 49セル)。
 *
 * セルサイズ = クラスタ半径のため、理論上は1セル分(9セル)で「半径内の全候補」を
 * 見つけられる。しかしこの空間ハッシュは Web Mercator 座標(coordinateToGridCell)を
 * 使っており、Web Mercator は緯度が上がるほど距離を実際より引き伸ばす
 * (緯度46度で最大約1.43倍、緯度70度で約2.92倍)。1セル分の探索だと、緯度によっては
 * 本来半径内にある写真をセル境界の外に見逃す可能性がある。3セル分に広げることで
 * スケール係数3倍(緯度70度相当)まで安全に候補を拾える。49はNに対して定数なので、
 * 全体の計算量は O(N) のまま変わらない。
 */
const CLUSTER_SEARCH_CELL_RADIUS = 3;

/**
 * 写真を追加できる最寄りクラスタを、空間ハッシュで候補を絞り込んで探す。
 * クラスタの代表写真との距離だけを見ることで、連鎖的な巨大クラスタ化を防ぐ(旧実装と同じ)。
 * 索引は候補の絞り込みにのみ使い、距離判定・採用基準は旧実装から変更しない。
 *
 * @param photo - 追加候補の写真。
 * @param clustersByCellId - セルIDごとのクラスタ索引。
 * @param clusterRadiusMeters - 同一クラスタとして扱う半径メートル(= セルサイズ)。
 * @returns 同一表示クラスタとして扱える最寄りクラスタ。見つからない場合はnull。
 */
function findNearestClusterViaGrid(
  photo: MapPhoto,
  clustersByCellId: Map<string, MutablePhotoCluster[]>,
  clusterRadiusMeters: number,
): MutablePhotoCluster | null {
  const cell = coordinateToGridCell(photo, clusterRadiusMeters);
  let nearestCluster: MutablePhotoCluster | null = null;
  let nearestDistanceMeters = Number.POSITIVE_INFINITY;

  for (let dx = -CLUSTER_SEARCH_CELL_RADIUS; dx <= CLUSTER_SEARCH_CELL_RADIUS; dx += 1) {
    for (let dy = -CLUSTER_SEARCH_CELL_RADIUS; dy <= CLUSTER_SEARCH_CELL_RADIUS; dy += 1) {
      const candidates = clustersByCellId.get(`${clusterRadiusMeters}:${cell.x + dx}:${cell.y + dy}`);

      if (!candidates) {
        continue;
      }

      for (const cluster of candidates) {
        const distanceToSeedMeters = distanceMeters(photo, cluster.seed);

        if (distanceToSeedMeters > clusterRadiusMeters || distanceToSeedMeters >= nearestDistanceMeters) {
          continue;
        }

        nearestCluster = cluster;
        nearestDistanceMeters = distanceToSeedMeters;
      }
    }
  }

  return nearestCluster;
}

/**
 * 新規クラスタの seed を空間ハッシュへ登録する。
 *
 * @param cluster - 登録するクラスタ。
 * @param clustersByCellId - セルIDごとのクラスタ索引。
 * @param clusterRadiusMeters - セルサイズとして使う半径メートル。
 */
function registerClusterCell(
  cluster: MutablePhotoCluster,
  clustersByCellId: Map<string, MutablePhotoCluster[]>,
  clusterRadiusMeters: number,
): void {
  const cell = coordinateToGridCell(cluster.seed, clusterRadiusMeters);
  const existing = clustersByCellId.get(cell.cellId);

  if (existing) {
    existing.push(cluster);
    return;
  }

  clustersByCellId.set(cell.cellId, [cluster]);
}
```

既存の `clusterMapPhotosByRadius` 関数本体を、以下へ置き換える(シグネチャ・JSDocの対象は同じ)。

```typescript
export function clusterMapPhotosByRadius(photos: MapPhoto[], clusterRadiusMeters: number): MapPhotoCluster[] {
  const clusters: MutablePhotoCluster[] = [];
  // セルID(coordinateToGridCellの cellId 形式)→ そのセルに seed を持つクラスタ一覧。
  // 空間ハッシュとして使い、距離判定そのものは変えず候補の絞り込みにのみ使う。
  const clustersByCellId = new Map<string, MutablePhotoCluster[]>();

  // 新しい写真を代表サムネイルと代表座標にし、平均化で別地点へ飛ばないようにする。
  for (const photo of [...photos].sort((a, b) => b.creationTime - a.creationTime)) {
    const nearestCluster = findNearestClusterViaGrid(photo, clustersByCellId, clusterRadiusMeters);

    if (!nearestCluster) {
      const newCluster: MutablePhotoCluster = { seed: photo, photos: [photo] };
      clusters.push(newCluster);
      registerClusterCell(newCluster, clustersByCellId, clusterRadiusMeters);
      continue;
    }

    nearestCluster.photos.push(photo);
  }

  return clusters.map((cluster, index) => ({
    id: createClusterId(cluster, index),
    latitude: cluster.seed.latitude,
    longitude: cluster.seed.longitude,
    photos: cluster.photos,
  }));
}
```

- [ ] **Step 5: テストを実行し成功を確認する**

Run: `npm test -- src/features/photos/__tests__/photoClusters.test.ts`
Expected: ファイル内の全テスト PASS(既存の `clusterMapPhotosByRadius`/`clusterMapPhotos` テスト群、Task 1 のヒステリシステスト、Step 1 で追加した等価性テストを含む)

- [ ] **Step 6: 型チェックを実行する**

Run: `npm run typecheck`
Expected: エラー0件

- [ ] **Step 7: コミット**

```bash
git add src/features/photos/photoClusters.ts src/features/photos/__tests__/photoClusters.test.ts
git commit -m "perf(photos): クラスタリングを空間ハッシュ化しO(N^2)からO(N)へ改善する"
```

---

### Task 3: `usePhotoClusters` フックのヒステリシス配線

**Files:**

- Modify: `src/ui/hooks/usePhotoClusters.ts`
- Modify: `src/ui/hooks/__tests__/usePhotoClusters.test.tsx`
- Modify: `src/ui/__tests__/AppMapReturn.test.tsx`(手動モック更新)
- Modify: `src/ui/__tests__/AppCustomIconCentering.test.tsx`(手動モック更新)
- Modify: `src/ui/state/__tests__/crashReportingState.test.tsx`(手動モック更新)

**Interfaces:**

- Consumes: `getStablePhotoClusterRadiusMeters(region: Region | null, previousRadiusMeters: number | null): number`(Task 1 で追加)
- Consumes: `clusterMapPhotosByRadius(photos: MapPhoto[], clusterRadiusMeters: number): MapPhotoCluster[]`(既存)
- `usePhotoClusters(photos: MapPhoto[], visibleRegion: Region | null): MapPhotoCluster[]` のシグネチャは不変

**実装時に判明した前提修正**: `src/ui/__tests__/AppMapReturn.test.tsx`・`src/ui/__tests__/AppCustomIconCentering.test.tsx`・`src/ui/state/__tests__/crashReportingState.test.tsx` の3ファイルは `@/features/photos/photoClusters` を手動モックしており(`renderRouter('src/app')` で `AppStateProvider` 経由 `usePhotoClusters` を実際に描画するため)、モックの中身が `clusterMapPhotosByRadius` / `getPhotoClusterRadiusMeters` / `paginateMapPhotos` の3つに固定されている。本タスクでフックが `getPhotoClusterRadiusMeters` ではなく `getStablePhotoClusterRadiusMeters` を呼ぶよう変わるため、この関数がモックに存在せず `TypeError` で3ファイルとも失敗する。このため Step 1〜4(フック本体)の後に Step 4.5 として3ファイルのモックを更新する。

- [ ] **Step 1: 失敗するテストを書く(ヒステリシス)**

`src/ui/hooks/__tests__/usePhotoClusters.test.tsx` の末尾(最後の `it` ブロックの直後、`});` の前)に追加する。

```typescript
it('ヒステリシス境界をわずかに超えるだけでは再計算せず、大きく超えると再計算する', () => {
  const photos = [createPhoto('a')];
  const { rerender } = renderHook(({ region }: { region: Region }) => usePhotoClusters(photos, region), {
    initialProps: { region: { ...baseRegion, latitudeDelta: 0.04 } }, // 段階3(150m)の範囲内
  });

  expect(clusterMapPhotosByRadius).toHaveBeenCalledTimes(1);

  // 段階境界(0.045)をわずかに超えるが、ヒステリシス帯(0.045 * 1.2 = 0.054)には収まる。
  rerender({ region: { ...baseRegion, latitudeDelta: 0.05 } });
  expect(clusterMapPhotosByRadius).toHaveBeenCalledTimes(1);

  // ヒステリシス帯を明確に超える。
  rerender({ region: { ...baseRegion, latitudeDelta: 0.06 } });
  expect(clusterMapPhotosByRadius).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npm test -- src/ui/hooks/__tests__/usePhotoClusters.test.tsx`
Expected: FAIL(現行のフックはヒステリシスなしで `getPhotoClusterRadiusMeters` を直接呼んでいるため、latitudeDelta 0.04→0.05 で既に段階が変わり再計算が起きてしまい、1回目のアサーション `toHaveBeenCalledTimes(1)` が満たせない)

- [ ] **Step 3: `usePhotoClusters` をヒステリシス対応へ書き換える**

`src/ui/hooks/usePhotoClusters.ts` の全体を以下に置き換える。

```typescript
import { useMemo, useRef } from 'react';
import type { Region } from 'react-native-maps';

import { clusterMapPhotosByRadius, getStablePhotoClusterRadiusMeters } from '@/features/photos/photoClusters';
import type { MapPhotoCluster } from '@/features/photos/photoClusters';
import type { MapPhoto } from '@/features/photos/photoLibrary';

/**
 * 表示範囲に応じた写真クラスタを、パン時の再計算を避けつつ算出する。
 *
 * クラスタ結果は「写真一覧」と「クラスタ半径」だけで決まり、地図の中心座標には依存しない。
 * そして半径は `latitudeDelta` から段階選択される(`getStablePhotoClusterRadiusMeters`)。
 * したがって表示範囲オブジェクトをそのまま依存配列に入れると、結果が同一になるパン
 * (中心移動のみ)でも O(N) のクラスタリングが走ってしまう。
 *
 * これを避けるため、半径の算出(O(1))とクラスタリング(写真数に対して重い)を
 * 別々の `useMemo` に分け、重い側は数値の半径だけに依存させている。
 * この2段構成が本フックの存在理由であり、1つの `useMemo` に戻してはいけない。
 *
 * 半径算出には段階境界のちらつき・パン時のメモ化ミスを防ぐヒステリシスがかかっており、
 * 直前の半径を `previousRadiusRef` で保持して次回の算出へ渡す(useVisitedGridOverlay.ts の
 * visitedGridDisplayCellSizeRef と同じパターン)。
 *
 * @param photos - 地図上に表示するジオタグ付き写真一覧。
 * @param visibleRegion - 現在の地図表示範囲。未取得の場合は近距離用の既定値が使われる。
 * @returns 近接写真をまとめたクラスタ一覧。
 */
export function usePhotoClusters(photos: MapPhoto[], visibleRegion: Region | null): MapPhotoCluster[] {
  const previousRadiusRef = useRef<number | null>(null);

  const clusterRadiusMeters = useMemo(() => {
    const stableRadius = getStablePhotoClusterRadiusMeters(visibleRegion, previousRadiusRef.current);
    previousRadiusRef.current = stableRadius;
    return stableRadius;
  }, [visibleRegion]);

  return useMemo(() => clusterMapPhotosByRadius(photos, clusterRadiusMeters), [photos, clusterRadiusMeters]);
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npm test -- src/ui/hooks/__tests__/usePhotoClusters.test.tsx`
Expected: 全テスト PASS(既存4件 + 追加1件)。既存の「パンでは再計算しない」「ズームでは再計算する」「写真一覧が変われば再計算する」「パンを繰り返しても初回の計算結果を返し続ける」が壊れていないことも確認する

- [ ] **Step 4.5: 手動モック3ファイルへ `getStablePhotoClusterRadiusMeters` を追加する**

以下3ファイルそれぞれの `jest.mock('@/features/photos/photoClusters', () => ({ ... }))` に、既存の `getPhotoClusterRadiusMeters: jest.fn(() => 10)` と同じ形で1行追加する(モック内の他の行順は変えない)。

`src/ui/__tests__/AppMapReturn.test.tsx`(489行目付近)、`src/ui/__tests__/AppCustomIconCentering.test.tsx`(203行目付近)、`src/ui/state/__tests__/crashReportingState.test.tsx`(203行目付近)、それぞれ以下を追加する。

```typescript
getStablePhotoClusterRadiusMeters: jest.fn(() => 10),
```

追加後、3ファイルとも以下の形になる(`AppMapReturn.test.tsx` の例)。

```typescript
jest.mock('@/features/photos/photoClusters', () => ({
  clusterMapPhotosByRadius: jest.fn(() => []),
  getPhotoClusterRadiusMeters: jest.fn(() => 10),
  getStablePhotoClusterRadiusMeters: jest.fn(() => 10),
  paginateMapPhotos: jest.fn(() => []),
}));
```

- [ ] **Step 4.5-確認: 全体テストを実行し、この3ファイルを含めて回帰がないことを確認する**

Run: `npm test`
Expected: 既存テストを含めて全件 PASS(このタスクの変更で新たに壊れるテストがないことの確認。手動モックのある3ファイルが対象)

- [ ] **Step 5: 型チェックを実行する**

Run: `npm run typecheck`
Expected: エラー0件

- [ ] **Step 6: コミット**

```bash
git add src/ui/hooks/usePhotoClusters.ts src/ui/hooks/__tests__/usePhotoClusters.test.tsx \
  src/ui/__tests__/AppMapReturn.test.tsx src/ui/__tests__/AppCustomIconCentering.test.tsx \
  src/ui/state/__tests__/crashReportingState.test.tsx
git commit -m "feat(photos): usePhotoClustersを半径ヒステリシスへ配線する"
```

---

### Task 4: 最終検証

**Files:** なし(検証のみ)

- [ ] **Step 1: 全体テストを実行する**

Run: `npm test`
Expected: 既存テストを含めて全件 PASS(回帰がないことの最終確認)

- [ ] **Step 2: 型チェックを実行する**

Run: `npm run typecheck`
Expected: エラー0件

- [ ] **Step 3: lintを実行する**

Run: `npm run lint`
Expected: error 0件(warning は既存ベースライン程度まで許容。`react-hooks/refs` 等の一部ルールは `.ai/context/conventions.md` の方針により warn 設定)

- [ ] **Step 4: formatチェックを実行する**

Run: `npm run format:check`
Expected: 全ファイル通過(通過しない場合は `npm run format` を実行してから再度確認する)

- [ ] **Step 5: コミット(formatによる差分がある場合のみ)**

```bash
git add -A
git commit -m "style: Prettier整形を適用する"
```

---

## Self-Review 用チェックリスト(実行者向け参考情報)

- 設計書 §3(方針)との対応: 半径の量子化(Task 1)、空間ハッシュ化(Task 2)、フック配線(Task 3)を全てカバーしている
- 設計書 §5(テスト方針)との対応: 段階境界・ヒステリシス(Task 1)、既存クラスタリングテストの維持・現行実装との等価性・高緯度での正当性(Task 2)、パン/ズーム時の呼び出し回数(Task 3、既存 + ヒステリシス追加分)を全てカバーしている
- **正当性の核心**: Task 2 の空間ハッシュは索引としてのみ機能し、`distanceMeters` による採用判定は旧実装から一切変更しない。等価性テスト(ランダム300件 + 高緯度密集200件)がこれを担保する
- Phase 2 の他ステップ(2-b: `photo_assets` + ビューポート絞り込み、2-c: 上限撤廃)はこの計画のスコープ外。着手しない
