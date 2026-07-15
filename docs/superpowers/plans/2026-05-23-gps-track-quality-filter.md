# GPS Track Quality Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace immediate boolean GPS point saving with a quality filter that suppresses jumps, short wrong-track runs, and stationary drift while aligning route rendering and speed bands with accepted points.

**Architecture:** Add pure location quality helpers and a small in-memory tracker that turns raw Expo location points into accepted, provisional, or rejected decisions before repository writes. The background task saves only accepted points, map route derivation splits accepted history into render segments before simplification, and the speed dashboard uses accepted-point speed bands with 30 km/h and 150 km/h thresholds.

**Tech Stack:** TypeScript, Expo Location, Expo Task Manager, React Native, react-native-maps, Jest, SQLite repository helpers.

---

## File Structure

### New files

- `src/features/location/locationSpeed.ts`
  - Shared speed-band constants and accepted-point segment speed calculation.
- `src/features/location/__tests__/locationSpeed.test.ts`
  - Speed-band boundaries and segment-speed tests.
- `src/features/location/locationQualityFilter.ts`
  - Pure quality decisions and in-memory accepted/provisional tracker operations.
- `src/features/location/__tests__/locationQualityFilter.test.ts`
  - Jump, drift, provisional confirmation, and accepted short-movement coverage.
- `src/app/hooks/useReliableCurrentSpeed.ts`
  - Derives dashboard speed from accepted points instead of raw map location speed.
- `src/app/hooks/__tests__/useReliableCurrentSpeed.test.ts`
  - Dashboard speed derivation tests.

### Modified files

- `src/features/location/backgroundLocationTask.ts`
  - Replace `shouldSaveLocationPoint` writes with quality tracker decisions.
- `src/features/location/locationSaveFilter.ts`
  - Remove the old primary boolean API after reusable speed logic moves out.
- `src/features/location/__tests__/locationSaveFilter.test.ts`
  - Retire or migrate tests that belong to speed or quality decisions.
- `src/features/logs/logRepository.ts`
  - Fetch a recent accepted window to seed each background-task batch.
- `src/features/logs/__tests__/logRepository.test.ts`
  - Verify recent point fetch ordering and accepted-only writes remain distance roots.
- `src/features/map/routeMapper.ts`
  - Build `RouteSegment[]`, split abnormal route gaps, simplify each segment.
- `src/features/map/__tests__/routeMapper.test.ts`
  - Segment split and segment simplification coverage.
- `src/app/hooks/useMapRouteState.ts`
  - Expose visible route segments.
- `src/app/hooks/__tests__/useMapRouteState.test.ts`
  - Visible segment derivation coverage.
- `src/app/components/MapScreen.tsx`
  - Render one or more Polylines from route segments.
- `src/app/components/__tests__/MapScreen.test.tsx`
  - Verify multiple segment Polylines are rendered.
- `src/app/App.tsx`
  - Stop assigning dashboard speed from raw map location speed.
- `src/app/components/MapBottomDashboard.tsx`
  - Use shared 30 km/h and 150 km/h bands for dashboard color/progress behavior.
- `src/app/components/__tests__/MapBottomDashboard.test.tsx`
  - Boundary assertions for speed meter appearance.
- `docs/data-storage.md`
  - Document accepted-only writes and pending quality checks.
- `docs/map-rendering.md`
  - Document route segment splitting and speed-band behavior.

## Task 1: Shared Speed Semantics

**Files:**

- Create: `src/features/location/locationSpeed.ts`
- Create: `src/features/location/__tests__/locationSpeed.test.ts`
- Modify: `src/features/location/locationSaveFilter.ts`
- Modify: `src/features/location/__tests__/locationSaveFilter.test.ts`

- [ ] **Step 1: Write the failing speed-band and segment-speed tests**

```ts
import { classifyMovementSpeed, estimateAcceptedSegmentSpeedMps } from '../locationSpeed';

describe('GPS移動速度 locationSpeed', () => {
  it('30km/hと150km/hの境界で低速・車両・高速を分類する', () => {
    expect(classifyMovementSpeed(29.9)).toBe('low-speed');
    expect(classifyMovementSpeed(30)).toBe('vehicle');
    expect(classifyMovementSpeed(149.9)).toBe('vehicle');
    expect(classifyMovementSpeed(150)).toBe('fast');
  });

  it('保存済み点の距離と時刻差から区間速度を計算する', () => {
    const previous = point(35, 139, '2026-05-23T00:00:00.000Z');
    const next = point(35.001, 139, '2026-05-23T00:01:00.000Z');

    expect(estimateAcceptedSegmentSpeedMps(previous, next)).toBeGreaterThan(1);
    expect(estimateAcceptedSegmentSpeedMps(previous, next)).toBeLessThan(2);
  });
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run:

```bash
npm run test -- --runInBand src/features/location/__tests__/locationSpeed.test.ts
```

Expected: FAIL because `../locationSpeed` does not exist.

- [ ] **Step 3: Implement the shared speed module**

```ts
import { LocationPoint, NewLocationPoint } from '../../types/gps';
import { distanceMeters } from '../../utils/distance';

/** 保存品質判定と速度メーターで共有する速度帯。 */
export type MovementSpeedBand = 'low-speed' | 'vehicle' | 'fast';

/** 車両移動へ切り替える境界速度。 */
export const VEHICLE_SPEED_MIN_KMH = 30;
/** 高速移動へ切り替える境界速度。 */
export const FAST_SPEED_MIN_KMH = 150;

type TimedCoordinate = Pick<LocationPoint | NewLocationPoint, 'latitude' | 'longitude' | 'recordedAt'>;

/** km/h単位の速度を低速・車両・高速へ分類する。 */
export function classifyMovementSpeed(speedKmh: number): MovementSpeedBand {
  if (speedKmh >= FAST_SPEED_MIN_KMH) {
    return 'fast';
  }

  if (speedKmh >= VEHICLE_SPEED_MIN_KMH) {
    return 'vehicle';
  }

  return 'low-speed';
}

/** accepted 点同士の距離と時刻差からm/s単位の区間速度を計算する。 */
export function estimateAcceptedSegmentSpeedMps(previous: TimedCoordinate, next: TimedCoordinate): number {
  const elapsedSeconds = (Date.parse(next.recordedAt) - Date.parse(previous.recordedAt)) / 1000;

  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) {
    return 0;
  }

  return distanceMeters(previous, next) / elapsedSeconds;
}
```

- [ ] **Step 4: Migrate old movement tests away from `locationSaveFilter`**

Delete the obsolete `classifyMovement` and `estimateSpeedMps` assertions from `src/features/location/__tests__/locationSaveFilter.test.ts`. Keep only behavior still owned by the legacy file until Task 2 removes the primary save path.

- [ ] **Step 5: Run the speed and legacy location tests**

Run:

```bash
npm run test -- --runInBand src/features/location/__tests__/locationSpeed.test.ts src/features/location/__tests__/locationSaveFilter.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/location/locationSpeed.ts src/features/location/__tests__/locationSpeed.test.ts src/features/location/locationSaveFilter.ts src/features/location/__tests__/locationSaveFilter.test.ts
git commit -m "refactor(location): 速度帯判定を共通化"
```

## Task 2: Pure Location Quality Decisions

**Files:**

- Create: `src/features/location/locationQualityFilter.ts`
- Create: `src/features/location/__tests__/locationQualityFilter.test.ts`
- Modify: `src/features/location/locationSaveFilter.ts`
- Modify: `src/features/location/__tests__/locationSaveFilter.test.ts`

- [ ] **Step 1: Write failing decision tests for reliable movement and invalid input**

```ts
import { createLocationQualityContext, evaluateLocationPointQuality } from '../locationQualityFilter';

describe('GPS軌跡品質判定 locationQualityFilter', () => {
  it('精度の良い短距離移動は低速でもacceptedにする', () => {
    const context = createLocationQualityContext([point(35, 139, '2026-05-23T00:00:00.000Z')]);

    expect(evaluateLocationPointQuality(point(35.00008, 139, '2026-05-23T00:00:12.000Z'), context)).toMatchObject({
      type: 'accepted',
    });
  });

  it('精度上限を超える観測はrejectedにする', () => {
    const context = createLocationQualityContext([]);

    expect(evaluateLocationPointQuality(point(35, 139, '2026-05-23T00:00:00.000Z', { accuracy: 81 }), context)).toEqual({
      type: 'rejected',
      reason: 'accuracy-too-low',
    });
  });
});
```

- [ ] **Step 2: Run the decision tests to verify they fail**

Run:

```bash
npm run test -- --runInBand src/features/location/__tests__/locationQualityFilter.test.ts
```

Expected: FAIL because `locationQualityFilter` does not exist.

- [ ] **Step 3: Add the quality decision types and input gates**

```ts
import { NewLocationPoint } from '../../types/gps';
import { distanceMeters } from '../../utils/distance';
import { estimateAcceptedSegmentSpeedMps } from './locationSpeed';

export type LocationQualityReason =
  'accuracy-too-low' | 'duplicate-or-jitter' | 'jump-suspected' | 'stationary-drift' | 'pending-track-confirmation';

export type LocationQualityDecision =
  | { type: 'accepted'; point: NewLocationPoint }
  | { type: 'provisional'; point: NewLocationPoint; reason: LocationQualityReason }
  | { type: 'rejected'; reason: LocationQualityReason };

export type LocationQualityContext = {
  acceptedPoints: NewLocationPoint[];
  provisionalPoints: NewLocationPoint[];
};

const ABSOLUTE_MAX_ACCURACY_METERS = 80;
const ACCEPTED_WINDOW_SIZE = 6;

export function createLocationQualityContext(
  acceptedPoints: NewLocationPoint[],
  provisionalPoints: NewLocationPoint[] = [],
): LocationQualityContext {
  return {
    acceptedPoints: acceptedPoints.slice(-ACCEPTED_WINDOW_SIZE),
    provisionalPoints,
  };
}

export function evaluateLocationPointQuality(point: NewLocationPoint, context: LocationQualityContext): LocationQualityDecision {
  const accuracy = point.accuracy ?? ABSOLUTE_MAX_ACCURACY_METERS;

  if (accuracy > ABSOLUTE_MAX_ACCURACY_METERS) {
    return { type: 'rejected', reason: 'accuracy-too-low' };
  }

  const previousAccepted = context.acceptedPoints.at(-1);

  if (!previousAccepted) {
    return accuracy <= 50 ? { type: 'accepted', point } : { type: 'rejected', reason: 'accuracy-too-low' };
  }

  const distance = distanceMeters(previousAccepted, point);
  const speedMps = estimateAcceptedSegmentSpeedMps(previousAccepted, point);

  if (distance < 5) {
    return { type: 'rejected', reason: 'duplicate-or-jitter' };
  }

  if (speedMps > 70) {
    return { type: 'provisional', point, reason: 'jump-suspected' };
  }

  return { type: 'accepted', point };
}
```

- [ ] **Step 4: Add failing jump and stationary-drift tests**

```ts
it('短時間の大ジャンプはraw speedが低くてもprovisionalにする', () => {
  const context = createLocationQualityContext([point(35, 139, '2026-05-23T00:00:00.000Z')]);
  const jump = point(35.02, 139, '2026-05-23T00:00:10.000Z', { speed: 1 });

  expect(evaluateLocationPointQuality(jump, context)).toMatchObject({
    type: 'provisional',
    reason: 'jump-suspected',
  });
});

it('停止クラスタ内の散りは移動距離にせずrejectedにする', () => {
  const context = createLocationQualityContext([
    point(35, 139, '2026-05-23T00:00:00.000Z'),
    point(35.00002, 139, '2026-05-23T00:00:20.000Z'),
    point(35.00001, 139.00001, '2026-05-23T00:00:40.000Z'),
  ]);

  expect(evaluateLocationPointQuality(point(35.00012, 139, '2026-05-23T00:01:00.000Z'), context)).toMatchObject({
    type: 'rejected',
    reason: 'stationary-drift',
  });
});
```

- [ ] **Step 5: Implement stationary-cluster and jump helpers**

```ts
const STATIONARY_CLUSTER_RADIUS_METERS = 25;
const STATIONARY_DRIFT_ESCAPE_METERS = 20;

function isStationaryCluster(points: NewLocationPoint[]): boolean {
  if (points.length < 3) {
    return false;
  }

  const anchor = points[0];
  return points.every((candidate) => distanceMeters(anchor, candidate) <= STATIONARY_CLUSTER_RADIUS_METERS);
}

function rejectStationaryDrift(
  point: NewLocationPoint,
  context: LocationQualityContext,
  previousAccepted: NewLocationPoint,
): LocationQualityDecision | null {
  if (!isStationaryCluster(context.acceptedPoints)) {
    return null;
  }

  return distanceMeters(previousAccepted, point) <= STATIONARY_DRIFT_ESCAPE_METERS
    ? { type: 'rejected', reason: 'stationary-drift' }
    : { type: 'provisional', point, reason: 'pending-track-confirmation' };
}
```

Call `rejectStationaryDrift` before normal acceptance.

- [ ] **Step 6: Add failing provisional confirmation tests**

```ts
import { advanceLocationQualityContext } from '../locationQualityFilter';

it('自然なprovisional点列はacceptedへ昇格する', () => {
  const accepted = [point(35, 139, '2026-05-23T00:00:00.000Z')];
  const first = advanceLocationQualityContext(point(35.01, 139, '2026-05-23T00:00:10.000Z'), createLocationQualityContext(accepted));
  const second = advanceLocationQualityContext(point(35.011, 139, '2026-05-23T00:00:20.000Z'), first.context);
  const third = advanceLocationQualityContext(point(35.012, 139, '2026-05-23T00:00:30.000Z'), second.context);

  expect(third.acceptedPoints).toHaveLength(3);
});

it('provisional誤軌道から直前accepted近傍へ戻る場合は保留区間を破棄する', () => {
  const accepted = [point(35, 139, '2026-05-23T00:00:00.000Z')];
  const first = advanceLocationQualityContext(point(35.01, 139, '2026-05-23T00:00:10.000Z'), createLocationQualityContext(accepted));
  const returned = advanceLocationQualityContext(point(35.00003, 139, '2026-05-23T00:00:20.000Z'), first.context);

  expect(returned.acceptedPoints).toEqual([]);
  expect(returned.context.provisionalPoints).toEqual([]);
});
```

- [ ] **Step 7: Implement tracker advancement**

```ts
export type LocationQualityAdvance = {
  decision: LocationQualityDecision;
  acceptedPoints: NewLocationPoint[];
  context: LocationQualityContext;
};

const PROVISIONAL_CONFIRMATION_COUNT = 3;
const RETURN_TO_ACCEPTED_RADIUS_METERS = 35;

export function advanceLocationQualityContext(point: NewLocationPoint, context: LocationQualityContext): LocationQualityAdvance {
  const previousAccepted = context.acceptedPoints.at(-1);

  if (
    previousAccepted &&
    context.provisionalPoints.length > 0 &&
    distanceMeters(previousAccepted, point) <= RETURN_TO_ACCEPTED_RADIUS_METERS
  ) {
    return {
      decision: { type: 'rejected', reason: 'jump-suspected' },
      acceptedPoints: [],
      context: createLocationQualityContext(context.acceptedPoints),
    };
  }

  const decision = evaluateLocationPointQuality(point, context);

  if (decision.type === 'accepted') {
    return {
      decision,
      acceptedPoints: [decision.point],
      context: createLocationQualityContext([...context.acceptedPoints, decision.point]),
    };
  }

  if (decision.type === 'rejected') {
    return { decision, acceptedPoints: [], context };
  }

  const provisionalPoints = [...context.provisionalPoints, point];

  if (provisionalPoints.length < PROVISIONAL_CONFIRMATION_COUNT) {
    return { decision, acceptedPoints: [], context: createLocationQualityContext(context.acceptedPoints, provisionalPoints) };
  }

  return {
    decision: { type: 'accepted', point },
    acceptedPoints: provisionalPoints,
    context: createLocationQualityContext([...context.acceptedPoints, ...provisionalPoints]),
  };
}
```

- [ ] **Step 8: Remove the old boolean primary API**

Delete `shouldSaveLocationPoint`, `MovementMode`, and old speed ownership from `src/features/location/locationSaveFilter.ts`. If the file has no remaining public responsibility, delete it and migrate imports/tests to `locationQualityFilter.ts` and `locationSpeed.ts`.

- [ ] **Step 9: Run quality tests**

Run:

```bash
npm run test -- --runInBand src/features/location/__tests__/locationQualityFilter.test.ts src/features/location/__tests__/locationSpeed.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/features/location/locationQualityFilter.ts src/features/location/__tests__/locationQualityFilter.test.ts src/features/location/locationSaveFilter.ts src/features/location/__tests__/locationSaveFilter.test.ts
git commit -m "feat(location): GPS軌跡品質判定を追加"
```

## Task 3: Background Save Integration

**Files:**

- Modify: `src/features/logs/logRepository.ts`
- Modify: `src/features/logs/__tests__/logRepository.test.ts`
- Modify: `src/features/location/backgroundLocationTask.ts`

- [ ] **Step 1: Write a failing recent-points repository test**

```ts
import { getRecentLocationPoints } from '../logRepository';

describe('最近のGPSポイント取得 getRecentLocationPoints', () => {
  it('品質判定の初期窓として古い順に直近点を返す', async () => {
    await insertLocationPoint(point('2026-05-23T00:00:00.000Z', 35, 139));
    await insertLocationPoint(point('2026-05-23T00:00:10.000Z', 35.0001, 139));
    await insertLocationPoint(point('2026-05-23T00:00:20.000Z', 35.0002, 139));

    const recentPoints = await getRecentLocationPoints(2);

    expect(recentPoints.map((item) => item.recordedAt)).toEqual(['2026-05-23T00:00:10.000Z', '2026-05-23T00:00:20.000Z']);
  });
});
```

- [ ] **Step 2: Run the repository test to verify it fails**

Run:

```bash
npm run test -- --runInBand src/features/logs/__tests__/logRepository.test.ts
```

Expected: FAIL because `getRecentLocationPoints` is missing.

- [ ] **Step 3: Implement recent accepted-point lookup**

```ts
/** 保存品質判定を初期化するため、直近GPSポイントを古い順に取得する。 */
export async function getRecentLocationPoints(limit: number): Promise<LocationPoint[]> {
  const points = await db.getAllAsync<LocationPoint>(
    `SELECT ${pointColumns}
     FROM location_points
     ORDER BY recorded_at DESC
     LIMIT ?`,
    limit,
  );

  return points.reverse();
}
```

- [ ] **Step 4: Integrate the quality tracker in the background task**

Replace the old `previousPoint` loop with:

```ts
const acceptedSeed = await getRecentLocationPoints(6);
let qualityContext = createLocationQualityContext(acceptedSeed);
const savedPoints: { point: ReturnType<typeof toLocationPoint>; locationPointId: number }[] = [];

for (const location of locations) {
  const point = toLocationPoint(location);
  const advance = advanceLocationQualityContext(point, qualityContext);
  qualityContext = advance.context;

  for (const acceptedPoint of advance.acceptedPoints) {
    const locationPointId = await insertLocationPoint(acceptedPoint);
    savedPoints.push({ point: acceptedPoint, locationPointId });
  }
}
```

Keep the short pending window across background-task callbacks with a top-level in-memory provisional array:

```ts
let pendingProvisionalPoints: ReturnType<typeof toLocationPoint>[] = [];
```

Seed each batch from recent accepted DB points plus the memory window:

```ts
const acceptedSeed = await getRecentLocationPoints(6);
let qualityContext = createLocationQualityContext(acceptedSeed, pendingProvisionalPoints);
```

After the batch finishes, keep only unresolved provisional points:

```ts
pendingProvisionalPoints = qualityContext.provisionalPoints;
```

Do not persist raw provisional points in this task.

- [ ] **Step 5: Run location and repository tests**

Run:

```bash
npm run test -- --runInBand src/features/location/__tests__/locationQualityFilter.test.ts src/features/logs/__tests__/logRepository.test.ts src/features/location/__tests__/locationService.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/logs/logRepository.ts src/features/logs/__tests__/logRepository.test.ts src/features/location/backgroundLocationTask.ts
git commit -m "feat(location): 品質判定後のGPS点だけ保存"
```

## Task 4: Segmented Route Rendering

**Files:**

- Modify: `src/features/map/routeMapper.ts`
- Modify: `src/features/map/__tests__/routeMapper.test.ts`
- Modify: `src/app/hooks/useMapRouteState.ts`
- Modify: `src/app/hooks/__tests__/useMapRouteState.test.ts`
- Modify: `src/app/components/MapScreen.tsx`
- Modify: `src/app/components/__tests__/MapScreen.test.tsx`

- [ ] **Step 1: Write failing segment tests**

```ts
import { toRenderRouteSegments } from '../routeMapper';

it('異常区間を別RouteSegmentへ分割する', () => {
  const segments = toRenderRouteSegments([
    point(35, 139, '2026-05-23T00:00:00.000Z'),
    point(35.0001, 139, '2026-05-23T00:00:10.000Z'),
    point(35.05, 139, '2026-05-23T00:00:20.000Z'),
  ]);

  expect(segments).toHaveLength(1);
  expect(segments[0].coordinates).toHaveLength(2);
});

it('各RouteSegmentを個別に簡略化する', () => {
  const segments = toRenderRouteSegments(
    [
      point(35, 139, '2026-05-23T00:00:00.000Z'),
      point(35.00001, 139.00001, '2026-05-23T00:00:10.000Z'),
      point(35.001, 139.001, '2026-05-23T00:00:20.000Z'),
    ],
    10,
  );

  expect(segments[0].coordinates).toEqual([
    { latitude: 35, longitude: 139 },
    { latitude: 35.001, longitude: 139.001 },
  ]);
});
```

- [ ] **Step 2: Run route mapper tests to verify they fail**

Run:

```bash
npm run test -- --runInBand src/features/map/__tests__/routeMapper.test.ts
```

Expected: FAIL because `toRenderRouteSegments` does not exist.

- [ ] **Step 3: Add route segment generation**

```ts
import { estimateAcceptedSegmentSpeedMps } from '../location/locationSpeed';

export type RouteSegment = {
  id: string;
  coordinates: RouteCoordinate[];
};

const ROUTE_SEGMENT_MAX_SPEED_MPS = 70;
const ROUTE_SEGMENT_MAX_GAP_MS = 10 * 60 * 1000;

export function toRenderRouteSegments(points: LocationPoint[], toleranceMeters = DEFAULT_ROUTE_SIMPLIFY_TOLERANCE_METERS): RouteSegment[] {
  return splitRoutePoints(points)
    .map((segment, index) => ({
      id: `${segment[0].recordedAt}-${index}`,
      coordinates: simplifyRouteCoordinates(toRouteCoordinates(segment), toleranceMeters),
    }))
    .filter((segment) => segment.coordinates.length > 1);
}

function splitRoutePoints(points: LocationPoint[]): LocationPoint[][] {
  return points.reduce<LocationPoint[][]>((segments, point) => {
    const currentSegment = segments.at(-1);
    const previous = currentSegment?.at(-1);
    const timeGapMs = previous ? Date.parse(point.recordedAt) - Date.parse(previous.recordedAt) : 0;
    const isAbnormal =
      previous != null &&
      (timeGapMs > ROUTE_SEGMENT_MAX_GAP_MS || estimateAcceptedSegmentSpeedMps(previous, point) > ROUTE_SEGMENT_MAX_SPEED_MPS);

    if (!currentSegment || isAbnormal) {
      segments.push([point]);
    } else {
      currentSegment.push(point);
    }

    return segments;
  }, []);
}
```

- [ ] **Step 4: Write failing route state and MapScreen segment tests**

```tsx
test('メインマップは分割済みルートを複数Polylineで描く', () => {
  const renderer = ReactTestRenderer.create(
    <MapScreen
      {...createProps({
        visibleRouteSegments: [
          {
            id: 'a',
            coordinates: [
              { latitude: 35, longitude: 139 },
              { latitude: 35.1, longitude: 139.1 },
            ],
          },
          {
            id: 'b',
            coordinates: [
              { latitude: 36, longitude: 140 },
              { latitude: 36.1, longitude: 140.1 },
            ],
          },
        ],
      })}
    />,
  );

  expect(renderer.root.findAllByType(Polyline)).toHaveLength(2);
});
```

- [ ] **Step 5: Update route state and MapScreen props**

Replace `renderRouteCoordinates` and `visibleRouteCoordinates` route-facing props with segment equivalents:

```ts
const renderRouteSegments = useMemo(() => toRenderRouteSegments(points), [points]);
const visibleRouteSegments = useMemo(
  () => filterRouteSegmentsByRegion(renderRouteSegments, visibleRegion),
  [renderRouteSegments, visibleRegion],
);
```

Render:

```tsx
{
  visibleRouteSegments.map((segment) => (
    <Polyline key={segment.id} coordinates={segment.coordinates} strokeColor={routeLineStyle.color} strokeWidth={routeLineStyle.width} />
  ));
}
```

Render the glow Polyline per segment as well.

- [ ] **Step 6: Run route and map tests**

Run:

```bash
npm run test -- --runInBand src/features/map/__tests__/routeMapper.test.ts src/app/hooks/__tests__/useMapRouteState.test.ts src/app/components/__tests__/MapScreen.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/map/routeMapper.ts src/features/map/__tests__/routeMapper.test.ts src/app/hooks/useMapRouteState.ts src/app/hooks/__tests__/useMapRouteState.test.ts src/app/components/MapScreen.tsx src/app/components/__tests__/MapScreen.test.tsx
git commit -m "feat(map): 異常区間でルート線を分割"
```

## Task 5: Reliable Dashboard Speed

**Files:**

- Create: `src/app/hooks/useReliableCurrentSpeed.ts`
- Create: `src/app/hooks/__tests__/useReliableCurrentSpeed.test.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/app/components/MapBottomDashboard.tsx`
- Modify: `src/app/components/__tests__/MapBottomDashboard.test.tsx`

- [ ] **Step 1: Write failing reliable dashboard speed tests**

```ts
import { calculateReliableCurrentSpeedKmh } from '../useReliableCurrentSpeed';

describe('信頼済み点の現在速度 useReliableCurrentSpeed', () => {
  it('最後のaccepted区間速度をkm/hで返す', () => {
    const speed = calculateReliableCurrentSpeedKmh([
      point(35, 139, '2026-05-23T00:00:00.000Z'),
      point(35.001, 139, '2026-05-23T00:01:00.000Z'),
    ]);

    expect(speed).toBeGreaterThan(4);
    expect(speed).toBeLessThan(8);
  });

  it('点が足りない場合は停止表示にする', () => {
    expect(calculateReliableCurrentSpeedKmh([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run the hook test to verify it fails**

Run:

```bash
npm run test -- --runInBand src/app/hooks/__tests__/useReliableCurrentSpeed.test.ts
```

Expected: FAIL because `useReliableCurrentSpeed` does not exist.

- [ ] **Step 3: Implement accepted-point speed derivation**

```ts
import { useMemo } from 'react';

import { estimateAcceptedSegmentSpeedMps } from '../../features/location/locationSpeed';
import { LocationPoint } from '../../types/gps';

export function calculateReliableCurrentSpeedKmh(points: LocationPoint[]): number {
  const latest = points.at(-1);
  const previous = points.at(-2);

  if (!latest || !previous) {
    return 0;
  }

  return estimateAcceptedSegmentSpeedMps(previous, latest) * 3.6;
}

export function useReliableCurrentSpeed(points: LocationPoint[]): number {
  return useMemo(() => calculateReliableCurrentSpeedKmh(points), [points]);
}
```

- [ ] **Step 4: Remove raw map speed assignment from App**

Replace:

```ts
const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0);
```

with:

```ts
const currentSpeedKmh = useReliableCurrentSpeed(points);
```

Delete:

```ts
const speedMps = (coordinate as typeof coordinate & { speed?: number | null }).speed;
setCurrentSpeedKmh(speedMps != null && speedMps > 0 ? speedMps * 3.6 : 0);
```

- [ ] **Step 5: Write failing speed meter boundary tests**

```ts
test('速度帯を30km/hと150km/hで切り替える', () => {
  expect(getSpeedMeterAppearance(29.9, '#123456').color).toBe('#39d9ff');
  expect(getSpeedMeterAppearance(30, '#123456').color).toBe('#ffb22e');
  expect(getSpeedMeterAppearance(150, '#123456').color).toBe('#ff75f6');
});
```

- [ ] **Step 6: Update speed meter appearance**

Use `classifyMovementSpeed` and shared thresholds:

```ts
const speedBand = classifyMovementSpeed(normalizedSpeed);

if (speedBand === 'fast') {
  return { color: '#ff75f6', progressPercent: Math.min((normalizedSpeed / 400) * 100, 100) };
}

if (speedBand === 'vehicle') {
  return { color: '#ffb22e', progressPercent: Math.min((normalizedSpeed / FAST_SPEED_MIN_KMH) * 100, 100) };
}

if (normalizedSpeed >= 1) {
  return { color: '#39d9ff', progressPercent: Math.min((normalizedSpeed / VEHICLE_SPEED_MIN_KMH) * 100, 100) };
}
```

- [ ] **Step 7: Run App hook and dashboard tests**

Run:

```bash
npm run test -- --runInBand src/app/hooks/__tests__/useReliableCurrentSpeed.test.ts src/app/components/__tests__/MapBottomDashboard.test.tsx src/app/components/__tests__/MapScreen.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/hooks/useReliableCurrentSpeed.ts src/app/hooks/__tests__/useReliableCurrentSpeed.test.ts src/app/App.tsx src/app/components/MapBottomDashboard.tsx src/app/components/__tests__/MapBottomDashboard.test.tsx
git commit -m "feat(map): 信頼済み速度をメーターへ反映"
```

## Task 6: Documentation and Full Verification

**Files:**

- Modify: `docs/data-storage.md`
- Modify: `docs/map-rendering.md`

- [ ] **Step 1: Update storage docs**

In `docs/data-storage.md`, replace the old `shouldSaveLocationPoint`-style movement-mode description with:

```md
保存前には raw GPS 観測を品質判定へ通し、accepted 点だけを `location_points` と日別距離へ反映する。

単発ジャンプ、短い誤軌道区間、停止中ドリフトの疑いがある点は provisional として短期保留し、
点列として信頼できた場合のみ accepted 点へ昇格する。accuracy が粗すぎる点や復帰判定で
ドリフトと判断した点は保存しない。
```

Document the 30 km/h and 150 km/h speed-band thresholds.

- [ ] **Step 2: Update map rendering docs**

In `docs/map-rendering.md`, add:

```md
メインマップのルート線は保存済み accepted 点から RouteSegment を生成し、
時間ギャップや不自然な区間速度がある境界では Polyline を分割する。
簡略化は segment ごとに適用する。
```

Document that dashboard speed comes from accepted-point speed derivation rather than raw map-event speed.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm run typecheck
npm run test -- --runInBand
```

Expected: both commands exit 0.

- [ ] **Step 4: Check final diff and docs scope**

Run:

```bash
git diff --stat
git status --short
```

Expected: only GPS quality, speed, route rendering, tests, and docs changes are present.

- [ ] **Step 5: Commit**

```bash
git add docs/data-storage.md docs/map-rendering.md
git commit -m "docs(gps): 軌跡品質判定仕様を更新"
```

## Plan Self-Review

### Spec coverage

- Quality decisions, single jumps, wrong-track provisional runs, and stationary drift are covered in Task 2.
- Accepted-only persistence is covered in Task 3.
- Render splitting for past and boundary data is covered in Task 4.
- 30 km/h and 150 km/h speed bands plus dashboard speed source changes are covered in Tasks 1 and 5.
- Documentation and verification are covered in Task 6.

### Explicit trade-offs

- Raw GPS observations are not persisted in this implementation.
- Provisional state starts as a short in-memory window seeded by recent accepted DB points.
- The first implementation protects short suspicious runs; long natural-looking OS misroutes remain a documented limit.
