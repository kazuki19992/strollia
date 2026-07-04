# GPS Stationary Drift Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen GPS quality filtering so stationary drift and short unreliable provisional tracks are not saved to SQLite.

**Architecture:** Keep the PR #9 accepted/provisional/rejected pipeline and make provisional promotion quality-based instead of count-only. Add pure helpers inside `locationQualityFilter.ts` for stationary escape and provisional track quality, then keep `backgroundLocationTask.ts` unchanged because it already saves only accepted points.

**Tech Stack:** React Native + Expo, TypeScript, Jest, SQLite repository layer.

---

## File Structure

- Modify: `src/features/location/locationQualityFilter.ts`
  - Add stationary escape quality constants.
  - Add pure track-quality helpers.
  - Change provisional promotion so suspicious tracks remain in memory until quality checks pass.
- Modify: `src/features/location/__tests__/locationQualityFilter.test.ts`
  - Add behavior tests for stationary drift, stationary escape, unstable provisional tracks, and low-accuracy provisional tracks.
- Modify: `docs/data-storage.md`
  - Document that stationary lock and quality-based provisional promotion are part of save-time filtering.
- Modify: `docs/map-rendering.md`
  - Clarify that route segment splitting is a rendering safety net, not the primary drift filter.

## Task 1: Stationary Drift Does Not Promote By Count Alone

**Files:**

- Modify: `src/features/location/__tests__/locationQualityFilter.test.ts`
- Modify: `src/features/location/locationQualityFilter.ts`

- [ ] **Step 1: Write the failing stationary drift promotion test**

Add this test to `src/features/location/__tests__/locationQualityFilter.test.ts` inside `describe('GPS軌跡品質判定 locationQualityFilter', ...)`:

```ts
it('停止中に別位置へ3点だけドリフトしてもacceptedへ昇格しない', () => {
  const stationary = [
    point(35, 139, '2026-05-23T00:00:00.000Z'),
    point(35.00002, 139, '2026-05-23T00:00:20.000Z'),
    point(35.00001, 139.00001, '2026-05-23T00:00:40.000Z'),
  ];
  const first = advanceLocationQualityContext(point(35.00035, 139, '2026-05-23T00:01:00.000Z'), createLocationQualityContext(stationary));
  const second = advanceLocationQualityContext(point(35.00036, 139.00001, '2026-05-23T00:01:20.000Z'), first.context);
  const third = advanceLocationQualityContext(point(35.00035, 139.00002, '2026-05-23T00:01:40.000Z'), second.context);

  expect(third.acceptedPoints).toEqual([]);
  expect(third.context.provisionalPoints).toHaveLength(3);
});
```

- [ ] **Step 2: Verify the test fails**

Run:

```bash
npm run test -- --runInBand src/features/location/__tests__/locationQualityFilter.test.ts
```

Expected: FAIL because the current count-only provisional promotion accepts 3 provisional points.

- [ ] **Step 3: Add stationary escape quality gates**

In `src/features/location/locationQualityFilter.ts`, add constants near existing quality constants:

```ts
/** 停止クラスタ離脱をacceptedに昇格するまでに必要な保留点数。 */
const STATIONARY_ESCAPE_CONFIRMATION_COUNT = 4;
/** 停止クラスタから十分に離脱したとみなす距離。 */
const STATIONARY_ESCAPE_MIN_ANCHOR_DISTANCE_METERS = 40;
/** 停止クラスタ離脱として扱うために必要な保留点列の移動量。 */
const STATIONARY_ESCAPE_MIN_PATH_LENGTH_METERS = 30;
```

Add these helper functions below `confirmProvisionalTrack`:

```ts
/** 保留点列が停止クラスタから十分に離脱した実移動らしいか判定する。 */
function isReliableStationaryEscapeTrack(anchor: NewLocationPoint, provisionalPoints: NewLocationPoint[]): boolean {
  const latest = provisionalPoints.at(-1);

  if (!latest || provisionalPoints.length < STATIONARY_ESCAPE_CONFIRMATION_COUNT) {
    return false;
  }

  return (
    distanceMeters(anchor, latest) >= STATIONARY_ESCAPE_MIN_ANCHOR_DISTANCE_METERS &&
    totalPathDistanceMeters(provisionalPoints) >= STATIONARY_ESCAPE_MIN_PATH_LENGTH_METERS
  );
}

/** 点列内の隣接点距離を合計する。 */
function totalPathDistanceMeters(points: NewLocationPoint[]): number {
  return points.reduce((total, point, index) => {
    const previous = points[index - 1];
    return previous ? total + distanceMeters(previous, point) : total;
  }, 0);
}
```

Change the beginning of `confirmProvisionalTrack`:

```ts
const provisionalPoints = [...context.provisionalPoints, point];
const anchor = context.acceptedPoints.at(-1);

if (anchor && isStationaryCluster(context.acceptedPoints) && !isReliableStationaryEscapeTrack(anchor, provisionalPoints)) {
  return {
    decision,
    acceptedPoints: [],
    context: createLocationQualityContext(context.acceptedPoints, provisionalPoints),
  };
}
```

Keep the existing count-only promotion path after this block for non-stationary provisional tracks.

- [ ] **Step 4: Verify the test passes**

Run:

```bash
npm run test -- --runInBand src/features/location/__tests__/locationQualityFilter.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/location/locationQualityFilter.ts src/features/location/__tests__/locationQualityFilter.test.ts
git commit -m "fix(location): 停止中ドリフトの昇格を抑制"
```

## Task 2: Reliable Stationary Escape Still Saves Real Movement

**Files:**

- Modify: `src/features/location/__tests__/locationQualityFilter.test.ts`
- Modify: `src/features/location/locationQualityFilter.ts`

- [ ] **Step 1: Write the failing stationary escape acceptance test**

Add this test:

```ts
it('停止中に一方向へ自然に離脱した点列はacceptedへ昇格する', () => {
  const stationary = [
    point(35, 139, '2026-05-23T00:00:00.000Z'),
    point(35.00002, 139, '2026-05-23T00:00:20.000Z'),
    point(35.00001, 139.00001, '2026-05-23T00:00:40.000Z'),
  ];
  const first = advanceLocationQualityContext(point(35.00028, 139, '2026-05-23T00:01:00.000Z'), createLocationQualityContext(stationary));
  const second = advanceLocationQualityContext(point(35.00042, 139, '2026-05-23T00:01:20.000Z'), first.context);
  const third = advanceLocationQualityContext(point(35.00056, 139, '2026-05-23T00:01:40.000Z'), second.context);
  const fourth = advanceLocationQualityContext(point(35.0007, 139, '2026-05-23T00:02:00.000Z'), third.context);

  expect(fourth.acceptedPoints).toHaveLength(4);
  expect(fourth.context.provisionalPoints).toEqual([]);
});
```

- [ ] **Step 2: Verify the test fails if Task 1 is too strict**

Run:

```bash
npm run test -- --runInBand src/features/location/__tests__/locationQualityFilter.test.ts
```

Expected: PASS if Task 1 helper already covers this; if FAIL, continue Step 3.

- [ ] **Step 3: Adjust stationary escape path distance only if needed**

If the test fails because path length is too low, reduce `STATIONARY_ESCAPE_MIN_PATH_LENGTH_METERS` to `25`. Do not relax anchor distance below `40`.

- [ ] **Step 4: Verify the test passes**

Run:

```bash
npm run test -- --runInBand src/features/location/__tests__/locationQualityFilter.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Only commit if Step 3 changed production code or Step 1 added a new test not committed in Task 1:

```bash
git add src/features/location/locationQualityFilter.ts src/features/location/__tests__/locationQualityFilter.test.ts
git commit -m "test(location): 停止離脱の保存条件を固定"
```

## Task 3: Provisional Track Quality Uses Accuracy And Speed Stability

**Files:**

- Modify: `src/features/location/__tests__/locationQualityFilter.test.ts`
- Modify: `src/features/location/locationQualityFilter.ts`

- [ ] **Step 1: Write failing low-accuracy provisional test**

Add this test:

```ts
it('accuracyが悪いprovisional点列はacceptedへ昇格しない', () => {
  const accepted = [point(35, 139, '2026-05-23T00:00:00.000Z')];
  const first = advanceLocationQualityContext(
    point(35.01, 139, '2026-05-23T00:00:10.000Z', { accuracy: 45 }),
    createLocationQualityContext(accepted),
  );
  const second = advanceLocationQualityContext(point(35.011, 139, '2026-05-23T00:00:20.000Z', { accuracy: 45 }), first.context);
  const third = advanceLocationQualityContext(point(35.012, 139, '2026-05-23T00:00:30.000Z', { accuracy: 45 }), second.context);

  expect(third.acceptedPoints).toEqual([]);
  expect(third.context.provisionalPoints).toHaveLength(3);
});
```

- [ ] **Step 2: Write failing unstable-speed provisional test**

Add this test:

```ts
it('区間速度が大きくばらつくprovisional点列はacceptedへ昇格しない', () => {
  const accepted = [point(35, 139, '2026-05-23T00:00:00.000Z')];
  const first = advanceLocationQualityContext(point(35.01, 139, '2026-05-23T00:00:10.000Z'), createLocationQualityContext(accepted));
  const second = advanceLocationQualityContext(point(35.01005, 139, '2026-05-23T00:00:20.000Z'), first.context);
  const third = advanceLocationQualityContext(point(35.02, 139, '2026-05-23T00:00:30.000Z'), second.context);

  expect(third.acceptedPoints).toEqual([]);
  expect(third.context.provisionalPoints).toHaveLength(3);
});
```

- [ ] **Step 3: Verify both tests fail**

Run:

```bash
npm run test -- --runInBand src/features/location/__tests__/locationQualityFilter.test.ts
```

Expected: FAIL because current non-stationary provisional promotion is count-only.

- [ ] **Step 4: Add provisional quality helpers**

In `src/features/location/locationQualityFilter.ts`, add constants near other quality constants:

```ts
/** provisional点列をacceptedへ昇格する最大平均accuracy。 */
const PROVISIONAL_MAX_AVERAGE_ACCURACY_METERS = 35;
/** provisional点列の区間速度ばらつき許容倍率。 */
const PROVISIONAL_MAX_SPEED_RATIO = 4;
```

Add helper functions below `isReliableStationaryEscapeTrack`:

```ts
/** 保留点列が通常の新しい軌道として十分信頼できるか判定する。 */
function isReliableProvisionalTrack(points: NewLocationPoint[]): boolean {
  return hasGoodAverageAccuracy(points) && hasStableSegmentSpeeds(points);
}

/** 点列の平均accuracyが保存に十分か判定する。 */
function hasGoodAverageAccuracy(points: NewLocationPoint[]): boolean {
  const averageAccuracy =
    points.reduce((total, point) => total + (point.accuracy ?? ABSOLUTE_MAX_ACCURACY_METERS), 0) / Math.max(points.length, 1);

  return averageAccuracy <= PROVISIONAL_MAX_AVERAGE_ACCURACY_METERS;
}

/** 点列内の区間速度が極端にばらつかないか判定する。 */
function hasStableSegmentSpeeds(points: NewLocationPoint[]): boolean {
  const speeds = points
    .slice(1)
    .map((point, index) => estimateAcceptedSegmentSpeedMps(points[index], point))
    .filter((speed) => speed > 0);

  if (speeds.length < 2) {
    return true;
  }

  const minSpeed = Math.min(...speeds);
  const maxSpeed = Math.max(...speeds);

  return maxSpeed / minSpeed <= PROVISIONAL_MAX_SPEED_RATIO;
}
```

Change the count promotion block in `confirmProvisionalTrack`:

```ts
if (provisionalPoints.length < PROVISIONAL_CONFIRMATION_COUNT || !isReliableProvisionalTrack(provisionalPoints)) {
  return {
    decision,
    acceptedPoints: [],
    context: createLocationQualityContext(context.acceptedPoints, provisionalPoints),
  };
}
```

- [ ] **Step 5: Verify tests pass**

Run:

```bash
npm run test -- --runInBand src/features/location/__tests__/locationQualityFilter.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/location/locationQualityFilter.ts src/features/location/__tests__/locationQualityFilter.test.ts
git commit -m "fix(location): 保留軌道の昇格条件を強化"
```

## Task 4: Documentation Update

**Files:**

- Modify: `docs/data-storage.md`
- Modify: `docs/map-rendering.md`

- [ ] **Step 1: Update storage docs**

In `docs/data-storage.md`, update the GPS save filtering section to include:

```md
停止クラスタから離れた観測は即保存せず、stationary escape として通常より厳しい provisional 判定へ回す。点数だけでは accepted へ昇格せず、anchor からの離脱距離、点列の移動量、accuracy、区間速度の安定性を確認する。
```

- [ ] **Step 2: Update map rendering docs**

In `docs/map-rendering.md`, update the route segment section to include:

```md
保存前品質判定で落としきれなかった境界ケースや過去データに備え、描画時の `RouteSegment` 分割は保険として残す。通常は保存済み accepted 点だけで安定した軌跡を再現する。
```

- [ ] **Step 3: Commit docs**

```bash
git add docs/data-storage.md docs/map-rendering.md
git commit -m "docs(gps): 停止ドリフト抑制仕様を更新"
```

## Task 5: Full Verification

**Files:**

- No file changes expected.

- [ ] **Step 1: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 2: Run all tests**

Run:

```bash
npm run test -- --runInBand
```

Expected: all test suites pass.

- [ ] **Step 3: Inspect final diff**

Run:

```bash
git status -sb
git log --oneline main..HEAD
```

Expected: only stationary drift quality changes, tests, docs, and the design/plan commits are present.
