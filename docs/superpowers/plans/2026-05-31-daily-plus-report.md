# Daily Plus Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Plus-gated daily detail report to the existing daily log cards, using local GPS, visited area, and achievement data.

**Architecture:** Keep calculation logic in `src/features/reports/dailyReport.ts`, DB access in existing feature repositories, and UI composition in `DailyLogCard`. The daily log list remains free; Plus only unlocks additional daily detail rows. User-facing copy says "エリア" while internal visited cell names remain unchanged.

**Tech Stack:** Expo React Native, TypeScript, Jest, expo-sqlite, RevenueCat-backed `PremiumAccessState`.

---

## File Structure

- Create `src/features/reports/dailyReport.ts`
  - Pure daily detail report types and aggregation logic.
  - Converts daily GPS points into unique area counts.
  - Counts newly visited areas from visited cell first-visit dates.
- Create `src/features/reports/__tests__/dailyReport.test.ts`
  - Japanese test descriptions for daily report aggregation.
- Modify `src/features/location/visitedCellRepository.ts`
  - Add `getVisitedCellsByIds(cellIds: string[])`.
  - Used to resolve first-visited timestamps for the day's cells.
- Modify `src/features/location/__tests__/visitedCellRepository.test.ts`
  - Add SQL parameter and empty-input tests for `getVisitedCellsByIds`.
- Modify `src/features/achievements/achievementRepository.ts`
  - Add `getAchievementUnlocksByDate(localDate: string)`.
  - Return definitions for achievements unlocked on that local date.
- Modify `src/features/achievements/__tests__/achievementRepository.test.ts`
  - Add tests for date-filtered unlock retrieval.
- Modify `src/app/components/DailyLogCard.tsx`
  - Accept `isPlusActive` and `onPresentPremiumPaywall`.
  - Load daily detail data after daily points are loaded.
  - Render locked Plus detail preview when Plus is inactive.
  - Render daily detail rows when Plus is active.
- Modify `src/app/components/DailyLogsScreen.tsx`
  - Pass Plus state and Paywall handler into each card.
- Modify `src/app/App.tsx`
  - Pass `premiumAccessState.isPlusActive` and Paywall opener into `DailyLogsScreen`.
- Modify `src/app/appStyles.ts`
  - Add styles for daily detail rows and Plus locked panel.
- Modify `src/app/components/__tests__/DailyLogsScreen.test.tsx`
  - Assert Plus props flow to `DailyLogCard`.
- Create or modify `src/app/components/__tests__/DailyLogCard.test.tsx`
  - Assert locked state, Plus state, and Paywall press behavior.
- Modify `docs/plus-features.md`, `docs/todo.md`
  - Mark implementation done if all code tasks are completed in this branch.

## Task 1: Pure Daily Report Aggregation

**Files:**
- Create: `src/features/reports/dailyReport.ts`
- Create: `src/features/reports/__tests__/dailyReport.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/features/reports/__tests__/dailyReport.test.ts`:

```ts
import { coordinateToGridCell } from '../../location/grid/gridCell';
import { createDailyDetailReport } from '../dailyReport';

const basePoint = {
  id: 1,
  recordedAt: '2026-05-31T00:00:00.000Z',
  localDate: '2026-05-31',
  latitude: 35.681236,
  longitude: 139.767125,
  altitude: null,
  speed: null,
  heading: null,
  accuracy: 10,
  altitudeAccuracy: null,
};

describe('日別詳細レポート createDailyDetailReport', () => {
  it('同じエリアに複数ポイントがあっても訪問エリア数は重複しない', () => {
    const firstCell = coordinateToGridCell(basePoint);
    const secondPoint = { ...basePoint, id: 2, recordedAt: '2026-05-31T00:05:00.000Z', latitude: 35.6825 };
    const secondCell = coordinateToGridCell(secondPoint);

    const report = createDailyDetailReport({
      localDate: '2026-05-31',
      points: [basePoint, { ...basePoint, id: 3 }, secondPoint],
      visitedCells: [
        { ...firstCell, firstVisitedAt: '2026-05-30T23:00:00.000Z' },
        { ...secondCell, firstVisitedAt: '2026-05-31T00:05:00.000Z' },
      ],
      unlockedAchievements: [],
    });

    expect(report.visitedAreaCount).toBe(2);
    expect(report.newAreaCount).toBe(1);
    expect(report.pointCount).toBe(3);
  });

  it('その日に解除した実績を表示用に保持する', () => {
    const report = createDailyDetailReport({
      localDate: '2026-05-31',
      points: [basePoint],
      visitedCells: [{ ...coordinateToGridCell(basePoint), firstVisitedAt: '2026-05-31T00:00:00.000Z' }],
      unlockedAchievements: [
        {
          id: 'distance-100',
          title: '100km移動した',
          unlockedAt: '2026-05-31T09:00:00.000Z',
        },
      ],
    });

    expect(report.unlockedAchievements).toEqual([
      {
        id: 'distance-100',
        title: '100km移動した',
        unlockedAt: '2026-05-31T09:00:00.000Z',
      },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/features/reports/__tests__/dailyReport.test.ts --runInBand
```

Expected: FAIL because `../dailyReport` does not exist.

- [ ] **Step 3: Implement pure aggregation**

Create `src/features/reports/dailyReport.ts`:

```ts
import { coordinateToGridCell } from '../location/grid/gridCell';
import type { GridCell } from '../location/grid/gridCell';
import type { LocationPoint } from '../../types/gps';
import { toLocalDate } from '../../utils/date';

/** 日別詳細レポートに表示する解除済み実績。 */
export type DailyDetailAchievement = {
  /** 実績ID。 */
  id: string;
  /** 実績タイトル。 */
  title: string;
  /** 解除日時。 */
  unlockedAt: string;
};

/** 日別詳細レポートの集計入力。 */
export type DailyDetailReportInput = {
  /** 対象日。YYYY-MM-DD。 */
  localDate: string;
  /** 対象日のGPSポイント。 */
  points: LocationPoint[];
  /** 対象日のGPSポイントから導いたエリアの保存状態。 */
  visitedCells: Array<GridCell & { firstVisitedAt?: string | null }>;
  /** 対象日に解除された実績。 */
  unlockedAchievements: DailyDetailAchievement[];
};

/** Plus向け日別詳細レポート。 */
export type DailyDetailReport = {
  /** 対象日。YYYY-MM-DD。 */
  localDate: string;
  /** その日に訪問した重複なしエリア数。 */
  visitedAreaCount: number;
  /** その日に初めて訪問したエリア数。 */
  newAreaCount: number;
  /** 対象日のGPS点数。 */
  pointCount: number;
  /** その日に解除された実績。 */
  unlockedAchievements: DailyDetailAchievement[];
};

/** 1日のGPSポイントと保存済みエリア状態からPlus向け日別詳細レポートを作る。 */
export function createDailyDetailReport(input: DailyDetailReportInput): DailyDetailReport {
  const pointCellIds = new Set(input.points.map((point) => coordinateToGridCell(point).cellId));
  const newAreaCount = input.visitedCells.filter((cell) => {
    if (!pointCellIds.has(cell.cellId) || !cell.firstVisitedAt) {
      return false;
    }
    return toLocalDate(new Date(cell.firstVisitedAt)) === input.localDate;
  }).length;

  return {
    localDate: input.localDate,
    visitedAreaCount: pointCellIds.size,
    newAreaCount,
    pointCount: input.points.length,
    unlockedAchievements: input.unlockedAchievements,
  };
}
```

- [ ] **Step 4: Run test to verify pass**

Run:

```bash
npm test -- src/features/reports/__tests__/dailyReport.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/reports/dailyReport.ts src/features/reports/__tests__/dailyReport.test.ts
git commit -m "feat(reports): 日別詳細レポート集計を追加"
```

## Task 2: Repository Queries for Daily Detail Data

**Files:**
- Modify: `src/features/location/visitedCellRepository.ts`
- Modify: `src/features/location/__tests__/visitedCellRepository.test.ts`
- Modify: `src/features/achievements/achievementRepository.ts`
- Modify: `src/features/achievements/__tests__/achievementRepository.test.ts`

- [ ] **Step 1: Write failing visited cell repository tests**

Append to `src/features/location/__tests__/visitedCellRepository.test.ts`:

```ts
it('getVisitedCellsByIdsは指定したcellIdのvisited cellを取得する', async () => {
  (db.getAllAsync as jest.Mock).mockResolvedValue([]);

  await getVisitedCellsByIds(['100:1:2', '100:3:4']);

  expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('WHERE cell_id IN (?, ?)'), '100:1:2', '100:3:4');
});

it('getVisitedCellsByIdsは空配列ならDBへ問い合わせない', async () => {
  await expect(getVisitedCellsByIds([])).resolves.toEqual([]);

  expect(db.getAllAsync).not.toHaveBeenCalled();
});
```

Update the import:

```ts
import { deleteAllVisitedCells, getVisitedCellsByIds, getVisitedCellsInBounds, upsertVisitedCells } from '../visitedCellRepository';
```

- [ ] **Step 2: Run visited cell test to verify failure**

Run:

```bash
npm test -- src/features/location/__tests__/visitedCellRepository.test.ts --runInBand
```

Expected: FAIL because `getVisitedCellsByIds` is not exported.

- [ ] **Step 3: Implement `getVisitedCellsByIds`**

Add to `src/features/location/visitedCellRepository.ts` after `getVisitedCellsInBounds`:

```ts
/** 指定したcellIdのvisited cellを取得する。 */
export async function getVisitedCellsByIds(cellIds: string[]): Promise<VisitedCellRow[]> {
  if (cellIds.length === 0) {
    return [];
  }

  const uniqueCellIds = [...new Set(cellIds)];
  const placeholders = uniqueCellIds.map(() => '?').join(', ');

  return db.getAllAsync<VisitedCellRow>(
    `SELECT ${visitedCellColumns}
     FROM visited_cells
     WHERE cell_id IN (${placeholders})
     ORDER BY cell_id ASC`,
    ...uniqueCellIds,
  );
}
```

- [ ] **Step 4: Write failing achievement repository tests**

Update import in `src/features/achievements/__tests__/achievementRepository.test.ts`:

```ts
import { evaluateAndStoreAchievementUnlocks, getAchievementProgress, getAchievementUnlocksByDate } from '../achievementRepository';
```

Append:

```ts
it('指定日の解除済み実績を解除時刻順で取得する', async () => {
  const from = new Date(2026, 4, 31).toISOString();
  const to = new Date(2026, 5, 1).toISOString();
  (db.getAllAsync as jest.Mock).mockResolvedValueOnce([
    { achievementId: 'distance-100', unlockedAt: '2026-05-31T09:00:00.000Z', progressValue: 100000 },
  ]);

  const unlocks = await getAchievementUnlocksByDate('2026-05-31');

  expect(db.getAllAsync).toHaveBeenCalledWith(
    expect.stringContaining('WHERE unlocked_at >= ?'),
    from,
    to,
  );
  expect(unlocks).toEqual([
    expect.objectContaining({
      achievementId: 'distance-100',
      unlockedAt: '2026-05-31T09:00:00.000Z',
    }),
  ]);
});
```

- [ ] **Step 5: Run achievement test to verify failure**

Run:

```bash
npm test -- src/features/achievements/__tests__/achievementRepository.test.ts --runInBand
```

Expected: FAIL because `getAchievementUnlocksByDate` is not exported.

- [ ] **Step 6: Implement `getAchievementUnlocksByDate`**

Add to `src/features/achievements/achievementRepository.ts` after `getAchievementListItems`:

```ts
/** 日別詳細レポートで使う指定日の解除済み実績を取得する。 */
export async function getAchievementUnlocksByDate(localDate: string): Promise<AchievementUnlock[]> {
  const { from, to } = getLocalDateRangeIso(localDate);

  return db.getAllAsync<AchievementUnlock>(
    `SELECT
      achievement_id as achievementId,
      unlocked_at as unlockedAt,
      progress_value as progressValue
     FROM achievement_unlocks
     WHERE unlocked_at >= ?
       AND unlocked_at < ?
     ORDER BY unlocked_at ASC, achievement_id ASC`,
    from,
    to,
  );
}

function getLocalDateRangeIso(localDate: string): { from: string; to: string } {
  const [year, month, day] = localDate.split('-').map(Number);
  return {
    from: new Date(year, month - 1, day).toISOString(),
    to: new Date(year, month - 1, day + 1).toISOString(),
  };
}
```

- [ ] **Step 7: Run repository tests to verify pass**

Run:

```bash
npm test -- src/features/location/__tests__/visitedCellRepository.test.ts src/features/achievements/__tests__/achievementRepository.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/location/visitedCellRepository.ts src/features/location/__tests__/visitedCellRepository.test.ts src/features/achievements/achievementRepository.ts src/features/achievements/__tests__/achievementRepository.test.ts
git commit -m "feat(reports): 日別詳細用のエリアと実績取得を追加"
```

## Task 3: Daily Log Card Plus UI

**Files:**
- Modify: `src/app/components/DailyLogCard.tsx`
- Modify: `src/app/components/DailyLogsScreen.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/appStyles.ts`
- Create: `src/app/components/__tests__/DailyLogCard.test.tsx`
- Modify: `src/app/components/__tests__/DailyLogsScreen.test.tsx`

- [ ] **Step 1: Write failing `DailyLogsScreen` prop forwarding test**

Replace the mock in `src/app/components/__tests__/DailyLogsScreen.test.tsx` with:

```ts
const dailyLogCardMock = jest.fn(() => null);

jest.mock('../DailyLogCard', () => ({
  DailyLogCard: (props: unknown) => dailyLogCardMock(props),
}));
```

Append:

```ts
test('Plus状態とPaywall導線を日別カードへ渡す', () => {
  const onPresentPremiumPaywall = jest.fn();

  act(() => {
    ReactTestRenderer.create(
      <DailyLogsScreen
        dailyLogs={[
          {
            localDate: '2026-05-31',
            pointCount: 1,
            startedAt: '2026-05-31T00:00:00.000Z',
            endedAt: '2026-05-31T00:01:00.000Z',
            distanceMeters: 12,
          },
        ]}
        styles={styles as never}
        theme={lightTheme}
        isPlusActive={true}
        onPresentPremiumPaywall={onPresentPremiumPaywall}
        onBackToMap={jest.fn()}
      />,
    );
  });

  expect(dailyLogCardMock).toHaveBeenCalledWith(
    expect.objectContaining({
      isPlusActive: true,
      onPresentPremiumPaywall,
    }),
  );
});
```

- [ ] **Step 2: Write failing `DailyLogCard` UI tests**

Create `src/app/components/__tests__/DailyLogCard.test.tsx`:

```tsx
import { Pressable, Text } from 'react-native';

import { lightTheme } from '../../../theme/theme';
import { DailyLogCard } from '../DailyLogCard';

jest.mock('../../../features/logs/logRepository', () => ({
  getLocationPointsByDate: jest.fn().mockResolvedValue([
    {
      id: 1,
      recordedAt: '2026-05-31T00:00:00.000Z',
      localDate: '2026-05-31',
      latitude: 35.681236,
      longitude: 139.767125,
      altitude: null,
      speed: null,
      heading: null,
      accuracy: 10,
      altitudeAccuracy: null,
    },
  ]),
}));

jest.mock('../../../features/location/visitedCellRepository', () => ({
  getVisitedCellsByIds: jest.fn().mockResolvedValue([
    {
      cellId: '100:0:0',
      cellSizeMeters: 100,
      x: 0,
      y: 0,
      firstVisitedAt: '2026-05-31T00:00:00.000Z',
      lastVisitedAt: '2026-05-31T00:00:00.000Z',
      visitCount: 1,
    },
  ]),
}));

jest.mock('../../../features/achievements/achievementRepository', () => ({
  getAchievementUnlocksByDate: jest.fn().mockResolvedValue([
    { achievementId: 'distance-100', unlockedAt: '2026-05-31T09:00:00.000Z', progressValue: 100000 },
  ]),
}));

jest.mock('../../../features/achievements/achievementDefinitions', () => ({
  getAchievementDefinition: jest.fn(() => ({ id: 'distance-100', title: '100km移動した' })),
}));

jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: View,
    Marker: View,
    Polyline: View,
  };
});

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

const styles = new Proxy({}, { get: () => ({}) });
const log = {
  localDate: '2026-05-31',
  pointCount: 1,
  startedAt: '2026-05-31T00:00:00.000Z',
  endedAt: '2026-05-31T00:01:00.000Z',
  distanceMeters: 12,
};

describe('日別ログカード DailyLogCard', () => {
  it('Plus無効時は詳細レポートをロック表示してPaywallを開ける', async () => {
    const onPresentPremiumPaywall = jest.fn();
    let renderer: any;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DailyLogCard log={log} styles={styles as never} theme={lightTheme} isPlusActive={false} onPresentPremiumPaywall={onPresentPremiumPaywall} />,
      );
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).toContain('Plusで詳細レポートを表示');

    const button = renderer.root.findAllByType(Pressable).find((node: any) => node.props.accessibilityLabel === 'Strollia Plusで日別詳細レポートを見る');
    act(() => button.props.onPress());

    expect(onPresentPremiumPaywall).toHaveBeenCalledTimes(1);
  });

  it('Plus有効時は日別詳細レポートを表示する', async () => {
    let renderer: any;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DailyLogCard log={log} styles={styles as never} theme={lightTheme} isPlusActive={true} onPresentPremiumPaywall={jest.fn()} />,
      );
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).toContain('訪問エリア');
    expect(texts).toContain('新規エリア');
    expect(texts).toContain('解除した実績');
  });
});
```

- [ ] **Step 3: Run UI tests to verify failure**

Run:

```bash
npm test -- src/app/components/__tests__/DailyLogsScreen.test.tsx src/app/components/__tests__/DailyLogCard.test.tsx --runInBand
```

Expected: FAIL because props and UI are not implemented.

- [ ] **Step 4: Update `DailyLogsScreen` props and forwarding**

Modify `src/app/components/DailyLogsScreen.tsx`:

```tsx
export type DailyLogsScreenProps = {
  dailyLogs: DailyLogSummary[];
  styles: AppStyles;
  theme: AppTheme;
  isPlusActive: boolean;
  onPresentPremiumPaywall: () => void;
  onBackToMap: () => void;
};

export function DailyLogsScreen({ dailyLogs, styles, theme, isPlusActive, onPresentPremiumPaywall, onBackToMap }: DailyLogsScreenProps) {
  ...
          {dailyLogs.map((log) => (
            <DailyLogCard
              key={log.localDate}
              log={log}
              styles={styles}
              theme={theme}
              isPlusActive={isPlusActive}
              onPresentPremiumPaywall={onPresentPremiumPaywall}
            />
          ))}
  ...
}
```

- [ ] **Step 5: Update `App.tsx` call site**

Replace the daily logs screen render in `src/app/App.tsx`:

```tsx
{screenMode === 'dailyLogs' && (
  <DailyLogsScreen
    dailyLogs={dailyLogs}
    styles={styles}
    theme={theme}
    isPlusActive={premiumAccessState.isPlusActive}
    onPresentPremiumPaywall={() => {
      openPremiumPaywall().catch((error: unknown) => {
        console.warn('Failed to open premium paywall:', error);
      });
    }}
    onBackToMap={openMap}
  />
)}
```

- [ ] **Step 6: Implement daily detail UI in `DailyLogCard`**

Update imports:

```ts
import { Pressable, Text, View } from 'react-native';
import { getAchievementDefinition } from '../../features/achievements/achievementDefinitions';
import { getAchievementUnlocksByDate } from '../../features/achievements/achievementRepository';
import { getVisitedCellsByIds } from '../../features/location/visitedCellRepository';
import { coordinateToGridCell } from '../../features/location/grid/gridCell';
import { createDailyDetailReport, DailyDetailReport } from '../../features/reports/dailyReport';
```

Extend props:

```ts
export type DailyLogCardProps = {
  log: DailyLogSummary;
  styles: AppStyles;
  theme: AppTheme;
  isPlusActive: boolean;
  onPresentPremiumPaywall: () => void;
};
```

Add state and loader inside `DailyLogCard`:

```ts
const [dailyDetailReport, setDailyDetailReport] = useState<DailyDetailReport | null>(null);

useEffect(() => {
  let isMounted = true;

  async function loadDailyDetailReport(): Promise<void> {
    if (!isPlusActive || dailyPoints.length === 0) {
      setDailyDetailReport(null);
      return;
    }

    const cellIds = [...new Set(dailyPoints.map((point) => coordinateToGridCell(point).cellId))];
    const [visitedCells, achievementUnlocks] = await Promise.all([
      getVisitedCellsByIds(cellIds),
      getAchievementUnlocksByDate(log.localDate),
    ]);
    const unlockedAchievements = achievementUnlocks.flatMap((unlock) => {
      const definition = getAchievementDefinition(unlock.achievementId);
      return definition ? [{ id: definition.id, title: definition.title, unlockedAt: unlock.unlockedAt }] : [];
    });

    if (isMounted) {
      setDailyDetailReport(createDailyDetailReport({ localDate: log.localDate, points: dailyPoints, visitedCells, unlockedAchievements }));
    }
  }

  loadDailyDetailReport().catch(() => {
    if (isMounted) {
      setDailyDetailReport(null);
    }
  });

  return () => {
    isMounted = false;
  };
}, [dailyPoints, isPlusActive, log.localDate]);
```

Add JSX below `dailyTime`:

```tsx
{isPlusActive ? (
  dailyDetailReport && (
    <View style={styles.dailyDetailPanel}>
      <View style={styles.dailyDetailRow}>
        <Text style={styles.dailyDetailLabel}>訪問エリア</Text>
        <Text style={styles.dailyDetailValue}>{dailyDetailReport.visitedAreaCount}</Text>
      </View>
      <View style={styles.dailyDetailRow}>
        <Text style={styles.dailyDetailLabel}>新規エリア</Text>
        <Text style={styles.dailyDetailValue}>{dailyDetailReport.newAreaCount}</Text>
      </View>
      <View style={styles.dailyDetailRow}>
        <Text style={styles.dailyDetailLabel}>解除した実績</Text>
        <Text style={styles.dailyDetailValue}>{dailyDetailReport.unlockedAchievements.length}</Text>
      </View>
    </View>
  )
) : (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel="Strollia Plusで日別詳細レポートを見る"
    onPress={onPresentPremiumPaywall}
    style={styles.dailyDetailLockedPanel}
  >
    <Text style={styles.dailyDetailLockedTitle}>Plusで詳細レポートを表示</Text>
    <Text style={styles.dailyDetailLockedText}>訪問エリア、新規エリア、その日に解除した実績を確認できます。</Text>
  </Pressable>
)}
```

- [ ] **Step 7: Add styles**

Add to `src/app/appStyles.ts` near daily styles:

```ts
dailyDetailPanel: {
  borderColor: colors.border,
  borderRadius: 16,
  borderWidth: 1,
  gap: 8,
  padding: 12,
},
dailyDetailRow: {
  alignItems: 'center',
  flexDirection: 'row',
  justifyContent: 'space-between',
},
dailyDetailLabel: {
  color: colors.mutedText,
  fontSize: 13,
  fontWeight: '800',
},
dailyDetailValue: {
  color: colors.text,
  fontSize: 16,
  fontWeight: '900',
},
dailyDetailLockedPanel: {
  backgroundColor: colors.surface,
  borderColor: colors.border,
  borderRadius: 16,
  borderWidth: 1,
  gap: 4,
  padding: 12,
},
dailyDetailLockedTitle: {
  color: colors.text,
  fontWeight: '900',
},
dailyDetailLockedText: {
  color: colors.mutedText,
  fontSize: 12,
  fontWeight: '700',
},
```

- [ ] **Step 8: Run UI tests to verify pass**

Run:

```bash
npm test -- src/app/components/__tests__/DailyLogsScreen.test.tsx src/app/components/__tests__/DailyLogCard.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/app/App.tsx src/app/appStyles.ts src/app/components/DailyLogCard.tsx src/app/components/DailyLogsScreen.tsx src/app/components/__tests__/DailyLogCard.test.tsx src/app/components/__tests__/DailyLogsScreen.test.tsx
git commit -m "feat(premium): 日別詳細レポートをPlus向けに表示"
```

## Task 4: Docs, Full Verification, and PR

**Files:**
- Modify: `docs/plus-features.md`
- Modify: `docs/todo.md`

- [ ] **Step 1: Update docs after implementation**

In `docs/todo.md`, change:

```md
- [ ] 日別詳細レポートMVPを追加する
```

to:

```md
- [x] 日別詳細レポートMVPを追加する
```

In `docs/plus-features.md`, add one implementation note under `6.1 日別詳細レポート`:

```md
MVPでは、日別ログカード内にPlus限定の詳細パネルを表示する。Plus無効時は、日別ログ自体は表示したまま、詳細パネル部分だけPlus案内にする。
```

- [ ] **Step 2: Run targeted tests**

Run:

```bash
npm test -- src/features/reports/__tests__/dailyReport.test.ts src/features/location/__tests__/visitedCellRepository.test.ts src/features/achievements/__tests__/achievementRepository.test.ts src/app/components/__tests__/DailyLogsScreen.test.tsx src/app/components/__tests__/DailyLogCard.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run full test suite**

Run:

```bash
npm test -- --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit docs and any test fixes**

```bash
git add docs/plus-features.md docs/todo.md
git commit -m "docs(premium): 日別詳細レポート実装状況を更新"
```

If Task 4 only changes docs and those docs were already committed together with Task 3 due small edits during implementation, skip this commit and explain that no separate docs commit was needed.

- [ ] **Step 6: Push branch**

```bash
git push -u origin codex/daily-plus-pricing
```

Expected: branch pushed.

- [ ] **Step 7: Open PR to `main`**

```bash
gh pr create --base main --head codex/daily-plus-pricing --title "日別詳細レポートをPlus対象として追加" --body "## Summary
- 日別ログカードにPlus向けの日別詳細レポートを追加
- 訪問エリア数、新規エリア数、その日の解除実績数を表示
- Plus未加入時は日別ログを維持し、詳細パネルのみPaywallへ誘導

## Tests
- npm test -- src/features/reports/__tests__/dailyReport.test.ts src/features/location/__tests__/visitedCellRepository.test.ts src/features/achievements/__tests__/achievementRepository.test.ts src/app/components/__tests__/DailyLogsScreen.test.tsx src/app/components/__tests__/DailyLogCard.test.tsx --runInBand
- npm run typecheck
- npm test -- --runInBand"
```

Expected: Open PR created, not Draft.

## Self-Review

- Spec coverage:
  - Free daily log stays available: Task 3 only gates the detail panel, not cards.
  - Plus daily detail report: Task 1 and Task 3.
  - Area wording: Task 3 UI copy and prior docs.
  - Weather deferred: already documented in the approved design; no code task.
  - Restore/device migration: already documented in the approved design; no code task.
  - Pricing: already documented in the approved design; no code task.
- Placeholder scan:
  - No placeholder markers or unspecified edge handling remain in this plan.
- Type consistency:
  - `DailyDetailReport`, `DailyDetailAchievement`, `getVisitedCellsByIds`, and `getAchievementUnlocksByDate` are defined before use.
  - UI props are threaded from `App.tsx` to `DailyLogsScreen` to `DailyLogCard`.
