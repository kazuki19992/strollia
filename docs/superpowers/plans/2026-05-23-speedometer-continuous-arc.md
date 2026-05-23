# Speedometer Continuous Arc Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the speedometer's short tick marks with a continuous SVG arc whose progress is scaled by the current movement speed band.

**Architecture:** Keep the speed band classification in `features/location/locationSpeed.ts` as the shared source of truth. Put the speedometer presentation calculations in `MapBottomDashboard.tsx` as exported pure helpers, then have `SpeedDial` render a single SVG `Circle` arc over the existing ring base.

**Tech Stack:** React Native, Expo, TypeScript, Jest, react-test-renderer, `react-native-svg`.

---

## File Structure

- Modify `src/app/components/MapBottomDashboard.tsx`
  - Remove segmented arc helper/types.
  - Add continuous arc constants and helper.
  - Render SVG `Circle` for the active arc.
- Modify `src/app/appStyles.ts`
  - Remove segmented tick styles.
  - Add SVG arc overlay style.
- Modify `src/app/components/__tests__/MapBottomDashboard.test.tsx`
  - Add tests for band-scaled progress and SVG dash values.
  - Update `react-native-svg` mock to expose `Circle`.
- Modify `docs/map-rendering.md`
  - Document continuous arc rendering and per-band full-circle speeds.

---

### Task 1: Speed Meter Calculation Tests

**Files:**
- Modify: `src/app/components/__tests__/MapBottomDashboard.test.tsx`
- Modify: `src/app/components/MapBottomDashboard.tsx`

- [ ] **Step 1: Write the failing tests**

Add imports:

```ts
import {
  getSpeedMeterAppearance,
  getSpeedMeterArcStroke,
  MapBottomDashboard,
  METER_CLUSTER_BACKGROUND_PATH,
  SPEED_METER_ARC_CIRCUMFERENCE,
} from '../MapBottomDashboard';
```

Add tests:

```ts
test('速度帯ごとの完全円速度で進捗を計算する', () => {
  expect(getSpeedMeterAppearance(15, '#123456').progressPercent).toBe(50);
  expect(getSpeedMeterAppearance(29.9, '#123456').progressPercent).toBeCloseTo(99.67);
  expect(getSpeedMeterAppearance(30, '#123456').progressPercent).toBe(20);
  expect(getSpeedMeterAppearance(100, '#123456').progressPercent).toBeCloseTo(66.67);
  expect(getSpeedMeterAppearance(150, '#123456').progressPercent).toBe(37.5);
  expect(getSpeedMeterAppearance(400, '#123456').progressPercent).toBe(100);
  expect(getSpeedMeterAppearance(500, '#123456').progressPercent).toBe(100);
});

test('連続円弧のdash値を0〜100%に丸めて計算する', () => {
  expect(getSpeedMeterArcStroke(0)).toEqual({
    strokeDasharray: SPEED_METER_ARC_CIRCUMFERENCE,
    strokeDashoffset: SPEED_METER_ARC_CIRCUMFERENCE,
  });
  expect(getSpeedMeterArcStroke(50).strokeDashoffset).toBeCloseTo(SPEED_METER_ARC_CIRCUMFERENCE / 2);
  expect(getSpeedMeterArcStroke(100).strokeDashoffset).toBe(0);
  expect(getSpeedMeterArcStroke(150).strokeDashoffset).toBe(0);
  expect(getSpeedMeterArcStroke(-20).strokeDashoffset).toBe(SPEED_METER_ARC_CIRCUMFERENCE);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
npm run test -- src/app/components/__tests__/MapBottomDashboard.test.tsx --runInBand
```

Expected: FAIL because `getSpeedMeterArcStroke` and `SPEED_METER_ARC_CIRCUMFERENCE` do not exist.

- [ ] **Step 3: Add minimal calculation implementation**

In `src/app/components/MapBottomDashboard.tsx`, replace `getSpeedMeterArcSegments` with:

```ts
/** スピードメーター円弧の半径。SVG viewBox内の単位。 */
export const SPEED_METER_ARC_RADIUS = 43;

/** スピードメーター円弧の円周。 */
export const SPEED_METER_ARC_CIRCUMFERENCE = 2 * Math.PI * SPEED_METER_ARC_RADIUS;

/** 連続円弧の描画に使うdash値。 */
export type SpeedMeterArcStroke = {
  /** 表示対象円周長。 */
  strokeDasharray: number;
  /** 現在進捗に応じて隠す円周長。 */
  strokeDashoffset: number;
};

/**
 * 速度ゲージ進捗からSVG円弧のdash値を作る。
 *
 * @param progressPercent - 速度帯の上限に対する0〜100の進捗。
 * @returns SVG Circleに渡すdash値。
 */
export function getSpeedMeterArcStroke(progressPercent: number): SpeedMeterArcStroke {
  const clampedProgress = Math.min(Math.max(progressPercent, 0), 100);

  return {
    strokeDasharray: SPEED_METER_ARC_CIRCUMFERENCE,
    strokeDashoffset: SPEED_METER_ARC_CIRCUMFERENCE * (1 - clampedProgress / 100),
  };
}
```

Update `getSpeedMeterAppearance` so the low-speed, vehicle, and fast progress use `30`, `150`, and `400` respectively, clamped to 100.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
npm run test -- src/app/components/__tests__/MapBottomDashboard.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/MapBottomDashboard.tsx src/app/components/__tests__/MapBottomDashboard.test.tsx
git commit -m "test(map): 速度メーター円弧計算を追加"
```

---

### Task 2: Continuous SVG Arc Rendering

**Files:**
- Modify: `src/app/components/MapBottomDashboard.tsx`
- Modify: `src/app/appStyles.ts`
- Modify: `src/app/components/__tests__/MapBottomDashboard.test.tsx`

- [ ] **Step 1: Write the failing render test**

Update the `react-native-svg` mock:

```ts
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: View,
    Circle: View,
    Path: View,
  };
});
```

Add:

```ts
test('速度リングを連続円弧で描画する', () => {
  let renderer: any;

  act(() => {
    renderer = ReactTestRenderer.create(<MapBottomDashboard {...createProps()} currentSpeedKmh={15} />);
  });

  const arc = renderer.root.find((node: any) => node.props.testID === 'speed-meter-progress-arc');
  expect(arc.props.stroke).toBe('#39d9ff');
  expect(arc.props.strokeDashoffset).toBeCloseTo(SPEED_METER_ARC_CIRCUMFERENCE / 2);
});
```

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
npm run test -- src/app/components/__tests__/MapBottomDashboard.test.tsx --runInBand
```

Expected: FAIL because no node has `testID="speed-meter-progress-arc"`.

- [ ] **Step 3: Implement SVG arc rendering**

In `MapBottomDashboard.tsx`:

- Import `Circle` from `react-native-svg`.
- Remove `speedArcSegments`.
- Pass `progressPercent` to `SpeedDial`.
- Change `SpeedDial` props to receive `progressPercent`.
- Render an SVG overlay:

```tsx
<Svg accessibilityElementsHidden focusable={false} pointerEvents="none" style={styles.speedDashboardArcSvg} viewBox="0 0 104 104">
  {progressPercent > 0 && (
    <Circle
      cx="52"
      cy="52"
      fill="none"
      r={SPEED_METER_ARC_RADIUS}
      rotation="-90"
      originX="52"
      originY="52"
      stroke={speedColor}
      strokeDasharray={arcStroke.strokeDasharray}
      strokeDashoffset={arcStroke.strokeDashoffset}
      strokeLinecap="round"
      strokeWidth="5"
      testID="speed-meter-progress-arc"
    />
  )}
</Svg>
```

In `appStyles.ts`, replace tick styles with:

```ts
speedDashboardArcSvg: {
  height: 104,
  position: 'absolute',
  width: 104,
},
```

- [ ] **Step 4: Run test and verify GREEN**

Run:

```bash
npm run test -- src/app/components/__tests__/MapBottomDashboard.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/MapBottomDashboard.tsx src/app/appStyles.ts src/app/components/__tests__/MapBottomDashboard.test.tsx
git commit -m "feat(map): 速度メーターを連続円弧で描画する"
```

---

### Task 3: Documentation And Full Verification

**Files:**
- Modify: `docs/map-rendering.md`

- [ ] **Step 1: Update documentation**

In `docs/map-rendering.md`, update the speed ring bullet to state:

```md
- 速度リングは12時方向を0km/hとする連続円弧で描画し、低速は30km/h、車相当は150km/h、高速移動は400km/hで完全円にする。400km/h以上は完全円のまま表示する
```

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run typecheck
npm run test -- --runInBand
```

Expected: both PASS.

- [ ] **Step 3: Commit**

```bash
git add docs/map-rendering.md
git commit -m "docs(map): 速度メーター円弧仕様を更新"
```
