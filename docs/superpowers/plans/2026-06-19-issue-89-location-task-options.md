# Issue #89 Location Task Options Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存ユーザーの位置情報タスクへ最新設定を一度だけ安全に反映し、起動時の `stop→start` によるバックグラウンド記録欠落をなくす。

**Architecture:** `locationTrackingConfig.ts` に現在値と期待値を比較する純粋関数を追加する。`locationService.ts` は登録済みタスクのオプションを取得し、不一致の場合だけ同名 `startLocationUpdatesAsync` でupsertし、明示的な停止は行わない。

**Tech Stack:** TypeScript, React Native, Expo Location 19.0.8, Expo TaskManager 14.0.9, Jest

---

## File Structure

- Modify: `src/features/location/locationTrackingConfig.ts` — Strollia管理対象のタスクオプション比較を担当する。
- Modify: `src/features/location/__tests__/locationTrackingConfig.test.ts` — オプション一致・不一致の純粋関数テストを担当する。
- Modify: `src/features/location/locationService.ts` — 記録中タスクの現在オプション取得と条件付きupsertを担当する。
- Rename: `src/features/location/__tests__/refreshBackgroundLocationTaskRegistration.test.ts` → `src/features/location/__tests__/updateBackgroundLocationTaskOptionsIfNeeded.test.ts` — 停止しない条件付き更新のサービス契約を検証する。
- Modify: `src/app/App.tsx` — 初期化時に新しい条件付き更新関数を呼ぶ。
- Modify: `src/app/__tests__/AppMapReturn.test.tsx` — location service mock名を新しい関数名へ揃える。
- Modify: `src/app/__tests__/AppCustomIconCentering.test.tsx` — location service mock名を新しい関数名へ揃える。
- Modify: `docs/architecture.md` — 同名upsertと設定一致時の非更新を記録方針へ追加する。

### Task 1: タスクオプション一致判定

**Files:**

- Modify: `src/features/location/locationTrackingConfig.ts`
- Test: `src/features/location/__tests__/locationTrackingConfig.test.ts`

- [ ] **Step 1: 一致・不一致を示す失敗テストを書く**

`locationTrackingConfig.test.ts` へ `hasCurrentLocationTaskOptions` のimportと以下を追加する。

```typescript
it('Strolliaが管理する登録済みオプションがすべて一致すると最新と判定する', () => {
  expect(hasCurrentLocationTaskOptions(getLocationTaskOptions())).toBe(true);
});

it('Dynamic Island表示設定が古いと最新ではないと判定する', () => {
  expect(
    hasCurrentLocationTaskOptions({
      ...getLocationTaskOptions(),
      showsBackgroundLocationIndicator: true,
    }),
  ).toBe(false);
});

it('監視間隔またはforeground service設定が異なると最新ではないと判定する', () => {
  expect(
    hasCurrentLocationTaskOptions({
      ...getLocationTaskOptions(),
      distanceInterval: 100,
    }),
  ).toBe(false);
  expect(
    hasCurrentLocationTaskOptions({
      ...getLocationTaskOptions(),
      foregroundService: {
        ...getLocationTaskOptions().foregroundService!,
        notificationBody: '古い通知文言',
      },
    }),
  ).toBe(false);
});

it('Strolliaが管理しない余分なプロパティは一致判定へ影響しない', () => {
  expect(
    hasCurrentLocationTaskOptions({
      ...getLocationTaskOptions(),
      deferredUpdatesDistance: 0,
    }),
  ).toBe(true);
});
```

- [ ] **Step 2: テストが未実装関数により失敗することを確認する**

Run:

```text
npm test -- --runInBand src/features/location/__tests__/locationTrackingConfig.test.ts
```

Expected: `hasCurrentLocationTaskOptions` がexportされていないためFAIL。

- [ ] **Step 3: 管理対象を明示比較する最小実装を書く**

`locationTrackingConfig.ts` へ追加する。

```typescript
/** 登録済みタスクにStrollia管理対象の最新オプションが反映済みか返す。 */
export function hasCurrentLocationTaskOptions(current: Location.LocationTaskOptions | null): boolean {
  if (!current) {
    return false;
  }

  const expected = getLocationTaskOptions();

  return (
    current.accuracy === expected.accuracy &&
    current.timeInterval === expected.timeInterval &&
    current.distanceInterval === expected.distanceInterval &&
    current.deferredUpdatesInterval === expected.deferredUpdatesInterval &&
    current.pausesUpdatesAutomatically === expected.pausesUpdatesAutomatically &&
    current.showsBackgroundLocationIndicator === expected.showsBackgroundLocationIndicator &&
    current.foregroundService?.notificationTitle === expected.foregroundService?.notificationTitle &&
    current.foregroundService?.notificationBody === expected.foregroundService?.notificationBody &&
    current.foregroundService?.notificationColor === expected.foregroundService?.notificationColor &&
    current.foregroundService?.killServiceOnDestroy === expected.foregroundService?.killServiceOnDestroy
  );
}
```

- [ ] **Step 4: フォーカステストを通す**

Run:

```text
npm test -- --runInBand src/features/location/__tests__/locationTrackingConfig.test.ts
```

Expected: PASS。

- [ ] **Step 5: 一致判定をコミットする**

```text
git add src/features/location/locationTrackingConfig.ts src/features/location/__tests__/locationTrackingConfig.test.ts
git commit -m "fix(location): タスク設定の更新要否を判定する"
```

### Task 2: 記録を停止しない条件付きタスク更新

**Files:**

- Modify: `src/features/location/locationService.ts`
- Rename: `src/features/location/__tests__/refreshBackgroundLocationTaskRegistration.test.ts` → `src/features/location/__tests__/updateBackgroundLocationTaskOptionsIfNeeded.test.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/app/__tests__/AppMapReturn.test.tsx`
- Modify: `src/app/__tests__/AppCustomIconCentering.test.tsx`

- [ ] **Step 1: サービステストを新しい責務へ変更する**

テストファイルをrenameし、`updateBackgroundLocationTaskOptionsIfNeeded` をimportする。`expo-task-manager` mockへ `getTaskOptionsAsync` を追加し、以下のケースを実装する。

```typescript
it('記録中で設定が古い場合は停止せず同名タスクへ最新設定を適用する', async () => {
  mockedLocation.hasStartedLocationUpdatesAsync.mockResolvedValue(true);
  mockedTaskManager.getTaskOptionsAsync.mockResolvedValue({
    ...getLocationTaskOptions(),
    showsBackgroundLocationIndicator: true,
  });

  await updateBackgroundLocationTaskOptionsIfNeeded();

  expect(mockedLocation.stopLocationUpdatesAsync).not.toHaveBeenCalled();
  expect(mockedLocation.startLocationUpdatesAsync).toHaveBeenCalledWith(BACKGROUND_LOCATION_TASK_NAME, getLocationTaskOptions());
});

it('記録中で設定が最新の場合はstartもstopも呼ばない', async () => {
  mockedLocation.hasStartedLocationUpdatesAsync.mockResolvedValue(true);
  mockedTaskManager.getTaskOptionsAsync.mockResolvedValue(getLocationTaskOptions());

  await updateBackgroundLocationTaskOptionsIfNeeded();

  expect(mockedLocation.startLocationUpdatesAsync).not.toHaveBeenCalled();
  expect(mockedLocation.stopLocationUpdatesAsync).not.toHaveBeenCalled();
});

it('記録していない場合はオプション取得もstartもstopも呼ばない', async () => {
  mockedLocation.hasStartedLocationUpdatesAsync.mockResolvedValue(false);

  await updateBackgroundLocationTaskOptionsIfNeeded();

  expect(mockedTaskManager.getTaskOptionsAsync).not.toHaveBeenCalled();
  expect(mockedLocation.startLocationUpdatesAsync).not.toHaveBeenCalled();
  expect(mockedLocation.stopLocationUpdatesAsync).not.toHaveBeenCalled();
});

it('TaskManagerが利用できない場合はタスク状態を確認しない', async () => {
  mockedTaskManager.isAvailableAsync.mockResolvedValue(false);

  await updateBackgroundLocationTaskOptionsIfNeeded();

  expect(mockedLocation.hasStartedLocationUpdatesAsync).not.toHaveBeenCalled();
  expect(mockedTaskManager.getTaskOptionsAsync).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 旧実装に対して回帰テストが失敗することを確認する**

Run:

```text
npm test -- --runInBand src/features/location/__tests__/updateBackgroundLocationTaskOptionsIfNeeded.test.ts
```

Expected: 新しい関数が未実装であり、旧実装はstopを呼ぶためFAIL。

- [ ] **Step 3: 条件付きupsertを実装する**

`locationService.ts` の旧関数を以下へ置き換える。

```typescript
/**
 * 記録中タスクの設定が古い場合だけ、同名タスクへ最新オプションを適用する。
 *
 * Expo TaskManagerは同名・同consumerへのstartを既存タスクの設定更新として扱う。
 * 明示的なstopは記録を中断するため行わない。
 */
export async function updateBackgroundLocationTaskOptionsIfNeeded(): Promise<void> {
  if (!(await TaskManager.isAvailableAsync())) {
    return;
  }

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME);

  if (!alreadyStarted) {
    return;
  }

  const currentOptions = await TaskManager.getTaskOptionsAsync<Location.LocationTaskOptions>(BACKGROUND_LOCATION_TASK_NAME);

  if (hasCurrentLocationTaskOptions(currentOptions)) {
    return;
  }

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME, getLocationTaskOptions());
}
```

同時に `hasCurrentLocationTaskOptions` をimportする。

- [ ] **Step 4: Appとテストmockを新しい関数名へ揃える**

`App.tsx` ではimportと起動時呼び出しを `updateBackgroundLocationTaskOptionsIfNeeded` へ変更し、コメントと警告文を「再登録」ではなく「設定更新」に変更する。

`AppMapReturn.test.tsx` と `AppCustomIconCentering.test.tsx` のmock keyを以下へ変更する。

```typescript
updateBackgroundLocationTaskOptionsIfNeeded: jest.fn().mockResolvedValue(undefined),
```

- [ ] **Step 5: 位置情報のフォーカステストを通す**

Run:

```text
npm test -- --runInBand src/features/location/__tests__/locationTrackingConfig.test.ts src/features/location/__tests__/updateBackgroundLocationTaskOptionsIfNeeded.test.ts src/app/__tests__/AppMapReturn.test.tsx src/app/__tests__/AppCustomIconCentering.test.tsx
```

Expected: PASS。設定が最新ならstartしない、古い場合もstopしないことが確認できる。

- [ ] **Step 6: タスク更新修正をコミットする**

```text
git add src/features/location/locationService.ts src/features/location/__tests__/updateBackgroundLocationTaskOptionsIfNeeded.test.ts src/app/App.tsx src/app/__tests__/AppMapReturn.test.tsx src/app/__tests__/AppCustomIconCentering.test.tsx
git commit -m "fix(location): 記録を止めずタスク設定を更新する"
```

### Task 3: バックグラウンド記録方針の同期

**Files:**

- Modify: `docs/architecture.md`

- [ ] **Step 1: タスク設定更新方針を追記する**

`docs/architecture.md` のバックグラウンド記録方針へ以下を追加する。

```markdown
登録済みタスクへ監視オプションの変更を反映する場合は、現在の登録値と最新値を比較する。差分がある場合だけ同じタスク名で `startLocationUpdatesAsync` を呼び、Expo TaskManagerの既存タスク更新を利用する。記録中タスクを明示的に停止して再登録してはならない。

登録値が最新の場合は `startLocationUpdatesAsync` を呼ばず、位置監視をそのまま継続する。
```

- [ ] **Step 2: ドキュメント差分を確認する**

Run:

```text
git diff --check
git diff -- docs/architecture.md
```

Expected: 空白エラーがなく、設計書と同じ条件付きupsert方針が記載されている。

- [ ] **Step 3: ドキュメントをコミットする**

```text
git add docs/architecture.md
git commit -m "docs(location): タスク設定の安全な更新方針を追記"
```

### Task 4: 最終検証

**Files:**

- Verify: `src/features/location/locationTrackingConfig.ts`
- Verify: `src/features/location/locationService.ts`
- Verify: `src/app/App.tsx`
- Verify: `docs/architecture.md`

- [ ] **Step 1: 型チェックを実行する**

Run:

```text
npm run typecheck
```

Expected: exit 0。

- [ ] **Step 2: 全テストを実行する**

Run:

```text
npm test -- --runInBand
```

Expected: 全テストPASS。

- [ ] **Step 3: 差分とコミット状態を確認する**

Run:

```text
git diff --check
git status --short --branch
git log --oneline --decorate -5
```

Expected: worktreeがcleanで、設計、計画、一致判定、サービス修正、ドキュメントの目的別コミットが並ぶ。
