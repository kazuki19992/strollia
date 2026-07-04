# Visited Grid Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first vertical slice of Visited Grid Overlay so the main map can show visited 100m cells with zoom-aware Fog styling while keeping Polyline data for internal/export uses.

**Architecture:** Put grid math in pure `src/features/location/grid/*` modules, persistence in `src/features/location/visitedCellRepository.ts`, map presentation shaping in `src/features/map/gridOverlay.ts`, and React rendering in `MapScreen`. GPS task code upserts visited cells independently from accepted Polyline saving, and the speedometer UI uses raw GPS speed from foreground map events instead of accepted-point speed.

**Tech Stack:** React Native, Expo, TypeScript, Jest, expo-sqlite, react-native-maps.

---

## Follow-up Adjustment: Main Map Grid-Only Rendering

User feedback after the first vertical slice:

- Main map Polyline should not be rendered; visited grid is the primary map surface.
- Route line appearance settings should be removed from the settings screen because the main map no longer draws route lines.
- Saved base cells should be 100m square.
- Display cell sizes should be `[100, 200, 500, 1000, 2000, 5000, 10000]` meters.
- Visited cell color should be customization-ready without exposing a UI yet.
- Light mode should use a stronger color, preferably the theme primary color.
- Adjacent cell borders should not appear between cells.
- Adjacent display cells should remain separate Polygons so cell identity and fade state stay stable during zoom and pan operations.

Implementation approach:

1. Update docs and tests for the 100m base grid and new display sizes.
2. Keep display-cell aggregation in `gridAggregation` without adjacent rectangle merging.
3. Change `gridOverlay` to resolve cell color from theme primary plus optional config override, and set `strokeWidth` to `0`.
4. Render aggregated cells as one `Polygon` per cell and remove main-map `Polyline` rendering.
5. Remove route line appearance controls from `SettingsScreen` and the persisted selection plumbing in `App`.
6. Keep Polyline data and route mapper utilities for exports, reports, daily logs, and future replay/debug use.

---

## File Structure

- Create `src/features/map/config/gridOverlayConfig.ts`
  - Holds all tunable cell, color, and opacity constants.
- Create `src/features/location/grid/gridCell.ts`
  - Converts lat/lng to Web Mercator based grid cells and cell polygons.
- Create `src/features/location/grid/gridAggregation.ts`
  - Selects display cell size, aggregates 100m cells into display cells, and merges adjacent display cells.
- Create `src/features/location/grid/gridInterpolation.ts`
  - Produces visited cells from GPS points, interpolating only when speed is 150km/h or higher.
- Create `src/features/map/gridOverlay.ts`
  - Computes region bounds, Fog opacity, and polygon props for MapView.
- Create `src/features/location/visitedCellRepository.ts`
  - Creates repository functions for `visited_cells`.
- Create tests beside each feature.
- Modify `src/db/database.ts`
  - Add `visited_cells` schema and indexes.
- Modify `src/features/logs/logRepository.ts`
  - Delete `visited_cells` in `deleteAllUserData`.
- Modify `src/features/location/backgroundLocationTask.ts`
  - Upsert visited cells for each GPS point batch independently from accepted point saving.
- Modify `src/app/App.tsx`
  - Keep raw GPS speed in state, load visible visited cells, pass overlay props to `MapScreen`.
- Modify `src/app/components/MapScreen.tsx`
  - Render Grid Overlay polygons as the main route surface.
- Modify `src/app/components/__tests__/MapScreen.test.tsx`
  - Assert Grid Overlay rendering.
- Modify `docs/map-rendering.md` and `docs/data-storage.md`
  - Document visited grid storage and display.

---

### Task 1: Grid Config And Pure Grid Math

**Files:**

- Create: `src/features/map/config/gridOverlayConfig.ts`
- Create: `src/features/location/grid/gridCell.ts`
- Create: `src/features/location/grid/gridAggregation.ts`
- Test: `src/features/location/grid/__tests__/gridCell.test.ts`
- Test: `src/features/location/grid/__tests__/gridAggregation.test.ts`
- Test: `src/features/map/__tests__/gridOverlay.test.ts`
- Create: `src/features/map/gridOverlay.ts`

- [ ] **Step 1: Write failing grid math tests**

Add `src/features/location/grid/__tests__/gridCell.test.ts`:

```ts
import { cellToPolygonCoordinates, coordinateToGridCell } from '../gridCell';

describe('Visited Gridセル変換 gridCell', () => {
  it('同じ100mセル内の近い座標を同じcellIdにする', () => {
    const base = coordinateToGridCell({ latitude: 35.681236, longitude: 139.767125 });
    const nearby = coordinateToGridCell({ latitude: 35.68125, longitude: 139.76714 });

    expect(base.cellSizeMeters).toBe(100);
    expect(nearby.cellId).toBe(base.cellId);
  });

  it('セルからMapView Polygon用の4頂点を作る', () => {
    const cell = coordinateToGridCell({ latitude: 35.681236, longitude: 139.767125 });
    const polygon = cellToPolygonCoordinates(cell);

    expect(polygon).toHaveLength(4);
    expect(polygon.every((coordinate) => Number.isFinite(coordinate.latitude))).toBe(true);
    expect(polygon.every((coordinate) => Number.isFinite(coordinate.longitude))).toBe(true);
  });
});
```

Add `src/features/location/grid/__tests__/gridAggregation.test.ts`:

```ts
import { GRID_OVERLAY_CONFIG } from '../../../map/config/gridOverlayConfig';
import { aggregateVisitedCells, getDisplayCellSizeMeters } from '../gridAggregation';
import { coordinateToGridCell } from '../gridCell';

describe('Visited Grid表示集約 gridAggregation', () => {
  it('ズームに応じて表示セルサイズを選ぶ', () => {
    expect(getDisplayCellSizeMeters({ latitudeDelta: 0.005 }, GRID_OVERLAY_CONFIG)).toBe(100);
    expect(getDisplayCellSizeMeters({ latitudeDelta: 0.03 }, GRID_OVERLAY_CONFIG)).toBe(100);
    expect(getDisplayCellSizeMeters({ latitudeDelta: 0.08 }, GRID_OVERLAY_CONFIG)).toBe(200);
    expect(getDisplayCellSizeMeters({ latitudeDelta: 0.5 }, GRID_OVERLAY_CONFIG)).toBe(1000);
  });

  it('visitedな100mセルが1つでもあれば大セルをvisitedにする', () => {
    const cell = coordinateToGridCell({ latitude: 35.681236, longitude: 139.767125 });
    const aggregated = aggregateVisitedCells([cell], 200);

    expect(aggregated).toHaveLength(1);
    expect(aggregated[0].cellSizeMeters).toBe(200);
    expect(aggregated[0].cellId.startsWith('200:')).toBe(true);
  });
});
```

Add `src/features/map/__tests__/gridOverlay.test.ts`:

```ts
import { GRID_OVERLAY_CONFIG } from '../config/gridOverlayConfig';
import { getFogOpacity } from '../gridOverlay';

describe('Visited Grid Overlay表示計算 gridOverlay', () => {
  it('latitudeDeltaに応じてFog opacityを線形補間する', () => {
    expect(getFogOpacity({ latitudeDelta: 0.001 }, GRID_OVERLAY_CONFIG)).toBe(0.2);
    expect(getFogOpacity({ latitudeDelta: 0.2 }, GRID_OVERLAY_CONFIG)).toBe(0.6);
    expect(getFogOpacity({ latitudeDelta: 0.105 }, GRID_OVERLAY_CONFIG)).toBeCloseTo(0.4);
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
npm run test -- src/features/location/grid/__tests__/gridCell.test.ts src/features/location/grid/__tests__/gridAggregation.test.ts src/features/map/__tests__/gridOverlay.test.ts --runInBand
```

Expected: FAIL because the new modules do not exist.

- [ ] **Step 3: Implement grid config and math**

Create `src/features/map/config/gridOverlayConfig.ts`:

```ts
/** Visited Grid Overlayの調整値。 */
export type GridOverlayConfig = {
  /** SQLiteに保存する基本セルサイズ。 */
  baseCellSizeMeters: number;
  /** 表示時に使う集約セルサイズ候補。 */
  displayCellSizesMeters: number[];
  /** 通常表示時のFog opacity。 */
  minimumFogOpacity: number;
  /** 広域表示時の最大Fog opacity。 */
  maximumFogOpacity: number;
  /** opacity変化を始めるlatitudeDelta。 */
  opacityStartLatitudeDelta: number;
  /** opacity変化が最大になるlatitudeDelta。 */
  opacityEndLatitudeDelta: number;
  /** Fogセルの色。 */
  fogColor: string;
  /** visitedセル色をテーマprimaryから差し替える場合に使う値。 */
  visitedCellColorOverride: string | null;
};

/** Visited Grid Overlayの既定設定。 */
export const GRID_OVERLAY_CONFIG: GridOverlayConfig = {
  baseCellSizeMeters: 100,
  displayCellSizesMeters: [100, 200, 500, 1000, 2000, 5000, 10000],
  minimumFogOpacity: 0.2,
  maximumFogOpacity: 0.6,
  opacityStartLatitudeDelta: 0.01,
  opacityEndLatitudeDelta: 0.2,
  fogColor: '#111111',
  visitedCellColorOverride: null,
};
```

Create `gridCell.ts` with Web Mercator conversion, `coordinateToGridCell`, `cellToPolygonCoordinates`, and `getGridBoundsForRegion`.

Create `gridAggregation.ts` with `getDisplayCellSizeMeters` and `aggregateVisitedCells`.

Create `gridOverlay.ts` with `getFogOpacity`.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
npm run test -- src/features/location/grid/__tests__/gridCell.test.ts src/features/location/grid/__tests__/gridAggregation.test.ts src/features/map/__tests__/gridOverlay.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/map/config/gridOverlayConfig.ts src/features/map/gridOverlay.ts src/features/map/__tests__/gridOverlay.test.ts src/features/location/grid/gridCell.ts src/features/location/grid/gridAggregation.ts src/features/location/grid/__tests__/gridCell.test.ts src/features/location/grid/__tests__/gridAggregation.test.ts
git commit -m "feat(map): visited gridの基礎計算を追加"
```

---

### Task 2: Visited Cell Repository And Database Schema

**Files:**

- Modify: `src/db/database.ts`
- Modify: `src/features/logs/logRepository.ts`
- Create: `src/features/location/visitedCellRepository.ts`
- Test: `src/features/location/__tests__/visitedCellRepository.test.ts`

- [ ] **Step 1: Write failing repository tests**

Add `src/features/location/__tests__/visitedCellRepository.test.ts`:

```ts
import { initializeDatabase } from '../../../db/database';
import { deleteAllUserData } from '../../logs/logRepository';
import { coordinateToGridCell } from '../grid/gridCell';
import { getVisitedCellsInBounds, upsertVisitedCells } from '../visitedCellRepository';

describe('Visited Grid保存 visitedCellRepository', () => {
  beforeEach(async () => {
    await initializeDatabase();
    await deleteAllUserData();
  });

  it('visited cellをupsertして再訪問時にvisitCountとlastVisitedAtを更新する', async () => {
    const cell = coordinateToGridCell({ latitude: 35.681236, longitude: 139.767125 });

    await upsertVisitedCells([cell], '2026-05-23T00:00:00.000Z');
    await upsertVisitedCells([cell], '2026-05-23T00:05:00.000Z');

    const cells = await getVisitedCellsInBounds({
      minX: cell.x - 1,
      maxX: cell.x + 1,
      minY: cell.y - 1,
      maxY: cell.y + 1,
    });

    expect(cells).toHaveLength(1);
    expect(cells[0].firstVisitedAt).toBe('2026-05-23T00:00:00.000Z');
    expect(cells[0].lastVisitedAt).toBe('2026-05-23T00:05:00.000Z');
    expect(cells[0].visitCount).toBe(2);
  });

  it('全データ削除でvisited cellも削除する', async () => {
    const cell = coordinateToGridCell({ latitude: 35.681236, longitude: 139.767125 });
    await upsertVisitedCells([cell], '2026-05-23T00:00:00.000Z');

    await deleteAllUserData();

    await expect(
      getVisitedCellsInBounds({
        minX: cell.x - 1,
        maxX: cell.x + 1,
        minY: cell.y - 1,
        maxY: cell.y + 1,
      }),
    ).resolves.toEqual([]);
  });
});
```

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
npm run test -- src/features/location/__tests__/visitedCellRepository.test.ts --runInBand
```

Expected: FAIL because `visitedCellRepository` does not exist.

- [ ] **Step 3: Implement schema and repository**

Add `visited_cells` schema and indexes in `initializeDatabase`.

Create repository functions:

```ts
export type VisitedCellRow = GridCell & {
  firstVisitedAt: string;
  lastVisitedAt: string;
  visitCount: number;
};

export async function upsertVisitedCells(cells: GridCell[], visitedAt: string): Promise<void>;
export async function getVisitedCellsInBounds(bounds: GridBounds): Promise<VisitedCellRow[]>;
export async function deleteAllVisitedCells(): Promise<void>;
```

Update `deleteAllUserData` to delete `visited_cells`.

- [ ] **Step 4: Run test and verify GREEN**

Run:

```bash
npm run test -- src/features/location/__tests__/visitedCellRepository.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/database.ts src/features/logs/logRepository.ts src/features/location/visitedCellRepository.ts src/features/location/__tests__/visitedCellRepository.test.ts
git commit -m "feat(location): visited cellの保存先を追加"
```

---

### Task 3: GPS To Visited Cells Pipeline

**Files:**

- Create: `src/features/location/grid/gridInterpolation.ts`
- Test: `src/features/location/grid/__tests__/gridInterpolation.test.ts`
- Modify: `src/features/location/backgroundLocationTask.ts`

- [ ] **Step 1: Write failing interpolation tests**

Add tests proving low-speed does not interpolate, fast speed does, and distance alone does not interpolate when elapsed speed is below 150km/h.

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
npm run test -- src/features/location/grid/__tests__/gridInterpolation.test.ts --runInBand
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement interpolation and task upsert**

Implement `getVisitedCellsForLocationPoint(previous, next)`:

- always include `next` point cell when accuracy is acceptable
- interpolate between previous and next only if computed speed is `>= 150km/h`
- do not interpolate when previous is missing

Modify `backgroundLocationTask.ts` to keep a `previousVisitedCellPoint` memory seed from recent accepted points, convert every incoming GPS point to candidate visited cells, and call `upsertVisitedCells`.

- [ ] **Step 4: Run targeted tests**

Run:

```bash
npm run test -- src/features/location/grid/__tests__/gridInterpolation.test.ts src/features/location/__tests__/locationQualityFilter.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/location/grid/gridInterpolation.ts src/features/location/grid/__tests__/gridInterpolation.test.ts src/features/location/backgroundLocationTask.ts
git commit -m "feat(location): GPS点からvisited cellを生成する"
```

---

### Task 4: Map Overlay Rendering

**Files:**

- Modify: `src/features/map/gridOverlay.ts`
- Test: `src/features/map/__tests__/gridOverlay.test.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/app/components/MapScreen.tsx`
- Modify: `src/app/components/__tests__/MapScreen.test.tsx`

- [ ] **Step 1: Write failing render test**

Update `MapScreen.test.tsx` to mock `Polygon` and assert visited grid polygons render with `testID="visited-grid-cell"`.

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
npm run test -- src/app/components/__tests__/MapScreen.test.tsx --runInBand
```

Expected: FAIL because `MapScreen` does not accept or render grid overlay cells.

- [ ] **Step 3: Implement overlay props and rendering**

Add `visitedGridCells` and `gridOverlayOpacity` props to `MapScreen`.

Render `Polygon` for visited grid cells before photo markers. Keep existing Polyline data available but do not render it as the main route when grid cells exist.

In `App.tsx`, load visited cells for visible region, aggregate them for display, and pass them to `MapScreen`.

- [ ] **Step 4: Run targeted tests**

Run:

```bash
npm run test -- src/app/components/__tests__/MapScreen.test.tsx src/features/map/__tests__/gridOverlay.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/map/gridOverlay.ts src/features/map/__tests__/gridOverlay.test.ts src/app/App.tsx src/app/components/MapScreen.tsx src/app/components/__tests__/MapScreen.test.tsx
git commit -m "feat(map): visited grid overlayをメインマップに表示する"
```

---

### Task 5: Raw GPS Speed For UI

**Files:**

- Create: `src/app/hooks/useRawLocationSpeed.ts`
- Test: `src/app/hooks/__tests__/useRawLocationSpeed.test.ts`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Write failing speed tests**

Add tests for converting m/s to km/h, rejecting invalid values, and retaining recent fallback briefly.

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
npm run test -- src/app/hooks/__tests__/useRawLocationSpeed.test.ts --runInBand
```

Expected: FAIL because hook/helper does not exist.

- [ ] **Step 3: Implement raw speed helper and App state**

Create pure helper `toDisplaySpeedKmh(rawSpeedMps)` and use it in `handleUserLocationChange` to update speedometer state. Replace `useReliableCurrentSpeed(points)` for the dashboard with raw speed state.

- [ ] **Step 4: Run targeted tests**

Run:

```bash
npm run test -- src/app/hooks/__tests__/useRawLocationSpeed.test.ts src/app/components/__tests__/MapBottomDashboard.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/hooks/useRawLocationSpeed.ts src/app/hooks/__tests__/useRawLocationSpeed.test.ts src/app/App.tsx
git commit -m "feat(map): 速度メーターをraw GPS speedに反応させる"
```

---

### Task 6: Documentation And Full Verification

**Files:**

- Modify: `docs/map-rendering.md`
- Modify: `docs/data-storage.md`
- Modify: `docs/architecture.md`

- [ ] **Step 1: Update docs**

Document Visited Grid as the main map surface, `visited_cells` storage, and raw-speed UI split.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run typecheck
npm run test -- --runInBand
```

Expected: PASS.

- [ ] **Step 3: Commit docs**

```bash
git add docs/map-rendering.md docs/data-storage.md docs/architecture.md
git commit -m "docs(map): visited grid overlay仕様を反映する"
```
