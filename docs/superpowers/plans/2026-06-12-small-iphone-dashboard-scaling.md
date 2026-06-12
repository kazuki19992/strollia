# Small iPhone Dashboard Scaling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 小さい iPhone のマップ下部ダッシュボードで、背景 SVG とスピードメーター、現在地名、テキストサイズを同じ倍率で縮小して表示崩れを防ぐ。

**Architecture:** `MapBottomDashboard` に画面幅から倍率を返す純粋関数を追加し、`useWindowDimensions()` で実画面幅へ適用する。既存の `appStyles` は大画面の基準値として残し、小画面だけ inline style で寸法とフォントサイズを縮小する。

**Tech Stack:** React Native, TypeScript, Jest, react-test-renderer

---

### Task 1: 小画面用倍率とメーター寸法を追加する

**Files:**
- Modify: `src/app/components/MapBottomDashboard.tsx`
- Test: `src/app/components/__tests__/MapBottomDashboard.test.tsx`

- [ ] **Step 1: Write the failing test**

`MapBottomDashboard.test.tsx` に以下を追加する。

```tsx
import {
  getDashboardScale,
  getScaledSpeedDialLayout,
  SMALL_DASHBOARD_MIN_SCALE,
} from '../MapBottomDashboard';

test('大きい画面ではダッシュボード倍率を1に保つ', () => {
  expect(getDashboardScale(430)).toBe(1);
  expect(getDashboardScale(460)).toBe(1);
});

test('小さい画面ではダッシュボード倍率を下限まで縮小する', () => {
  expect(getDashboardScale(393)).toBeLessThan(1);
  expect(getDashboardScale(320)).toBe(SMALL_DASHBOARD_MIN_SCALE);
});

test('小さい画面の速度メーターはリングとSVGを同じ寸法に縮小する', () => {
  const scale = getDashboardScale(375);
  const layout = getScaledSpeedDialLayout(scale);

  expect(layout.dial.width).toBe(layout.arcSvg.width);
  expect(layout.dial.height).toBe(layout.arcSvg.height);
  expect(layout.ringBase.width).toBeCloseTo(100 * scale);
  expect(layout.ringBase.height).toBeCloseTo(100 * scale);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/app/components/__tests__/MapBottomDashboard.test.tsx`

Expected: FAIL because `getDashboardScale`, `getScaledSpeedDialLayout`, and `SMALL_DASHBOARD_MIN_SCALE` are not exported.

- [ ] **Step 3: Write minimal implementation**

`MapBottomDashboard.tsx` に以下の constants と functions を追加する。

```ts
export const SMALL_DASHBOARD_BASE_WIDTH = 430;
export const SMALL_DASHBOARD_MIN_SCALE = 0.86;

export function getDashboardScale(width: number): number {
  if (!Number.isFinite(width) || width <= 0) {
    return 1;
  }

  return Math.max(SMALL_DASHBOARD_MIN_SCALE, Math.min(width / SMALL_DASHBOARD_BASE_WIDTH, 1));
}

function scaleNumber(value: number, scale: number): number {
  return Math.round(value * scale * 100) / 100;
}

export function getScaledSpeedDialLayout(scale: number) {
  return {
    dial: { width: scaleNumber(104, scale), height: scaleNumber(104, scale), left: scaleNumber(2, scale) },
    arcSvg: { width: scaleNumber(104, scale), height: scaleNumber(104, scale) },
    ringBase: { width: scaleNumber(100, scale), height: scaleNumber(100, scale), borderWidth: scaleNumber(7, scale) },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/app/components/__tests__/MapBottomDashboard.test.tsx`

Expected: PASS for the new pure function tests.

### Task 2: 小画面倍率をレンダリングへ適用する

**Files:**
- Modify: `src/app/components/MapBottomDashboard.tsx`
- Test: `src/app/components/__tests__/MapBottomDashboard.test.tsx`

- [ ] **Step 1: Write the failing test**

`react-native` mock の `useWindowDimensions` を `jest.spyOn` できるようにし、以下を追加する。

```tsx
import * as ReactNative from 'react-native';

test('小さい画面では現在地名に縮小許可を付けて描画する', () => {
  jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 375, height: 667, scale: 2, fontScale: 1 });

  let renderer: any;
  act(() => {
    renderer = ReactTestRenderer.create(
      <MapBottomDashboard {...createProps()} currentAreaLabel={{ primary: 'つくばみらい市', secondary: null }} />,
    );
  });

  const place = renderer.root.findAllByType(Text).find((node: any) => node.props.children === 'つくばみらい市');

  expect(place.props.adjustsFontSizeToFit).toBe(true);
  expect(place.props.minimumFontScale).toBeLessThan(1);
  expect(place.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ fontSize: expect.any(Number) })]));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/app/components/__tests__/MapBottomDashboard.test.tsx`

Expected: FAIL because `useWindowDimensions` is not used and the current place `Text` has no shrink props.

- [ ] **Step 3: Write minimal implementation**

`MapBottomDashboard.tsx` で `useWindowDimensions` を import し、component 内で `const dashboardScale = getDashboardScale(useWindowDimensions().width);` を作る。`SpeedDial`、`DashboardDistanceMetric`、現在地名、`DashboardAction`、マップボタンへ倍率を渡し、以下のような inline style を追加する。

```tsx
<Text
  {...FIXED_MAP_UI_TEXT_PROPS}
  adjustsFontSizeToFit
  minimumFontScale={dashboardScale < 1 ? 0.72 : 0.9}
  numberOfLines={1}
  style={[styles.dashboardPlacePrimary, getScaledTextStyle(13, 16, dashboardScale)]}
>
  {currentAreaLabel.primary}
</Text>
```

寸法は `getScaledSpeedDialLayout()` と `getScaledTextStyle()` の戻り値を使い、`dashboardScale === 1` でも同じ数値を返すだけにする。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/app/components/__tests__/MapBottomDashboard.test.tsx`

Expected: PASS.

### Task 3: 関連検証とコミット

**Files:**
- Modify: `src/app/components/MapBottomDashboard.tsx`
- Modify: `src/app/components/__tests__/MapBottomDashboard.test.tsx`

- [ ] **Step 1: Run focused tests**

Run: `npm test -- --runInBand src/app/components/__tests__/MapBottomDashboard.test.tsx src/app/components/__tests__/MapScreen.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run type check**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/MapBottomDashboard.tsx src/app/components/__tests__/MapBottomDashboard.test.tsx docs/superpowers/plans/2026-06-12-small-iphone-dashboard-scaling.md
git commit -m "fix(map): 小画面の下部ダッシュボード表示を調整"
```
