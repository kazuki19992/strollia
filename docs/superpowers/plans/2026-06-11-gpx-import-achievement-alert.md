# GPX Import Achievement Alert Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show an achievement-scope notice immediately after the user taps GPX import and before the file picker opens.

**Architecture:** Keep `SettingsScreen` presentational and keep the import flow owned by `src/app/App.tsx`. Add a single `Alert.alert(title, message)` call in `importGpx()` before `pickAndReadGpxFile()`, and cover the ordering with an App integration test that calls the captured `onImportGpx` prop.

**Tech Stack:** Expo React Native, TypeScript, Jest, react-test-renderer, React Native `Alert`.

---

## File Structure

- Modify: `src/app/App.tsx` - add the pre-file-picker achievement notice to `importGpx()`.
- Modify: `src/app/__tests__/AppMapReturn.test.tsx` - mock the GPX import service and assert the notice appears before file selection.

## Task 1: Pre-File-Picker Achievement Notice

**Files:**

- Modify: `src/app/__tests__/AppMapReturn.test.tsx`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Write the failing App test**

Add the GPX import service import near the existing imports in `src/app/__tests__/AppMapReturn.test.tsx`:

```typescript
import { pickAndReadGpxFile } from '../../features/import/gpxImportService';
```

Add this mock near the other feature mocks:

```typescript
jest.mock('../../features/import/gpxImportService', () => ({
  pickAndReadGpxFile: jest.fn().mockResolvedValue(null),
}));
```

Inside the existing `beforeEach`, after the existing mock resets, add:

```typescript
(pickAndReadGpxFile as jest.Mock).mockResolvedValue(null);
```

Add this test inside `describe('App 地図復帰時の表示範囲復元', () => { ... })`:

```typescript
test('GPXインポート押下直後に実績反映範囲の注意を表示してからファイル選択を開く', async () => {
  const callOrder: string[] = [];
  jest.spyOn(Alert, 'alert').mockImplementation((title: string, message?: string) => {
    callOrder.push(`alert:${title}:${message ?? ''}`);
  });
  (pickAndReadGpxFile as jest.Mock).mockImplementation(async () => {
    callOrder.push('pick');
    return null;
  });

  await act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  await flushPromises();

  await act(async () => {
    renderer.root.findByProps({ accessibilityLabel: '設定' }).props.onPress();
  });

  await act(async () => {
    await mockLatestSettingsScreenProps.onImportGpx();
  });

  expect(callOrder).toEqual([
    'alert:GPXインポートと実績について:GPXインポートでは、総移動距離や記録日数など一部の実績だけが判定対象になります。訪問した地域など、実際の記録中に確認する実績には反映されません。',
    'pick',
  ]);
  expect(pickAndReadGpxFile).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- src/app/__tests__/AppMapReturn.test.tsx --runInBand
```

Expected: FAIL. The new test should fail because `callOrder` only contains `pick`, or because the expected achievement notice Alert is missing before `pick`.

- [ ] **Step 3: Add the minimal implementation**

In `src/app/App.tsx`, update `importGpx()` by inserting the Alert after import state is set and before `pickAndReadGpxFile()`:

```typescript
    try {
      Alert.alert(
        'GPXインポートと実績について',
        'GPXインポートでは、総移動距離や記録日数など一部の実績だけが判定対象になります。訪問した地域など、実際の記録中に確認する実績には反映されません。',
      );
      const pickedFile = await pickAndReadGpxFile();
```

Do not change the existing empty-file, success, failure, or cancellation branches.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npm test -- src/app/__tests__/AppMapReturn.test.tsx --runInBand
```

Expected: PASS for `AppMapReturn.test.tsx`.

- [ ] **Step 5: Run related tests**

Run:

```bash
npm test -- src/app/__tests__/AppMapReturn.test.tsx src/app/components/__tests__/SettingsScreen.test.tsx src/features/import/__tests__/gpxImportService.test.ts --runInBand
```

Expected: PASS. This confirms App flow, Settings import button wiring, and GPX file picking remain compatible.

- [ ] **Step 6: Typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS, unless the repository still has known unrelated baseline typecheck failures. If it fails, inspect the file paths and confirm whether failures are related to this change before proceeding.

- [ ] **Step 7: Commit implementation**

Run:

```bash
git add src/app/App.tsx src/app/__tests__/AppMapReturn.test.tsx
git commit -m "feat(import): GPXインポート前に実績注意を表示"
```

Expected: Commit succeeds with only the App implementation and App test changes.

## Task 2: Final Verification

**Files:**

- Inspect: `src/app/App.tsx`
- Inspect: `src/app/__tests__/AppMapReturn.test.tsx`

- [ ] **Step 1: Review changed files**

Run:

```bash
git diff --stat HEAD~2..HEAD
git diff HEAD~1 -- src/app/App.tsx src/app/__tests__/AppMapReturn.test.tsx
```

Expected: The design commit plus implementation commit are present, and the implementation diff only adds the alert notice and the corresponding App test.

- [ ] **Step 2: Check working tree**

Run:

```bash
git status --short
```

Expected: no output.

- [ ] **Step 3: Prepare PR summary**

Use this summary if opening a PR:

```markdown
## 変更内容

- GPXインポート押下直後、ファイル選択前に実績反映範囲の注意Alertを表示
- AppのGPXインポートフローで、注意Alertがファイル選択より先に出ることをテスト

## 理由

- GPXインポートでは総移動距離や記録日数など一部の実績は判定される一方、訪問地域など実際の記録中に確認する実績には反映されないため

## 影響範囲

- 設定画面からのGPXインポート開始時の表示のみ
- GPXパース、保存、完了/失敗Alert、実績判定ロジックは変更なし

## 検証

- `npm test -- src/app/__tests__/AppMapReturn.test.tsx --runInBand`
- `npm test -- src/app/__tests__/AppMapReturn.test.tsx src/app/components/__tests__/SettingsScreen.test.tsx src/features/import/__tests__/gpxImportService.test.ts --runInBand`
- `npm run typecheck`
```
