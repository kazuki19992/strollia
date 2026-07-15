# Auto Recording Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 位置情報権限が揃ったら自動でGPS記録を開始し、通常時の開始/停止ボタンを設定画面からなくし、自動開始失敗時だけ復旧用の記録開始ボタンを表示する。

**Architecture:** 自動開始条件は純粋関数へ切り出して単体テストする。`App.tsx` は権限・記録状態の再同期後に自動開始判定を呼び、`SettingsScreen` は状態に応じた表示だけを担当する。既存の `startBackgroundLocationRecording` は記録開始の実処理として再利用し、停止サービス関数は残す。

**Tech Stack:** Expo React Native, TypeScript, Jest, react-test-renderer, expo-location, expo-task-manager

---

## File Structure

- Create: `src/app/autoRecording.ts`
  - 自動GPS記録を開始すべきかを判定する純粋関数を置く。
- Create: `src/app/__tests__/autoRecording.test.ts`
  - 権限、記録状態、多重起動状態ごとの判定を検証する。
- Modify: `src/app/App.tsx`
  - 起動時一度きりの自動開始から、権限・記録状態同期後に再試行できる自動開始へ変更する。
  - 設定画面へ渡す停止ハンドラを削除する。
- Modify: `src/app/components/SettingsScreen.tsx`
  - 通常時の「記録開始」「停止」ボタンを削除し、失敗時だけ復旧用の「記録開始」ボタンを表示する。
- Modify: `src/app/components/__tests__/SettingsScreen.test.tsx`
  - 通常時に開始/停止ボタンが表示されないこと、失敗時だけ開始ボタンが表示されることを検証する。
- Modify: `src/app/__tests__/AppMapReturn.test.tsx`
  - 権限あり・未記録なら自動開始することと、記録中なら重複開始しないことを検証する。
- Modify: `src/app/appText.ts`
  - 自動常時記録を前提にした文言へ更新する。
- Modify: `src/app/__tests__/appText.test.ts`
  - `checking`、`recording`、`needsPermission`、`failed` の文言を検証する。
- Modify: `docs/mvp.md`, `docs/architecture.md`, `docs/todo.md`
  - 設計書に合わせ、権限許可後の自動記録と復旧用開始ボタンの仕様へ更新する。

---

### Task 1: 自動開始判定を追加する

**Files:**

- Create: `src/app/autoRecording.ts`
- Create: `src/app/__tests__/autoRecording.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/__tests__/autoRecording.test.ts`:

```ts
import { shouldStartRecordingAutomatically } from '../autoRecording';
import { LocationPermissionState } from '../../features/location/locationPermission';

const grantedPermissions: LocationPermissionState = {
  foregroundGranted: true,
  backgroundGranted: true,
  canAskForeground: true,
  canAskBackground: true,
};

describe('自動GPS記録判定 shouldStartRecordingAutomatically', () => {
  it('権限が揃っていて未記録なら自動開始する', () => {
    expect(
      shouldStartRecordingAutomatically({
        permissions: grantedPermissions,
        isRecording: false,
        isAutoStartInFlight: false,
      }),
    ).toBe(true);
  });

  it('すでに記録中なら自動開始しない', () => {
    expect(
      shouldStartRecordingAutomatically({
        permissions: grantedPermissions,
        isRecording: true,
        isAutoStartInFlight: false,
      }),
    ).toBe(false);
  });

  it('バックグラウンド権限がない場合は自動開始しない', () => {
    expect(
      shouldStartRecordingAutomatically({
        permissions: { ...grantedPermissions, backgroundGranted: false },
        isRecording: false,
        isAutoStartInFlight: false,
      }),
    ).toBe(false);
  });

  it('自動開始処理中なら重複して開始しない', () => {
    expect(
      shouldStartRecordingAutomatically({
        permissions: grantedPermissions,
        isRecording: false,
        isAutoStartInFlight: true,
      }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/app/__tests__/autoRecording.test.ts
```

Expected: FAIL because `../autoRecording` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/app/autoRecording.ts`:

```ts
import { hasRequiredLocationPermission, LocationPermissionState } from '../features/location/locationPermission';

/** 自動GPS記録開始判定に必要な状態。 */
export type AutoRecordingDecisionInput = {
  /** 現在の位置情報権限状態。 */
  permissions: LocationPermissionState;
  /** Expo Locationのバックグラウンド更新が開始済みか。 */
  isRecording: boolean;
  /** 自動開始処理がすでに実行中か。 */
  isAutoStartInFlight: boolean;
};

/** 権限許可後にGPS記録を自動開始すべきか返す。 */
export function shouldStartRecordingAutomatically({ permissions, isRecording, isAutoStartInFlight }: AutoRecordingDecisionInput): boolean {
  return hasRequiredLocationPermission(permissions) && !isRecording && !isAutoStartInFlight;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- src/app/__tests__/autoRecording.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/app/autoRecording.ts src/app/__tests__/autoRecording.test.ts
git commit -m "feat(app): 自動GPS記録の開始判定を追加"
```

---

### Task 2: 設定画面の記録操作表示を変更する

**Files:**

- Modify: `src/app/components/SettingsScreen.tsx`
- Modify: `src/app/components/__tests__/SettingsScreen.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add tests to `src/app/components/__tests__/SettingsScreen.test.tsx`:

```tsx
test('通常時は記録開始と停止ボタンを表示しない', () => {
  let renderer: any;

  act(() => {
    renderer = ReactTestRenderer.create(<SettingsScreen {...createProps()} />);
  });

  const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

  expect(texts).not.toContain('記録開始');
  expect(texts).not.toContain('停止');
});

test('自動開始失敗時だけ復旧用の記録開始ボタンを表示する', () => {
  const props = {
    ...createProps(),
    isRecording: false,
    autoStartStatus: 'failed' as const,
  };
  let renderer: any;

  act(() => {
    renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
  });

  const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

  expect(texts).toContain('記録開始');
  expect(texts).not.toContain('停止');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/app/components/__tests__/SettingsScreen.test.tsx
```

Expected: FAIL because normal state still renders `記録開始` and `停止`.

- [ ] **Step 3: Write minimal implementation**

Update `SettingsScreenProps` in `src/app/components/SettingsScreen.tsx`:

```ts
  /** GPS記録開始処理。自動開始失敗時の復旧操作でだけ使う。 */
  onStartRecording: () => void;
- /** GPS記録停止処理。 */
- onStopRecording: () => void;
```

Remove `onStopRecording` from the function parameters.

Replace the GPS action rendering block with:

```tsx
{
  !hasRequiredPermission ? (
    <View style={styles.permissionSettingsBox}>
      <Text style={styles.permissionTitle}>位置情報の常時許可が必要です</Text>
      <Text style={styles.permissionText}>OSの権限で「常に」許可すると、画面を閉じても記録できます。</Text>
      <Pressable onPress={onRequestLocationPermission} style={styles.permissionButton}>
        <Text style={styles.permissionButtonText}>{shouldOpenSettingsForPermission ? '設定を開く' : '権限を付与する'}</Text>
      </Pressable>
    </View>
  ) : autoStartStatus === 'failed' ? (
    <View style={styles.actions}>
      <Pressable disabled={isRecording} onPress={onStartRecording} style={[styles.primaryButton, isRecording && styles.buttonDisabled]}>
        <Text style={styles.primaryButtonText}>記録開始</Text>
      </Pressable>
    </View>
  ) : null;
}
```

Update `createProps` in the test by removing `onStopRecording`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- src/app/components/__tests__/SettingsScreen.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/app/components/SettingsScreen.tsx src/app/components/__tests__/SettingsScreen.test.tsx
git commit -m "feat(settings): GPS記録操作を自動記録前提に変更"
```

---

### Task 3: 自動開始を権限同期後に再試行する

**Files:**

- Modify: `src/app/App.tsx`
- Modify: `src/app/__tests__/AppMapReturn.test.tsx`

- [ ] **Step 1: Write the failing tests**

Update imports in `src/app/__tests__/AppMapReturn.test.tsx`:

```ts
import { AppState } from 'react-native';
import { isBackgroundLocationRecording, startBackgroundLocationRecording } from '../../features/location/locationService';
import { getLocationPermissionState } from '../../features/location/locationPermission';
```

Add tests inside `describe('App 地図復帰時の表示範囲復元', () => { ... })`:

```tsx
test('初回に権限不足でも復帰後に権限が揃ったら自動で記録開始する', async () => {
  let appStateHandler: ((state: string) => void) | null = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event: any, handler: any) => {
    appStateHandler = handler;
    return { remove: jest.fn() } as any;
  });
  (getLocationPermissionState as jest.Mock)
    .mockResolvedValueOnce({
      foregroundGranted: true,
      backgroundGranted: false,
      canAskForeground: true,
      canAskBackground: true,
    })
    .mockResolvedValue({
      foregroundGranted: true,
      backgroundGranted: true,
      canAskForeground: true,
      canAskBackground: true,
    });
  (isBackgroundLocationRecording as jest.Mock).mockResolvedValue(false);
  let renderer: any;

  await act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  await flushPromises();

  expect(renderer).toBeTruthy();
  expect(startBackgroundLocationRecording).not.toHaveBeenCalled();

  await act(async () => {
    appStateHandler?.('active');
  });
  await flushPromises();

  expect(startBackgroundLocationRecording).toHaveBeenCalledTimes(1);
});

test('すでに記録中なら起動後に記録開始を重複実行しない', async () => {
  (isBackgroundLocationRecording as jest.Mock).mockResolvedValue(true);
  let renderer: any;

  await act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  await flushPromises();

  expect(renderer).toBeTruthy();
  expect(startBackgroundLocationRecording).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/app/__tests__/AppMapReturn.test.tsx
```

Expected: FAIL because the current one-shot auto-start guard does not retry after the first permission-missing attempt.

- [ ] **Step 3: Write minimal implementation**

Update imports in `src/app/App.tsx`:

```ts
import { shouldStartRecordingAutomatically } from './autoRecording';
```

Replace `autoStartAttemptedRef` with:

```ts
const autoStartInFlightRef = useRef(false);
```

Add callback after `startRecording`:

```ts
/** 権限許可後に未記録ならGPS記録の自動開始を試みる。 */
const maybeStartRecordingAutomatically = useCallback(
  async (state: { permissions: LocationPermissionState; recording: boolean }): Promise<void> => {
    if (
      !shouldStartRecordingAutomatically({
        permissions: state.permissions,
        isRecording: state.recording,
        isAutoStartInFlight: autoStartInFlightRef.current,
      })
    ) {
      setAutoStartStatus(hasRequiredLocationPermission(state.permissions) ? 'recording' : 'needsPermission');
      return;
    }

    autoStartInFlightRef.current = true;

    try {
      await startRecording('auto');
    } finally {
      autoStartInFlightRef.current = false;
    }
  },
  [startRecording],
);
```

In the initial setup effect, replace:

```ts
await refreshData();
```

with:

```ts
const initialState = await refreshData();
await maybeStartRecordingAutomatically(initialState);
```

Replace the old `useEffect` that checks `autoStartAttemptedRef` and calls `isBackgroundLocationRecording()` with no effect, because automatic start now happens after each data sync.

In the AppState active handler, replace:

```ts
refreshDataAndEvaluateAchievementsIfDialogIdle();
```

with:

```ts
refreshData()
  .then(maybeStartRecordingAutomatically)
  .then(evaluateAchievementsIfDialogIdle)
  .then(async (didEvaluate) => {
    if (didEvaluate) {
      await refreshAchievementState(true);
    }
  });
```

Remove `onStopRecording={stopRecording}` from the `SettingsScreen` props and remove the unused `stopRecording` callback if TypeScript reports it unused.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- src/app/__tests__/AppMapReturn.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/app/App.tsx src/app/__tests__/AppMapReturn.test.tsx
git commit -m "feat(app): 権限許可後にGPS記録を自動開始"
```

---

### Task 4: 自動記録文言を更新する

**Files:**

- Modify: `src/app/appText.ts`
- Modify: `src/app/__tests__/appText.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace `src/app/__tests__/appText.test.ts` with:

```ts
import { getAutoRecordNote } from '../appText';

describe('自動記録ステータス文言 getAutoRecordNote', () => {
  it('確認中の場合は自動記録の状態確認中であることを説明する', () => {
    expect(getAutoRecordNote('checking')).toBe('自動記録の状態を確認しています。');
  });

  it('記録中の場合はバックグラウンドで自動保存中であることを説明する', () => {
    expect(getAutoRecordNote('recording')).toBe('GPSログをバックグラウンドで自動保存しています。');
  });

  it('権限待ちの場合は権限許可後に自動開始することを説明する', () => {
    expect(getAutoRecordNote('needsPermission')).toBe('位置情報権限を許可すると自動で記録を開始します。');
  });

  it('失敗時は手動再試行できることを説明する', () => {
    expect(getAutoRecordNote('failed')).toBe('自動記録を開始できませんでした。記録を始めるには手動で再試行してください。');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/app/__tests__/appText.test.ts
```

Expected: FAIL because existing text differs.

- [ ] **Step 3: Write minimal implementation**

Update `getAutoRecordNote` in `src/app/appText.ts`:

```ts
export function getAutoRecordNote(status: AutoStartStatus): string {
  switch (status) {
    case 'checking':
      return '自動記録の状態を確認しています。';
    case 'recording':
      return 'GPSログをバックグラウンドで自動保存しています。';
    case 'needsPermission':
      return '位置情報権限を許可すると自動で記録を開始します。';
    case 'failed':
      return '自動記録を開始できませんでした。記録を始めるには手動で再試行してください。';
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- src/app/__tests__/appText.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/app/appText.ts src/app/__tests__/appText.test.ts
git commit -m "fix(app): 自動GPS記録の案内文を更新"
```

---

### Task 5: ドキュメントを自動記録仕様へ更新する

**Files:**

- Modify: `docs/mvp.md`
- Modify: `docs/architecture.md`
- Modify: `docs/todo.md`

- [ ] **Step 1: Write the documentation changes**

Update documentation to state:

```md
位置情報権限が揃ったらGPS記録を自動で開始する。設定画面では通常の記録開始/停止操作を表示せず、自動開始に失敗した場合のみ復旧用の「記録開始」ボタンを表示する。
```

Remove or revise statements that describe normal recording as:

```md
記録開始・停止は設定画面で扱う
```

Replace with:

```md
設定画面では記録状態と権限導線を表示する。通常時の開始/停止操作は表示せず、自動開始失敗時だけ復旧用の開始操作を表示する。
```

- [ ] **Step 2: Verify changed docs**

Run:

```bash
git diff -- docs/mvp.md docs/architecture.md docs/todo.md
```

Expected: Diff only describes the new auto-recording behavior and does not alter unrelated feature scope.

- [ ] **Step 3: Commit**

Run:

```bash
git add docs/mvp.md docs/architecture.md docs/todo.md
git commit -m "docs: 自動GPS記録の仕様を反映"
```

---

### Task 6: 全体検証

**Files:**

- Verify all changed app, test, and docs files.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- src/app/__tests__/autoRecording.test.ts src/app/components/__tests__/SettingsScreen.test.tsx src/app/__tests__/AppMapReturn.test.tsx src/app/__tests__/appText.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run:

```bash
npm test -- --runInBand
```

Expected: PASS.

- [ ] **Step 4: Inspect final status**

Run:

```bash
git status --short --branch
```

Expected: clean working tree on `codex/auto-start-recording`.
