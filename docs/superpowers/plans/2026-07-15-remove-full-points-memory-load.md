# 全GPSポイントのメモリロード廃止 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 起動時に全期間のGPSポイントをJSメモリへロードする実装を廃止し、SQL集計クエリと日別/月別スコープクエリへ置き換えることで、`RangeError: Maximum call stack size exceeded` クラッシュと `WatchdogTermination`(OSによるメモリ超過強制終了)を根本解決する。

**Architecture:** `getAllLocationPoints()`(LIMITなし全件取得)を廃止し、(1) 地図初期表示用の緯度経度境界+件数をSQLの `MIN/MAX/COUNT` で取得する `getLocationPointsBounds()`、(2) 総距離フォールバック用に欠落日だけをまとめて取得する `getLocationPointsByDates()`、(3) 月次レポート用に対象月だけを取得する `getLocationPointsByMonth()` に置き換える。`routeMapper.ts` の `createInitialRegion` はスプレッド展開(`Math.min(...array)`)をループ集計に置き換え、月次・日別スコープの既存呼び出し元にも波及して防御する。GPXエクスポートは日別チャンクを `expo-file-system/legacy` の `append: true` オプションで逐次追記する方式に変え、メモリ使用を1日分に有界化する。

**Tech Stack:** TypeScript (strict) / React Native (Expo ~57, New Architecture) / expo-sqlite / expo-file-system (legacy API) / expo-router / Jest + jest-expo + @testing-library/react-native + expo-router/testing-library

## Global Constraints

- `describe`/`test`/`it` の説明文は日本語で書く(AGENTS.md §9)
- コミットメッセージは `type(scope): 日本語の説明` の Semantic Commit Message 形式(AGENTS.md §1)。1コミット=1つの意味のある変更
- コミット前に `npm run typecheck` と関連する `npm test` を実行する
- ディレクトリを跨ぐ import は `@/` エイリアスを使う。`../` を含む相対importはESLintでerror(`.ai/context/conventions.md`)
- 関数・型・自明でない変数には日本語JSDocを付ける(AGENTS.md §8)
- UIコンポーネント内でDB操作・端末APIを直接呼ばない。副作用はサービス層・リポジトリ層に寄せる(AGENTS.md §3)
- `src/ui/components/**` 配下で `StyleSheet.create` を新規に書かない(既存 `appStyles.ts` を使う。今回のタスクでは新規スタイルの追加は発生しない想定)
- 作業完了後に `npm run typecheck` / `npm test` / `npm run lint`(error 0)を確認する(AGENTS.md §7)
- 非目的として、DBスキーマ変更・Zipエクスポート・地図の描画方式変更は行わない(設計書 `docs/superpowers/specs/2026-07-15-remove-full-points-memory-load-design.md` 参照)

---

## Task 1: routeMapper のスプレッド展開を除去する

**Files:**
- Modify: `src/features/map/routeMapper.ts:149-172`(既存 `createInitialRegion`)
- Test: `src/features/map/__tests__/routeMapper.test.ts`

**Interfaces:**
- Consumes: なし(このタスクは自己完結)
- Produces: `export type RouteCoordinateBounds = { minLatitude: number; maxLatitude: number; minLongitude: number; maxLongitude: number }`、`export function createRegionFromBounds(bounds: RouteCoordinateBounds | null): Region`。既存 `export function createInitialRegion(points: LocationPoint[]): Region` のシグネチャ・返り値仕様は変更しない(内部実装のみ変更)。Task 2 の `LocationPointsBounds`(logRepository)はこの `RouteCoordinateBounds` を構造的に満たす(pointCountフィールドが余分にあるだけ)ため、そのまま渡せる。

- [ ] **Step 1: 失敗するテストを書く(110万件の回帰テスト + createRegionFromBounds)**

`src/features/map/__tests__/routeMapper.test.ts` の先頭 import 文を以下に変更する。

```typescript
import { LocationPoint } from '@/types/gps';
import {
  createInitialRegion,
  createRegionFromBounds,
  filterRouteCoordinatesByRegion,
  filterRouteSegmentsByRegion,
  simplifyRouteCoordinates,
  toRenderRouteSegments,
  toRenderRouteCoordinates,
  toRouteCoordinates,
} from '@/features/map/routeMapper';
```

ファイル末尾(既存 `describe('ルート描画変換', ...)` ブロックの外、ファイル最後)に以下を追記する。

```typescript
describe('境界からの初期表示範囲 createRegionFromBounds', () => {
  it('境界にマージンを付けて表示範囲を作る', () => {
    const region = createRegionFromBounds({ minLatitude: 35, maxLatitude: 36, minLongitude: 139, maxLongitude: 140 });

    expect(region.latitude).toBeCloseTo(35.5);
    expect(region.longitude).toBeCloseTo(139.5);
    expect(region.latitudeDelta).toBeCloseTo(1.4);
    expect(region.longitudeDelta).toBeCloseTo(1.4);
  });

  it('境界が同一点の場合は最小デルタを使う', () => {
    const region = createRegionFromBounds({ minLatitude: 35, maxLatitude: 35, minLongitude: 139, maxLongitude: 139 });

    expect(region.latitudeDelta).toBe(0.01);
    expect(region.longitudeDelta).toBe(0.01);
  });

  it('境界がnullの場合は既定の初期表示位置を返す', () => {
    const region = createRegionFromBounds(null);

    expect(region.latitude).toBe(35.681236);
    expect(region.longitude).toBe(139.767125);
    expect(region.latitudeDelta).toBe(0.08);
    expect(region.longitudeDelta).toBe(0.08);
  });
});

describe('大量データでのcreateInitialRegion(RangeError回帰)', () => {
  it('110万件の座標でも例外を出さず初期表示範囲を計算する', () => {
    const points: LocationPoint[] = Array.from({ length: 1_100_000 }, (_, index) => ({
      id: index,
      recordedAt: '2026-05-04T00:00:00.000Z',
      localDate: '2026-05-04',
      latitude: 35 + index * 0.00001,
      longitude: 139,
      altitude: null,
      speed: null,
      heading: null,
      accuracy: null,
      altitudeAccuracy: null,
    }));

    expect(() => createInitialRegion(points)).not.toThrow();

    const region = createInitialRegion(points);
    expect(region.latitude).toBeGreaterThan(35);
    expect(region.longitudeDelta).toBeGreaterThanOrEqual(0.01);
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx jest src/features/map/__tests__/routeMapper.test.ts`
Expected: FAIL — `createRegionFromBounds is not a function`(未実装のため)。110万件テストは実装前の `Math.min(...huge array)` のままだと `RangeError: Maximum call stack size exceeded` で失敗する。

- [ ] **Step 3: `createRegionFromBounds` を追加し `createInitialRegion` をループ実装へ書き換える**

`src/features/map/routeMapper.ts:149-172` の既存 `createInitialRegion` を以下で置き換える(コメント含め全体を置換)。

```typescript
/** 座標群の外接境界(緯度経度の最小・最大値)。 */
export type RouteCoordinateBounds = {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
};

/**
 * 座標の外接境界からマージン付きの初期表示範囲を作る。
 *
 * @param bounds - 座標群の外接境界。有効な座標が1件もない場合はnull。
 * @returns 境界がnullなら既定の初期表示位置、それ以外はマージン1.4倍・最小デルタ0.01の表示範囲。
 */
export function createRegionFromBounds(bounds: RouteCoordinateBounds | null): Region {
  if (!bounds) {
    return DEFAULT_REGION;
  }

  const { minLatitude, maxLatitude, minLongitude, maxLongitude } = bounds;
  const latitudeDelta = Math.max((maxLatitude - minLatitude) * 1.4, 0.01);
  const longitudeDelta = Math.max((maxLongitude - minLongitude) * 1.4, 0.01);

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta,
    longitudeDelta,
  };
}

/**
 * GPSポイント群が収まる初期表示範囲を作る。
 *
 * スプレッド展開(`Math.min(...array)`)は要素数が約105万を超えるとHermesで
 * `RangeError: Maximum call stack size exceeded (native stack depth)` になるため、
 * 単純なループで境界を求める(2026-07-14のSentryクラッシュの根本原因)。
 */
export function createInitialRegion(points: LocationPoint[]): Region {
  const coordinates = toRouteCoordinates(points);

  if (coordinates.length === 0) {
    return DEFAULT_REGION;
  }

  let minLatitude = coordinates[0].latitude;
  let maxLatitude = coordinates[0].latitude;
  let minLongitude = coordinates[0].longitude;
  let maxLongitude = coordinates[0].longitude;

  for (const coordinate of coordinates) {
    if (coordinate.latitude < minLatitude) minLatitude = coordinate.latitude;
    if (coordinate.latitude > maxLatitude) maxLatitude = coordinate.latitude;
    if (coordinate.longitude < minLongitude) minLongitude = coordinate.longitude;
    if (coordinate.longitude > maxLongitude) maxLongitude = coordinate.longitude;
  }

  return createRegionFromBounds({ minLatitude, maxLatitude, minLongitude, maxLongitude });
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npx jest src/features/map/__tests__/routeMapper.test.ts`
Expected: PASS(既存テスト含め全件)。110万件テストは数百ms〜数秒程度で完走する(ループのみのためタイムアウトしない)。

- [ ] **Step 5: コミット**

```bash
git add src/features/map/routeMapper.ts src/features/map/__tests__/routeMapper.test.ts
git commit -m "$(cat <<'EOF'
fix(map): createInitialRegionのスプレッド展開を除去しRangeErrorを解消する

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: logRepository に境界・月別・複数日クエリを追加する

**Files:**
- Modify: `src/features/logs/logRepository.ts`(`getAllLocationPoints` を削除し新規関数を追加)
- Test: `src/features/logs/__tests__/logRepository.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - `export type LocationPointsBounds = { minLatitude: number; maxLatitude: number; minLongitude: number; maxLongitude: number; pointCount: number }`
  - `export async function getLocationPointsBounds(): Promise<LocationPointsBounds | null>`
  - `export async function getLocationPointsByMonth(yearMonth: string): Promise<LocationPoint[]>`(`yearMonth` は `"YYYY-MM"` 形式)
  - `export async function getLocationPointsByDates(localDates: string[]): Promise<LocationPoint[]>`
  - 削除: `export async function getAllLocationPoints(): Promise<LocationPoint[]>`(呼び出し元は Task 6 で置き換える)

- [ ] **Step 1: 失敗するテストを書く**

`src/features/logs/__tests__/logRepository.test.ts` の先頭 import に `getLocationPointsBounds`, `getLocationPointsByMonth`, `getLocationPointsByDates` を追加する。

```typescript
import { db, withExclusiveTransaction } from '@/db/database';
import { NewLocationPoint } from '@/types/gps';
import {
  deleteAllUserData,
  getDailyLogs,
  getLocationPointsBounds,
  getLocationPointsByDates,
  getLocationPointsByMonth,
  insertLocationPoint,
} from '@/features/logs/logRepository';
```

ファイル末尾に以下を追記する。

```typescript
describe('GPSポイント境界 getLocationPointsBounds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('有効な座標の範囲と件数を返す', async () => {
    (db.getFirstAsync as jest.Mock).mockResolvedValue({
      minLatitude: 35,
      maxLatitude: 36,
      minLongitude: 139,
      maxLongitude: 140,
      pointCount: 5,
    });

    await expect(getLocationPointsBounds()).resolves.toEqual({
      minLatitude: 35,
      maxLatitude: 36,
      minLongitude: 139,
      maxLongitude: 140,
      pointCount: 5,
    });
  });

  it('有効ポイントが0件の場合はnullを返す', async () => {
    (db.getFirstAsync as jest.Mock).mockResolvedValue({
      minLatitude: null,
      maxLatitude: null,
      minLongitude: null,
      maxLongitude: null,
      pointCount: 0,
    });

    await expect(getLocationPointsBounds()).resolves.toBeNull();
  });
});

describe('月別ポイント取得 getLocationPointsByMonth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('指定月のプレフィックスでポイントを絞り込む', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValue([]);

    await getLocationPointsByMonth('2026-05');

    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('local_date LIKE ?'), '2026-05-%');
  });
});

describe('複数日ポイント取得 getLocationPointsByDates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('空配列の場合はDBへ問い合わせず空配列を返す', async () => {
    await expect(getLocationPointsByDates([])).resolves.toEqual([]);
    expect(db.getAllAsync).not.toHaveBeenCalled();
  });

  it('複数日のプレースホルダを展開してクエリする', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValue([]);

    await getLocationPointsByDates(['2026-05-04', '2026-05-05']);

    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('local_date IN (?, ?)'), '2026-05-04', '2026-05-05');
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx jest src/features/logs/__tests__/logRepository.test.ts`
Expected: FAIL — `getLocationPointsBounds is not a function` 等(未実装のため)。

- [ ] **Step 3: `logRepository.ts` を実装する**

`src/features/logs/logRepository.ts:144-151` の既存 `getAllLocationPoints` 関数を削除し、代わりに以下を追加する(挿入位置はその場所)。

```typescript
/** 有効な緯度経度を持つ全ポイントの外接境界と件数。 */
export type LocationPointsBounds = {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
  /** 境界計算に使った有効ポイント件数。 */
  pointCount: number;
};

/** 全ポイントの緯度経度境界と件数をSQLで集計する。有効ポイントが0件ならnull。 */
export async function getLocationPointsBounds(): Promise<LocationPointsBounds | null> {
  const row = await db.getFirstAsync<{
    minLatitude: number | null;
    maxLatitude: number | null;
    minLongitude: number | null;
    maxLongitude: number | null;
    pointCount: number;
  }>(
    `SELECT
      MIN(latitude) as minLatitude,
      MAX(latitude) as maxLatitude,
      MIN(longitude) as minLongitude,
      MAX(longitude) as maxLongitude,
      COUNT(*) as pointCount
     FROM location_points
     WHERE latitude BETWEEN -90 AND 90
       AND longitude BETWEEN -180 AND 180`,
  );

  if (
    !row ||
    row.pointCount === 0 ||
    row.minLatitude == null ||
    row.maxLatitude == null ||
    row.minLongitude == null ||
    row.maxLongitude == null
  ) {
    return null;
  }

  return {
    minLatitude: row.minLatitude,
    maxLatitude: row.maxLatitude,
    minLongitude: row.minLongitude,
    maxLongitude: row.maxLongitude,
    pointCount: row.pointCount,
  };
}

/** 指定月(`"YYYY-MM"`形式)のポイントを時系列で取得する。月次レポート画面で使う。 */
export async function getLocationPointsByMonth(yearMonth: string): Promise<LocationPoint[]> {
  return db.getAllAsync<LocationPoint>(
    `SELECT ${pointColumns}
     FROM location_points
     WHERE local_date LIKE ?
     ORDER BY recorded_at ASC`,
    `${yearMonth}-%`,
  );
}

/** 指定した複数日のポイントを日付・時刻順にまとめて取得する。総距離フォールバック計算で使う。 */
export async function getLocationPointsByDates(localDates: string[]): Promise<LocationPoint[]> {
  if (localDates.length === 0) {
    return [];
  }

  const placeholders = localDates.map(() => '?').join(', ');
  return db.getAllAsync<LocationPoint>(
    `SELECT ${pointColumns}
     FROM location_points
     WHERE local_date IN (${placeholders})
     ORDER BY local_date ASC, recorded_at ASC, id ASC`,
    ...localDates,
  );
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npx jest src/features/logs/__tests__/logRepository.test.ts`
Expected: PASS(既存テスト含め全件)。

- [ ] **Step 5: 型チェックで `getAllLocationPoints` の残存参照を確認する**

Run: `npm run typecheck`
Expected: `src/ui/hooks/useLocationRecordingSync.ts` で `getAllLocationPoints` が見つからないエラーが出る(Task 6 で解消するため、今は許容する)。このタスクではコミットのみ行い、Task 6 で解消する。

- [ ] **Step 6: コミット**

```bash
git add src/features/logs/logRepository.ts src/features/logs/__tests__/logRepository.test.ts
git commit -m "$(cat <<'EOF'
feat(db): GPSポイントの境界・月別・複数日クエリを追加する

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: dailyLogsService に総距離フォールバック計算を追加し、achievementRepository の重複ロジックを共通化する

**背景:** `achievementRepository.ts` には既に非公開の `calculateTotalDistanceMeters`(日別距離を合計し、NULLの日だけGPSポイントをバッチ取得して再計算する)がある。今回追加するロジックは全く同じ構造(fixedDistance + fallback日のバッチIN句クエリ)になるため、重複させず共通ヘルパーとして抽出し、`achievementRepository.ts` 側もそれを使うようリファクタリングする(ユーザー承認済み: 実績評価ロジックの計算結果自体は変更しない、共通化のみ)。

**Files:**
- Modify: `src/features/logs/dailyLogsService.ts`(既存 `fetchAreaNamesByPointIds` に追記)
- Modify: `src/features/achievements/achievementRepository.ts:1-93`(private `calculateTotalDistanceMeters` と手書きクエリを削除し共通ヘルパーを使う)
- Test: `src/features/logs/__tests__/dailyLogsService.test.ts`
- Test: `src/features/achievements/__tests__/achievementRepository.test.ts`(既存テストが引き続き通ることを確認するのみ。新規テスト追加は不要)

**Interfaces:**
- Consumes: `getLocationPointsByDates(localDates: string[]): Promise<LocationPoint[]>`(Task 2, `@/features/logs/logRepository`)
- Produces:
  - `export type DailyDistanceEntry = { localDate: string; distanceMeters: number | null }`(`localDate`/`distanceMeters` だけを使う最小限の型。`DailyLogSummary` はこの型の要件を満たすため、そのまま渡せる)
  - `export async function calculateTotalDistanceMeters(dailyLogs: DailyDistanceEntry[]): Promise<number>`

- [ ] **Step 1: 失敗するテストを書く**

`src/features/logs/__tests__/dailyLogsService.test.ts` の先頭に以下を追記する(既存の `fetchAreaNamesByPointIds` 用モックの後ろに追加)。

```typescript
import { calculateTotalDistanceMeters } from '@/features/logs/dailyLogsService';
import { LocationPoint } from '@/types/gps';

jest.mock('@/features/logs/logRepository', () => ({
  getLocationPointsByDates: jest.fn(),
}));

import { getLocationPointsByDates } from '@/features/logs/logRepository';

function dailyDistanceEntry(localDate: string, distanceMeters: number | null): { localDate: string; distanceMeters: number | null } {
  return { localDate, distanceMeters };
}

function point(latitude: number, longitude: number, localDate: string): LocationPoint {
  return {
    id: 1,
    recordedAt: `${localDate}T00:00:00.000Z`,
    localDate,
    latitude,
    longitude,
    altitude: null,
    speed: null,
    heading: null,
    accuracy: null,
    altitudeAccuracy: null,
  };
}
```

ファイル末尾に以下を追記する。

```typescript
describe('総移動距離計算 calculateTotalDistanceMeters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('全日付に距離が保存済みの場合は合計するだけでDBへ問い合わせない', async () => {
    const result = await calculateTotalDistanceMeters([dailyDistanceEntry('2026-05-04', 100), dailyDistanceEntry('2026-05-05', 200)]);

    expect(result).toBe(300);
    expect(getLocationPointsByDates).not.toHaveBeenCalled();
  });

  it('距離が欠落した日だけGPSポイントから再計算して合算する', async () => {
    (getLocationPointsByDates as jest.Mock).mockResolvedValue([point(35, 139, '2026-05-05'), point(35.001, 139, '2026-05-05')]);

    const result = await calculateTotalDistanceMeters([dailyDistanceEntry('2026-05-04', 100), dailyDistanceEntry('2026-05-05', null)]);

    expect(getLocationPointsByDates).toHaveBeenCalledWith(['2026-05-05']);
    expect(result).toBeGreaterThan(100);
    expect(result).toBeLessThan(120);
  });

  it('全日付が欠落している場合は0から再計算する', async () => {
    (getLocationPointsByDates as jest.Mock).mockResolvedValue([]);

    const result = await calculateTotalDistanceMeters([dailyDistanceEntry('2026-05-04', null)]);

    expect(result).toBe(0);
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx jest src/features/logs/__tests__/dailyLogsService.test.ts`
Expected: FAIL — `calculateTotalDistanceMeters is not a function`。

- [ ] **Step 3: `dailyLogsService.ts` に実装を追加する**

`src/features/logs/dailyLogsService.ts` の既存1行目 `import { getLocationPointAdminAreaNames } from '@/features/achievements/adminAreaRepository';` はそのまま残し、その直後に以下の3行を追加する。

```typescript
import { getLocationPointsByDates } from '@/features/logs/logRepository';
import { LocationPoint } from '@/types/gps';
import { totalDistanceMeters } from '@/utils/distance';
```

ファイル末尾(既存 `fetchAreaNamesByPointIds` の後ろ)に以下を追記する。

```typescript
/** 総移動距離計算に必要な最小限の日別距離情報。 */
export type DailyDistanceEntry = {
  localDate: string;
  distanceMeters: number | null;
};

/**
 * 日別距離の合計を優先し、距離が欠落している日だけGPSポイントから再計算する。
 *
 * 全期間のGPSポイントをメモリへロードせず、欠落している日付だけをまとめて取得することで
 * データ量に依存しない総距離計算にする(2026-07-14のメモリ超過クラッシュ対策の一部)。
 * `achievementRepository.getAchievementProgress` と `useLocationRecordingSync` の
 * 両方から使う共通ヘルパー。
 *
 * @param dailyLogs - 日付と距離のペア一覧(`DailyLogSummary` 等、この形を満たす配列を渡せる)。
 * @returns 総移動距離メートル。
 */
export async function calculateTotalDistanceMeters(dailyLogs: DailyDistanceEntry[]): Promise<number> {
  const fixedDistance = dailyLogs.reduce((total, log) => total + (log.distanceMeters ?? 0), 0);
  const fallbackDates = dailyLogs.filter((log) => log.distanceMeters == null).map((log) => log.localDate);

  if (fallbackDates.length === 0) {
    return fixedDistance;
  }

  const points = await getLocationPointsByDates(fallbackDates);
  const pointsByDate = new Map<string, LocationPoint[]>();

  for (const point of points) {
    const datePoints = pointsByDate.get(point.localDate) ?? [];
    datePoints.push(point);
    pointsByDate.set(point.localDate, datePoints);
  }

  const fallbackDistance = fallbackDates.reduce((total, localDate) => total + totalDistanceMeters(pointsByDate.get(localDate) ?? []), 0);

  return fixedDistance + fallbackDistance;
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npx jest src/features/logs/__tests__/dailyLogsService.test.ts`
Expected: PASS(既存の `fetchAreaNamesByPointIds` テスト含め全件)。

- [ ] **Step 5: `achievementRepository.ts` を共通ヘルパー利用へリファクタリングする**

`src/features/achievements/achievementRepository.ts:1-5` の import ブロックを以下に置き換える(`LocationPoint`/`totalDistanceMeters` の import を削除し、共通ヘルパーの import を追加する)。

```typescript
import { db, withExclusiveTransaction } from '@/db/database';
import { calculateTotalDistanceMeters } from '@/features/logs/dailyLogsService';
import { toLocalDate } from '@/utils/date';
import { ACHIEVEMENT_DEFINITIONS, AchievementDefinition, getAchievementDefinition } from './achievementDefinitions';
import { AchievementProgress, evaluateAchievementUnlocks, getProgressValueForCondition } from './achievementEvaluator';
```

`src/features/achievements/achievementRepository.ts:48-93` にある非公開の `calculateTotalDistanceMeters` 関数全体(コメント含む)を削除する。

`src/features/achievements/achievementRepository.ts:41` の以下の行は変更しない(同名の関数呼び出しのまま、import元だけが変わる)。

```typescript
    totalDistanceMeters: await calculateTotalDistanceMeters(dailyDistanceRows),
```

- [ ] **Step 6: `achievementRepository.ts` の既存テストを実行し、リファクタリングで壊れていないことを確認する**

Run: `npx jest src/features/achievements/__tests__/achievementRepository.test.ts`
Expected: PASS(全件、既存のアサーション内容は変更不要)。`db.getAllAsync` の呼び出し回数・順序(1回目=dailyDistanceRows、2回目=フォールバックポイント)は変わらないため、既存テストのモックはそのまま通る。

- [ ] **Step 7: 型チェックを実行する**

Run: `npm run typecheck`
Expected: `src/features/achievements/achievementRepository.ts` と `src/features/logs/dailyLogsService.ts` にエラーがないことを確認する。

- [ ] **Step 8: コミット**

```bash
git add src/features/logs/dailyLogsService.ts src/features/logs/__tests__/dailyLogsService.test.ts src/features/achievements/achievementRepository.ts
git commit -m "$(cat <<'EOF'
refactor(db): 総移動距離のフォールバック計算をサービス層へ共通化する

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: GPXエクスポートを日別チャンク追記方式に変更する

**Files:**
- Modify: `src/features/export/gpxExporter.ts`(全面書き換え)
- Test: `src/features/export/__tests__/gpxExporter.test.ts`(全面書き換え)

**Interfaces:**
- Consumes: `getDailyLogs(): Promise<DailyLogSummary[]>`, `getLocationPointsByDate(localDate: string): Promise<LocationPoint[]>`(いずれも既存、`@/features/logs/logRepository`)。`parseGpxToLocationPoints(gpx: string): NewLocationPoint[]`(既存、`@/features/import/gpxImporter`、往復テストでのみ使用)
- Produces:
  - `export function buildGpxHeader(name: string): string`
  - `export function buildGpxDayTrack(localDate: string, points: LocationPoint[]): string`
  - `export function buildGpxFooter(): string`
  - `export async function shareAllLogsAsGpx(): Promise<void>`
  - 削除: `export function buildGpx(...)`, `export async function shareGpx(...)`(呼び出し元は Task 7 で `shareAllLogsAsGpx` に置き換える)

- [ ] **Step 1: 失敗するテストを書く**

`src/features/export/__tests__/gpxExporter.test.ts` を以下の内容で全面置き換えする。

```typescript
import { LocationPoint, DailyLogSummary } from '@/types/gps';
import { parseGpxToLocationPoints } from '@/features/import/gpxImporter';

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: { UTF8: 'utf8' },
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/logs/logRepository', () => ({
  getDailyLogs: jest.fn(),
  getLocationPointsByDate: jest.fn(),
}));

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getDailyLogs, getLocationPointsByDate } from '@/features/logs/logRepository';
import { buildGpxDayTrack, buildGpxFooter, buildGpxHeader, shareAllLogsAsGpx } from '@/features/export/gpxExporter';

const day1Points: LocationPoint[] = [
  {
    id: 1,
    recordedAt: '2026-05-04T00:00:00.000Z',
    localDate: '2026-05-04',
    latitude: 35.681236,
    longitude: 139.767125,
    altitude: 12.5,
    speed: null,
    heading: null,
    accuracy: 8,
    altitudeAccuracy: null,
  },
  {
    id: 2,
    recordedAt: '2026-05-04T00:01:00.000Z',
    localDate: '2026-05-04',
    latitude: 35.682,
    longitude: 139.768,
    altitude: null,
    speed: null,
    heading: null,
    accuracy: null,
    altitudeAccuracy: null,
  },
];

const day2Points: LocationPoint[] = [
  {
    id: 3,
    recordedAt: '2026-05-05T00:00:00.000Z',
    localDate: '2026-05-05',
    latitude: 35.7,
    longitude: 139.8,
    altitude: null,
    speed: null,
    heading: null,
    accuracy: null,
    altitudeAccuracy: null,
  },
];

describe('GPX生成', () => {
  it('ヘッダーにXML宣言とメタデータ名を含める', () => {
    const header = buildGpxHeader('Strollia all');

    expect(header).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(header).toContain('<gpx version="1.1" creator="Strollia"');
    expect(header).toContain('<name>Strollia all</name>');
  });

  it('XMLで特別扱いされる文字をヘッダー名内でエスケープする', () => {
    const header = buildGpxHeader('A&B <walk>');

    expect(header).toContain('A&amp;B &lt;walk&gt;');
  });

  it('日別トラックポイントをtrk要素として出力する', () => {
    const track = buildGpxDayTrack('2026-05-04', day1Points);

    expect(track).toContain('<trk>');
    expect(track).toContain('<name>2026-05-04</name>');
    expect(track).toContain('<trkpt lat="35.681236" lon="139.767125">');
    expect(track).toContain('<ele>12.5</ele>');
    expect(track).toContain('<time>2026-05-04T00:01:00.000Z</time>');
  });

  it('フッターでgpx要素を閉じる', () => {
    expect(buildGpxFooter()).toBe('</gpx>\n');
  });

  it('複数日のtrkを連結したGPXを再インポートすると全ポイントが復元される(往復互換)', () => {
    const gpx = buildGpxHeader('Strollia all') + buildGpxDayTrack('2026-05-04', day1Points) + buildGpxDayTrack('2026-05-05', day2Points) + buildGpxFooter();

    const imported = parseGpxToLocationPoints(gpx);

    expect(imported).toHaveLength(3);
    expect(imported.map((p) => `${p.latitude},${p.longitude}`)).toEqual(
      [...day1Points, ...day2Points].map((p) => `${p.latitude},${p.longitude}`),
    );
  });
});

function dailyLog(localDate: string, pointCount: number): DailyLogSummary {
  return {
    localDate,
    pointCount,
    startedAt: null,
    endedAt: null,
    distanceMeters: null,
    startLocationPointId: null,
    endLocationPointId: null,
  };
}

describe('全期間GPXエクスポート shareAllLogsAsGpx', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('記録がない場合はエラーを投げる', async () => {
    (getDailyLogs as jest.Mock).mockResolvedValue([]);

    await expect(shareAllLogsAsGpx()).rejects.toThrow('GPXとして出力できるGPSポイントがありません。');
  });

  it('日付順にヘッダー・日別チャンク・フッターを追記してから共有する', async () => {
    (getDailyLogs as jest.Mock).mockResolvedValue([dailyLog('2026-05-05', 1), dailyLog('2026-05-04', 2)]);
    (getLocationPointsByDate as jest.Mock).mockImplementation((localDate: string) =>
      Promise.resolve(localDate === '2026-05-04' ? day1Points : day2Points),
    );

    await shareAllLogsAsGpx();

    const writeCalls = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls;
    expect(writeCalls).toHaveLength(4);
    expect(writeCalls[0][1]).toContain('<gpx version="1.1"');
    expect(writeCalls[0][2]).toEqual(expect.objectContaining({ encoding: 'utf8' }));
    expect(writeCalls[0][2].append).not.toBe(true);
    expect(writeCalls[1][1]).toContain('<name>2026-05-04</name>');
    expect(writeCalls[1][2]).toEqual(expect.objectContaining({ append: true }));
    expect(writeCalls[2][1]).toContain('<name>2026-05-05</name>');
    expect(writeCalls[2][2]).toEqual(expect.objectContaining({ append: true }));
    expect(writeCalls[3][1]).toBe('</gpx>\n');
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      'file:///cache/strollia-all.gpx',
      expect.objectContaining({ mimeType: 'application/gpx+xml' }),
    );
  });

  it('共有機能が使えない場合はエラーを投げる', async () => {
    (getDailyLogs as jest.Mock).mockResolvedValue([dailyLog('2026-05-04', 1)]);
    (getLocationPointsByDate as jest.Mock).mockResolvedValue(day1Points);
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);

    await expect(shareAllLogsAsGpx()).rejects.toThrow('この端末では共有機能を利用できません。');
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx jest src/features/export/__tests__/gpxExporter.test.ts`
Expected: FAIL — `buildGpxHeader is not a function` 等(未実装のため)。

- [ ] **Step 3: `gpxExporter.ts` を全面書き換えする**

`src/features/export/gpxExporter.ts` の全内容を以下で置き換える。

```typescript
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { getDailyLogs, getLocationPointsByDate } from '@/features/logs/logRepository';
import { LocationPoint } from '@/types/gps';

/** 全期間エクスポートのファイル名。 */
const ALL_LOGS_GPX_FILE_NAME = 'strollia-all.gpx';

/** GPX内のテキスト要素でXML構文を壊す文字をエスケープする。 */
function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

/** GPX 1.1のXML宣言・メタデータ部分を作る。ファイルの先頭に1回だけ書き込む。 */
export function buildGpxHeader(name: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Strollia" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(name)}</name>
  </metadata>
`;
}

/** 1日分のGPSポイントを1つの`<trk>`要素へ変換する。日別チャンクとしてファイルへ追記する。 */
export function buildGpxDayTrack(localDate: string, points: LocationPoint[]): string {
  const trackPoints = points
    .map((point) => {
      const elevation = point.altitude == null ? '' : `\n        <ele>${point.altitude}</ele>`;
      return `      <trkpt lat="${point.latitude}" lon="${point.longitude}">${elevation}\n        <time>${point.recordedAt}</time>\n      </trkpt>`;
    })
    .join('\n');

  return `  <trk>
    <name>${escapeXml(localDate)}</name>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
`;
}

/** GPXのルート要素を閉じる。ファイルの末尾に1回だけ書き込む。 */
export function buildGpxFooter(): string {
  return `</gpx>\n`;
}

/**
 * 全期間のGPSログを日別チャンクで逐次追記しながらGPXへ書き出し、OS標準共有UIを開く。
 *
 * 全ポイントを一度にメモリへ載せると数十万件規模で数百MBのメモリを消費するため、
 * 1日分ずつ取得してファイルへ追記することでメモリ使用を有界化する
 * (2026-07-14のメモリ超過クラッシュ対策の一部)。出力は日別`<trk>`を複数持つ
 * 単一のGPX 1.1ファイルで、既存のGPXインポータは構造非依存で`<trkpt>`を
 * 全て収集するため往復互換は維持される。
 */
export async function shareAllLogsAsGpx(): Promise<void> {
  const dailyLogs = await getDailyLogs();
  const activeDates = dailyLogs
    .filter((log) => log.pointCount > 0)
    .map((log) => log.localDate)
    .sort();

  if (activeDates.length === 0) {
    throw new Error('GPXとして出力できるGPSポイントがありません。');
  }

  const fileUri = `${FileSystem.cacheDirectory}${ALL_LOGS_GPX_FILE_NAME}`;

  await FileSystem.writeAsStringAsync(fileUri, buildGpxHeader('Strollia all'), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  for (const localDate of activeDates) {
    const points = await getLocationPointsByDate(localDate);

    if (points.length === 0) {
      continue;
    }

    await FileSystem.writeAsStringAsync(fileUri, buildGpxDayTrack(localDate, points), {
      encoding: FileSystem.EncodingType.UTF8,
      append: true,
    });
  }

  await FileSystem.writeAsStringAsync(fileUri, buildGpxFooter(), {
    encoding: FileSystem.EncodingType.UTF8,
    append: true,
  });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('この端末では共有機能を利用できません。');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/gpx+xml',
    dialogTitle: ALL_LOGS_GPX_FILE_NAME,
    UTI: 'com.topografix.gpx',
  });
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npx jest src/features/export/__tests__/gpxExporter.test.ts`
Expected: PASS(全件)。

- [ ] **Step 5: コミット**

```bash
git add src/features/export/gpxExporter.ts src/features/export/__tests__/gpxExporter.test.ts
git commit -m "$(cat <<'EOF'
refactor(export): GPXエクスポートを日別チャンク追記方式に変更しメモリ使用を有界化する

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: useAutoFitInitialRoute を境界ベースの初期表示へ切り替える

**Files:**
- Modify: `src/ui/hooks/useAutoFitInitialRoute.ts`(全面書き換え)
- Test: `src/ui/hooks/__tests__/useAutoFitInitialRoute.test.tsx`(全面書き換え)

**Interfaces:**
- Consumes: なし(`Region` 型は `react-native-maps` から、`RefObject<MapView | null>` も同様。このタスク単体でテスト可能)
- Produces: `export function useAutoFitInitialRoute(mapRef: RefObject<MapView | null>, screenMode: string, initialRegion: Region, hasAnyLocationPoints: boolean, userCoordinate: LatLng | null): void`(旧シグネチャ `(mapRef, screenMode, routeCoordinates: LatLng[], userCoordinate)` から変更。Task 7 で呼び出し元を更新する)

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/hooks/__tests__/useAutoFitInitialRoute.test.tsx` の全内容を以下で置き換える。

```typescript
import { renderHook } from '@testing-library/react-native';
import { useAutoFitInitialRoute } from '@/ui/hooks/useAutoFitInitialRoute';

const region = { latitude: 35, longitude: 139, latitudeDelta: 1, longitudeDelta: 1 };

describe('初期ルートフィットhook useAutoFitInitialRoute', () => {
  test('地図画面で現在地未取得かつ記録がある場合は初期表示範囲へアニメーションする', () => {
    const animateToRegion = jest.fn();
    const mapRef = { current: { animateToRegion } } as unknown as Parameters<typeof useAutoFitInitialRoute>[0];

    renderHook(() => useAutoFitInitialRoute(mapRef, 'map', region, true, null));

    expect(animateToRegion).toHaveBeenCalledTimes(1);
    expect(animateToRegion).toHaveBeenCalledWith(region);
  });

  test('記録が1件もない場合はアニメーションしない', () => {
    const animateToRegion = jest.fn();
    const mapRef = { current: { animateToRegion } } as unknown as Parameters<typeof useAutoFitInitialRoute>[0];

    renderHook(() => useAutoFitInitialRoute(mapRef, 'map', region, false, null));

    expect(animateToRegion).not.toHaveBeenCalled();
  });

  test('現在地取得済みの場合はアニメーションしない', () => {
    const animateToRegion = jest.fn();
    const mapRef = { current: { animateToRegion } } as unknown as Parameters<typeof useAutoFitInitialRoute>[0];

    renderHook(() => useAutoFitInitialRoute(mapRef, 'map', region, true, { latitude: 35, longitude: 139 }));

    expect(animateToRegion).not.toHaveBeenCalled();
  });

  test('地図画面以外ではアニメーションしない', () => {
    const animateToRegion = jest.fn();
    const mapRef = { current: { animateToRegion } } as unknown as Parameters<typeof useAutoFitInitialRoute>[0];

    renderHook(() => useAutoFitInitialRoute(mapRef, 'settings', region, true, null));

    expect(animateToRegion).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx jest src/ui/hooks/__tests__/useAutoFitInitialRoute.test.tsx`
Expected: FAIL — 型エラー、または `fitToCoordinates`/`animateToRegion` の呼び出し不一致。

- [ ] **Step 3: `useAutoFitInitialRoute.ts` を書き換える**

`src/ui/hooks/useAutoFitInitialRoute.ts` の全内容を以下で置き換える。

```typescript
import { useEffect, RefObject } from 'react';
import MapView from 'react-native-maps';
import type { LatLng, Region } from 'react-native-maps';

/**
 * 初回の現在地取得前に、保存済みGPSログの初期表示範囲(境界+マージン)へ地図をアニメーションする。
 *
 * `MapView` の `initialRegion` propは初回マウント時の値で固定されるため、境界計算が
 * マウント後に非同期で確定した場合はこのeffectで明示的に移動させる必要がある。
 */
export function useAutoFitInitialRoute(
  mapRef: RefObject<MapView | null>,
  screenMode: string,
  initialRegion: Region,
  hasAnyLocationPoints: boolean,
  userCoordinate: LatLng | null,
): void {
  useEffect(() => {
    if (screenMode !== 'map' || !hasAnyLocationPoints || userCoordinate) {
      return;
    }

    mapRef.current?.animateToRegion(initialRegion);
  }, [mapRef, initialRegion, hasAnyLocationPoints, screenMode, userCoordinate]);
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npx jest src/ui/hooks/__tests__/useAutoFitInitialRoute.test.tsx`
Expected: PASS(全件)。

- [ ] **Step 5: コミット**

```bash
git add src/ui/hooks/useAutoFitInitialRoute.ts src/ui/hooks/__tests__/useAutoFitInitialRoute.test.tsx
git commit -m "$(cat <<'EOF'
refactor(map): 初期ルートフィットをルート座標配列ではなく初期表示範囲ベースに変更する

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: useLocationRecordingSync から全件points読み込みを除去する

**Files:**
- Modify: `src/ui/hooks/useLocationRecordingSync.ts`
- Modify: `src/ui/hooks/__tests__/useAppInitialization.test.tsx:75`(`allPoints: []` を `pointsBounds: null` に変更)

**Interfaces:**
- Consumes: `LocationPointsBounds`, `getLocationPointsBounds()`(Task 2, `@/features/logs/logRepository`)、`calculateTotalDistanceMeters(dailyLogs): Promise<number>`(Task 3, `@/features/logs/dailyLogsService`)
- Produces: `UseLocationRecordingSyncResult` から `points: LocationPoint[]` を削除し、`pointsBounds: LocationPointsBounds | null` と `distance: number` を追加する。`RefreshDataResult` の `allPoints: LocationPoint[]` を `pointsBounds: LocationPointsBounds | null` に変更する(Task 7・`useAppInitialization` が参照する型)。

- [ ] **Step 1: `useLocationRecordingSync.ts` の型・importを変更する**

`src/ui/hooks/useLocationRecordingSync.ts:1-21` の import ブロックを以下に置き換える。

```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Linking } from 'react-native';

import {
  canRequestLocationPermissionInApp,
  getLocationPermissionState,
  hasRequiredLocationPermission,
  LocationPermissionState,
} from '@/features/location/locationPermission';
import {
  isBackgroundLocationRecording,
  startBackgroundLocationRecording,
  stopBackgroundLocationRecording,
  updateBackgroundLocationTaskOptionsIfNeeded,
} from '@/features/location/locationService';
import { calculateTotalDistanceMeters } from '@/features/logs/dailyLogsService';
import { getDailyLogs, getLocationPointsBounds, LocationPointsBounds } from '@/features/logs/logRepository';
import { getMonthlyAreaReport, MonthlyAreaReport } from '@/features/reports/monthlyAreaReport';
import { getPreviousReportMonth } from '@/features/reports/monthlyReport';
import type { DailyLogSummary } from '@/types/gps';
import { shouldStartRecordingAutomatically } from '@/ui/autoRecording';
import type { AutoStartStatus } from '@/ui/appTypes';
```

- [ ] **Step 2: `RefreshDataResult` と `UseLocationRecordingSyncResult` を変更する**

`src/ui/hooks/useLocationRecordingSync.ts:49-55` の `RefreshDataResult` を以下に置き換える。

```typescript
/** refreshData が返すデータ構造。 */
export type RefreshDataResult = {
  logs: DailyLogSummary[];
  pointsBounds: LocationPointsBounds | null;
  recording: boolean;
  permissions: LocationPermissionState;
};
```

`src/ui/hooks/useLocationRecordingSync.ts:78-83` の該当2フィールド(`dailyLogs` の直後にある `points` doc/field と `monthlyAreaReport` の間)を以下に置き換える。

```typescript
  /** 全日別記録のサマリ一覧。 */
  dailyLogs: DailyLogSummary[];
  /** 有効な緯度経度を持つ全ポイントの外接境界と件数。地図の初期表示範囲・空状態表示に使う。未取得/0件はnull。 */
  pointsBounds: LocationPointsBounds | null;
  /** 画面表示用の総移動距離メートル。 */
  distance: number;
  /** 先月の月次エリアレポート。未取得時は null。 */
  monthlyAreaReport: MonthlyAreaReport | null;
```

- [ ] **Step 3: state・refreshDataの実装を変更する**

`src/ui/hooks/useLocationRecordingSync.ts:162-199` の該当ブロック(`const [points, setPoints] = ...` から `refreshData` の定義末尾まで)を以下に置き換える。

```typescript
  const [dailyLogs, setDailyLogs] = useState<DailyLogSummary[]>([]);
  const [pointsBounds, setPointsBounds] = useState<LocationPointsBounds | null>(null);
  const [distance, setDistance] = useState(0);
  const [monthlyAreaReport, setMonthlyAreaReport] = useState<MonthlyAreaReport | null>(null);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  /** DB、記録状態、権限状態をまとめて再読み込みし、画面表示を同期する。 */
  const refreshData = useCallback(
    async (options: { signal?: AbortSignal } = {}): Promise<RefreshDataResult> => {
      const { signal } = options;
      const [logs, pointsBoundsResult, recording, permissions] = await Promise.all([
        getDailyLogs(),
        getLocationPointsBounds(),
        isBackgroundLocationRecording(),
        getLocationPermissionState(),
      ]);
      const totalDistanceMeters = await calculateTotalDistanceMeters(logs);

      if (signal?.aborted) {
        return { logs, pointsBounds: pointsBoundsResult, recording, permissions };
      }

      setDailyLogs(logs);
      setPointsBounds(pointsBoundsResult);
      setDistance(totalDistanceMeters);
      setIsRecording(recording);
      setPermissionState(permissions);
      incrementVisitedGridRefreshVersion();

      getMonthlyAreaReport(getPreviousReportMonth())
        .then((report) => {
          if (!signal?.aborted) setMonthlyAreaReport(report);
        })
        .catch((error: unknown) => {
          console.warn('Failed to refresh monthly area report:', error);
        });

      return { logs, pointsBounds: pointsBoundsResult, recording, permissions };
    },
    [incrementVisitedGridRefreshVersion],
  );
```

- [ ] **Step 4: 戻り値オブジェクトを変更する**

`src/ui/hooks/useLocationRecordingSync.ts` の末尾 `return { ... }` ブロックにある `dailyLogs,` と `monthlyAreaReport,` の間の `points,` を削除し、以下2行に置き換える。

```typescript
    dailyLogs,
    pointsBounds,
    distance,
    monthlyAreaReport,
```

- [ ] **Step 5: `useAppInitialization` のテストfixtureを更新する**

`src/ui/hooks/__tests__/useAppInitialization.test.tsx:75` の `allPoints: [],` を `pointsBounds: null,` に変更する。

- [ ] **Step 6: 型チェックとテストを実行する**

Run: `npm run typecheck`
Expected: `src/ui/state/AppStateProvider.tsx` で `points` 未定義等のエラーが出る(Task 7 で解消するため、今は許容する)。`src/ui/hooks/useLocationRecordingSync.ts` 自体にエラーが無いことを確認する。

Run: `npx jest src/ui/hooks/__tests__/useAppInitialization.test.tsx`
Expected: PASS。

- [ ] **Step 7: コミット**

```bash
git add src/ui/hooks/useLocationRecordingSync.ts src/ui/hooks/__tests__/useAppInitialization.test.tsx
git commit -m "$(cat <<'EOF'
refactor(state): useLocationRecordingSyncの全件points読み込みを境界クエリへ置き換える

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: AppStateProvider・MapScreen・画面ルートを配線し直す

**Files:**
- Modify: `src/ui/state/AppStateProvider.tsx`
- Modify: `src/ui/components/MapScreen.tsx`
- Modify: `src/app/index.tsx`
- Modify: `src/app/monthly-report.tsx`
- Modify: `src/ui/components/__tests__/MapScreen.test.tsx`
- Modify: `src/app/__tests__/monthlyReportRouteGate.test.tsx`
- Delete: `src/ui/hooks/useMapRouteState.ts`
- Delete: `src/ui/hooks/__tests__/useMapRouteState.test.ts`

**Interfaces:**
- Consumes: Task 1〜6 の全成果物(`createRegionFromBounds`, `getLocationPointsByMonth`, `shareAllLogsAsGpx`, `useAutoFitInitialRoute` 新シグネチャ, `useLocationRecordingSync` の `pointsBounds`/`distance`)
- Produces: `AppStateContextValue` から `points`, `renderRouteCoordinates` を削除し、`hasAnyLocationPoints: boolean` と `monthlyReportPoints: LocationPoint[]` を追加する。`MapScreenProps` から `points: LocationPoint[]` を削除し `hasAnyLocationPoints: boolean` を追加する。

- [ ] **Step 1: `useMapRouteState` を削除する**

```bash
rm src/ui/hooks/useMapRouteState.ts src/ui/hooks/__tests__/useMapRouteState.test.ts
```

- [ ] **Step 2: `AppStateProvider.tsx` の import を変更する**

`src/ui/state/AppStateProvider.tsx:10` の `import { shareGpx } from '@/features/export/gpxExporter';` を以下に置き換える。

```typescript
import { shareAllLogsAsGpx } from '@/features/export/gpxExporter';
```

`src/ui/state/AppStateProvider.tsx:22` の `import { deleteAllUserData } from '@/features/logs/logRepository';` を以下に置き換える。

```typescript
import { deleteAllUserData, getLocationPointsByMonth } from '@/features/logs/logRepository';
```

`src/ui/state/AppStateProvider.tsx:23` の `import { createMonthlyReport, getPreviousReportMonth, hasMonthlyReportData } from '@/features/reports/monthlyReport';` を以下に置き換える(`formatReportMonth` を追加)。

```typescript
import { createMonthlyReport, formatReportMonth, getPreviousReportMonth, hasMonthlyReportData } from '@/features/reports/monthlyReport';
```

`src/ui/state/AppStateProvider.tsx:42` の `import { createStyles } from '@/ui/appStyles';` の下、`src/ui/state/AppStateProvider.tsx:39-42` にある `useMapRouteState` の import行(`import { useMapRouteState } from '@/ui/hooks/useMapRouteState';`)を削除する。

`src/ui/state/AppStateProvider.tsx:39` の `import { useForegroundUserLocation } from '@/ui/hooks/useForegroundUserLocation';` の直前にある `import { useAutoFitInitialRoute } from '@/ui/hooks/useAutoFitInitialRoute';` はそのまま残す(シグネチャのみ変更されるため import 文自体は変更不要)。

`src/ui/state/AppStateProvider.tsx:34` の `import { createStyles } from '@/ui/appStyles';` の下にある `import { createRegionFromBounds } from '@/features/map/routeMapper';` を追加する(既存 import ブロック内の適切な位置、`@/features/reports/monthlyReport` の import の近くに追加してよい)。

- [ ] **Step 3: `useLocationRecordingSync` の分割代入を変更する**

`src/ui/state/AppStateProvider.tsx:473-498` の `useLocationRecordingSync` 呼び出しブロックにある分割代入から `dailyLogs,` の直後の `points,` を削除し、`monthlyAreaReport,` の直前に `pointsBounds,` と `distance,` を追加する(結果として `dailyLogs, pointsBounds, distance, monthlyAreaReport,` の順になる)。

- [ ] **Step 4: `initialRegion`/`hasAnyLocationPoints` の算出に置き換える**

`src/ui/state/AppStateProvider.tsx:499` の以下の行を削除する。

```typescript
  const { renderRouteCoordinates, initialRegion, distance } = useMapRouteState(points, dailyLogs);
```

削除した箇所に以下を追加する。

```typescript
  const hasAnyLocationPoints = pointsBounds != null;
  const initialRegion = useMemo(() => createRegionFromBounds(pointsBounds), [pointsBounds]);
```

- [ ] **Step 5: `useAutoFitInitialRoute` の呼び出しを変更する**

`src/ui/state/AppStateProvider.tsx:674` の以下の行を削除する。

```typescript
  useAutoFitInitialRoute(mapRef, screenMode, renderRouteCoordinates, userCoordinate);
```

削除した箇所に以下を追加する。

```typescript
  useAutoFitInitialRoute(mapRef, screenMode, initialRegion, hasAnyLocationPoints, userCoordinate);
```

- [ ] **Step 6: `exportAllLogs` を変更する**

`src/ui/state/AppStateProvider.tsx:596-602` の `exportAllLogs` を以下に置き換える。

```typescript
  /** 全期間のGPSログをGPXとして共有する。 */
  const exportAllLogs = useCallback(async (): Promise<void> => {
    try {
      await shareAllLogsAsGpx();
    } catch (error: unknown) {
      Alert.alert('エクスポート失敗', error instanceof Error ? error.message : 'GPX出力に失敗しました。');
    }
  }, []);
```

- [ ] **Step 7: `openMonthlyReport`/`enterMonthlyReportOrPrompt` を非同期化する**

`src/ui/state/AppStateProvider.tsx:754-794` の `openMonthlyReport` と `enterMonthlyReportOrPrompt` を以下に置き換える。

```typescript
  /** 月次レポート画面へ移動する。無料ユーザーはペイウォールを表示する。 */
  function openMonthlyReport(): void {
    // 起動直後は premiumAccessState がデフォルト値（未確定）のままの可能性があるため、
    // ボタン押下時に最新状態を取得してから判定する。
    getPremiumAccessState()
      .then((latestState) => {
        setPremiumAccessState(latestState);
        return enterMonthlyReportOrPrompt(latestState.isPlusActive);
      })
      .catch((error: unknown) => {
        console.warn('Failed to check premium access state:', error);
        return enterMonthlyReportOrPrompt(premiumAccessState.isPlusActive);
      });
  }

  /**
   * Plus状態と先月データの有無に応じて、月次レポート遷移・ペイウォール・集計中案内を出し分ける。
   *
   * 先月分のGPSポイントはこの関数の中で取得する(全期間ポイントをメモリへ保持しないため)。
   *
   * @param isPlusActive - Strollia Plusが有効かどうか。
   * @returns なし。
   */
  async function enterMonthlyReportOrPrompt(isPlusActive: boolean): Promise<void> {
    if (!isPlusActive) {
      openPremiumPaywall();
      return;
    }

    let previousMonthPoints: LocationPoint[];
    try {
      previousMonthPoints = await getLocationPointsByMonth(formatReportMonth(getPreviousReportMonth()));
    } catch (error: unknown) {
      console.warn('Failed to load previous month points:', error);
      Alert.alert('エラー', '月次レポートの読み込みに失敗しました。');
      return;
    }

    const previousMonthReport = createMonthlyReport(dailyLogs, previousMonthPoints, getPreviousReportMonth());
    if (!hasMonthlyReportData(previousMonthReport)) {
      Alert.alert('現在集計中です！', '来月になったらもう一度来てください！');
      return;
    }

    setMonthlyReportPoints(previousMonthPoints);
    refreshAchievementState().catch(() => undefined);
    if (navigator?.openMonthlyReport) {
      triggerLightImpactHaptic();
      navigator.openMonthlyReport();
    } else {
      navigateToScreen('monthlyReport');
    }
  }
```

- [ ] **Step 8: `monthlyReportPoints` stateを追加する**

`src/ui/state/AppStateProvider.tsx:444-445` 付近(`const [isFirstLaunchTutorialVisible, ...` の直後)に以下を追加する。

```typescript
  const [monthlyReportPoints, setMonthlyReportPoints] = useState<LocationPoint[]>([]);
```

- [ ] **Step 9: `AppStateContextValue` 型を変更する**

`src/ui/state/AppStateProvider.tsx:125-132` にある以下2フィールドを

```typescript
  /** 日別ログの一覧。 */
  dailyLogs: DailyLogSummary[];
  /** 全GPSポイント配列。 */
  points: LocationPoint[];
  /** 月次エリアレポート。 */
  monthlyAreaReport: MonthlyAreaReport | null;
```

以下に置き換える。

```typescript
  /** 日別ログの一覧。 */
  dailyLogs: DailyLogSummary[];
  /** GPS記録が1件以上あるか(空状態表示・初期フィットの判定用)。 */
  hasAnyLocationPoints: boolean;
  /** 先月分の月次レポート用GPSポイント(openMonthlyReportで取得)。 */
  monthlyReportPoints: LocationPoint[];
  /** 月次エリアレポート。 */
  monthlyAreaReport: MonthlyAreaReport | null;
```

`src/ui/state/AppStateProvider.tsx:155-156` にある以下のフィールドを削除する。

```typescript
  /** ルート座標列(地図描画用)。 */
  renderRouteCoordinates: RouteCoordinate[];
```

`AppStateContextValue` 型定義の中で `RouteCoordinate` を参照している箇所が上記1つだけであることを確認し、ファイル冒頭の `import type { RouteCoordinate } from '@/features/map/routeMapper';` を削除する(他に使用箇所がある場合は残す)。

- [ ] **Step 10: `value` オブジェクトを変更する**

`src/ui/state/AppStateProvider.tsx` の `const value: AppStateContextValue = { ... }` ブロックにある `dailyLogs,` と `monthlyAreaReport,` の間の `points,` を削除し、以下に置き換える。

```typescript
    dailyLogs,
    hasAnyLocationPoints,
    monthlyReportPoints,
    monthlyAreaReport,
```

同ブロック内の `renderRouteCoordinates,` の行を削除する。

- [ ] **Step 11: `MapScreen.tsx` のprops型と本体を変更する**

`src/ui/components/MapScreen.tsx:69-70` の以下を

```typescript
  /** 保存済みGPSポイント。 */
  points: LocationPoint[];
```

以下に置き換える。

```typescript
  /** GPS記録が1件以上あるか(空状態表示の判定用)。 */
  hasAnyLocationPoints: boolean;
```

`src/ui/components/MapScreen.tsx:138` の分割代入 `points,` を `hasAnyLocationPoints,` に置き換える。

`src/ui/components/MapScreen.tsx:243` の `{points.length === 0 && (` を `{!hasAnyLocationPoints && (` に置き換える。

`src/ui/components/MapScreen.tsx:12` の `import { LocationPoint } from '@/types/gps';` を削除する(この型はファイル内で他に使われていないため)。

- [ ] **Step 12: `src/app/index.tsx` を変更する**

`src/app/index.tsx:62` の `points={s.points}` を `hasAnyLocationPoints={s.hasAnyLocationPoints}` に置き換える。

- [ ] **Step 13: `src/app/monthly-report.tsx` を変更する**

`src/app/monthly-report.tsx:24` の `points={s.points}` を `points={s.monthlyReportPoints}` に置き換える(`MonthlyReportScreenProps.points` の型・`MonthlyReportScreen.tsx` 自体は変更不要。先月分に絞られたポイントが渡されるようになるだけで、`createMonthlyReport` 内部での月フィルタは冪等に動作する)。

- [ ] **Step 14: `MapScreen.test.tsx` を更新する**

`src/ui/components/__tests__/MapScreen.test.tsx:67` の `createProps()` 内 `points: [],` を `hasAnyLocationPoints: false,` に置き換える。

- [ ] **Step 15: `monthlyReportRouteGate.test.tsx` を更新する**

`src/app/__tests__/monthlyReportRouteGate.test.tsx:10` の `mockState` オブジェクト内 `points: [],` を `monthlyReportPoints: [],` に置き換える。

- [ ] **Step 16: 型チェックを実行し全エラーを解消する**

Run: `npm run typecheck`
Expected: PASS(エラー0件)。エラーが残る場合は、ここまでのStepで変更漏れがある箇所(特に他コンポーネントからの `s.points`/`s.renderRouteCoordinates` 参照)を `grep -rn "\.points\b\|renderRouteCoordinates" src/` で洗い出し、同じ方針(`hasAnyLocationPoints` または `monthlyReportPoints` へ置換)で解消する。

- [ ] **Step 17: 関連テストを実行する**

Run: `npx jest src/ui/components/__tests__/MapScreen.test.tsx src/app/__tests__/monthlyReportRouteGate.test.tsx src/ui/components/reports/__tests__/MonthlyReportScreen.test.tsx src/app/__tests__/routerIndex.test.tsx`
Expected: PASS(全件)。

- [ ] **Step 18: コミット**

```bash
git add src/ui/state/AppStateProvider.tsx src/ui/components/MapScreen.tsx src/app/index.tsx src/app/monthly-report.tsx src/ui/components/__tests__/MapScreen.test.tsx src/app/__tests__/monthlyReportRouteGate.test.tsx
git rm src/ui/hooks/useMapRouteState.ts src/ui/hooks/__tests__/useMapRouteState.test.ts
git commit -m "$(cat <<'EOF'
refactor(state): AppStateProviderから全件points配列を撤去し境界クエリベースへ配線し直す

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 統合テスト(AppMapReturn.test.tsx)を追従させ全体テストを緑にする

**Files:**
- Modify: `src/ui/__tests__/AppMapReturn.test.tsx:390-393`

**Interfaces:**
- Consumes: Task 2 の `getLocationPointsBounds`, `getLocationPointsByMonth`, `getLocationPointsByDates`(`@/features/logs/logRepository`)

**背景:** `src/ui/__tests__/AppMapReturn.test.tsx` は `renderRouter('src/app')` で `AppStateProvider` を実際にレンダーする大規模統合テスト(2278行)。`getAllLocationPoints` への参照は以下の1箇所のモック宣言のみで、テスト内で個別にオーバーライドされていないことを確認済み。デフォルトを「データなし」(`null`/`[]`)にすることで、`mockAnimateToRegion` を使う既存アサーション(`toHaveBeenCalledTimes(1)` 等)は `hasAnyLocationPoints=false` のままとなり影響を受けない。

- [ ] **Step 1: logRepositoryモックを更新する**

`src/ui/__tests__/AppMapReturn.test.tsx:390-393` の以下を

```typescript
jest.mock('@/features/logs/logRepository', () => ({
  deleteAllUserData: jest.fn().mockResolvedValue(undefined),
  getAllLocationPoints: jest.fn().mockResolvedValue([]),
  getDailyLogs: jest.fn().mockResolvedValue([]),
}));
```

以下に置き換える。

```typescript
jest.mock('@/features/logs/logRepository', () => ({
  deleteAllUserData: jest.fn().mockResolvedValue(undefined),
  getDailyLogs: jest.fn().mockResolvedValue([]),
  getLocationPointsBounds: jest.fn().mockResolvedValue(null),
  getLocationPointsByDates: jest.fn().mockResolvedValue([]),
  getLocationPointsByMonth: jest.fn().mockResolvedValue([]),
}));
```

- [ ] **Step 2: このファイル単体を実行する**

Run: `npx jest src/ui/__tests__/AppMapReturn.test.tsx`
Expected: PASS(全件)。もし `mockAnimateToRegion` 関連のテストが失敗した場合は、失敗したテストの直前の操作で `hasAnyLocationPoints` が `true` になっていないか(= `getLocationPointsBounds` がそのテスト内で `null` 以外にオーバーライドされていないか)を確認し、当該テストのみ `jest.clearAllMocks()` 直後に `(getLocationPointsBounds as jest.Mock).mockResolvedValue(null);` を明示的に追加する。月次レポート関連のテスト(`describe` ブロック外の「月次レポートボタンは...」テスト群)が失敗した場合は、`hasMonthlyReportData` の判定が `dailyLogs`(`activeDays`)側だけで成立しているか、`previousMonthDailyLog()` の `pointCount: 5` が維持されているかを確認する。

- [ ] **Step 3: リポジトリ全体のテストを実行する**

Run: `npm test`
Expected: PASS(全件)。失敗するテストがあれば、その出力内容から関連タスク(Task 1〜7)のどの変更に起因するかを特定し、該当ファイルを修正した上で再実行する。

- [ ] **Step 4: コミット**

```bash
git add src/ui/__tests__/AppMapReturn.test.tsx
git commit -m "$(cat <<'EOF'
test(state): 統合テストのlogRepositoryモックを境界クエリ方式へ追従させる

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 関連ドキュメントを更新する

**Files:**
- Modify: `docs/data-storage.md`
- Modify: `docs/architecture.md`
- Modify: `.ai/context/architecture.md`
- Modify: `docs/map-rendering.md`
- Modify: `docs/import-export.md`

**Interfaces:**
- Consumes: なし(ドキュメントのみ)

- [ ] **Step 1: `docs/data-storage.md` を更新する**

`getAllLocationPoints` について記述している箇所を `grep -n "getAllLocationPoints\|全期間" docs/data-storage.md` で探し、その近辺(GPSポイント取得に関する節)に以下の内容を追記する: 「地図の初期表示範囲は `getLocationPointsBounds()`(`MIN/MAX/COUNT` のSQL集計)で取得し、全期間のGPSポイントをアプリメモリへロードしない。月次レポートは `getLocationPointsByMonth(yearMonth)` で対象月のみ、総移動距離のフォールバック計算は `getLocationPointsByDates(localDates)` で距離欠落日のみを取得する(2026-07-14のメモリ超過クラッシュ対策)。」

- [ ] **Step 2: `docs/architecture.md` と `.ai/context/architecture.md` を更新する**

両ファイルで `useMapRouteState` を記述している箇所を `grep -n "useMapRouteState" docs/architecture.md .ai/context/architecture.md` で探し、削除した上で、`AppStateProvider` が `pointsBounds`(`useLocationRecordingSync` 経由)から `createRegionFromBounds`(`@/features/map/routeMapper`)で直接 `initialRegion` を算出する旨に書き換える。`.ai/context/architecture.md` のディレクトリマップ表内 `src/ui/hooks/` の説明列に `useMapRouteState` への言及があれば削除する。

- [ ] **Step 3: `docs/map-rendering.md` を更新する**

`grep -n "createInitialRegion\|initialRegion\|全履歴" docs/map-rendering.md` で該当箇所を探し、初期表示範囲がSQL集計した境界(緯度経度のmin/max)から算出される旨、および `createInitialRegion` 内部のスプレッド展開を廃止しループ集計に変更した旨(データ量に依存せず動作する)を追記する。

- [ ] **Step 4: `docs/import-export.md` を更新する**

`grep -n "GPX\|buildGpx\|エクスポート" docs/import-export.md` で該当箇所を探し、全期間エクスポートが単一GPXファイル内に日別`<trk>`要素を複数持つ構造になったこと、日別チャンクを逐次ファイル追記することでメモリ使用量が1日分に有界化されること、既存のGPXインポータは構造非依存で全`<trkpt>`を収集するため往復互換(エクスポート→インポート)が維持されることを追記する。

- [ ] **Step 5: コミット**

```bash
git add docs/data-storage.md docs/architecture.md .ai/context/architecture.md docs/map-rendering.md docs/import-export.md
git commit -m "$(cat <<'EOF'
docs: 全GPSポイントのメモリロード廃止に合わせてドキュメントを更新する

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: 最終検証

**Files:** なし(検証のみ、コード変更なし)

**Interfaces:** なし

- [ ] **Step 1: 型チェック**

Run: `npm run typecheck`
Expected: エラー0件。

- [ ] **Step 2: テスト全件**

Run: `npm test`
Expected: 全件PASS。

- [ ] **Step 3: lint**

Run: `npm run lint`
Expected: error 0件(warningは既存分を含め許容)。

- [ ] **Step 4: format確認**

Run: `npm run format:check`
Expected: 差分なし。差分がある場合は `npm run format` を実行し、変更をコミットに含める。

- [ ] **Step 5: 手動確認手順を記録する(実機/シミュレータでの検証が必要な項目)**

このタスクはコード変更を伴わないため、以下をユーザーへの報告に含める形で明記する(自動テストではカバーできない実機依存の項目):
- 地図画面起動時に、保存済みGPSログの初期表示範囲へ地図が正しく移動すること(現在地未取得時)
- 設定画面からのGPX全期間エクスポートで、共有シートが開き、生成されたファイルが正しい日別`<trk>`構造のGPXであること
- エクスポートしたGPXを同アプリでインポートし、全ポイントが往復復元されること
- 月次レポートボタン押下時に、先月分データの読み込み待ちで極端な遅延やちらつきが発生しないこと

- [ ] **Step 6: コミット(format差分がある場合のみ)**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: フォーマットを適用する

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```
