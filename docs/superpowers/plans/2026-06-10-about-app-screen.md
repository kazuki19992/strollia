# About App Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 設定画面配下に「このアプリについて」子画面を追加し、アプリアイコンと説明本文を表示する。

**Architecture:** 既存の設定内 `SettingsStack` に `AboutApp` 画面を追加する。画面本体は `AboutAppScreen.tsx` に分離し、設定ホームからは `SettingsScreen` の props 経由で遷移する。

**Tech Stack:** React Native, Expo, React Navigation native stack, Jest, react-test-renderer.

---

### Task 1: 設定画面の導線

**Files:**
- Modify: `src/app/components/SettingsScreen.tsx`
- Test: `src/app/components/__tests__/SettingsScreen.test.tsx`

- [x] **Step 1: Write the failing test**

`createProps()` に `onOpenAboutAppScreen: jest.fn()` を追加し、次のテストを追加する。

```tsx
test('このアプリについてをライセンスより上に表示して開ける', () => {
  const props = createProps();
  let renderer: any;

  act(() => {
    renderer = ReactTestRenderer.create(<SettingsScreen {...props} />);
  });

  const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
  const aboutIndex = texts.indexOf('このアプリについて');
  const licenseIndex = texts.indexOf('オープンソースライセンス');

  expect(aboutIndex).toBeGreaterThanOrEqual(0);
  expect(licenseIndex).toBeGreaterThanOrEqual(0);
  expect(aboutIndex).toBeLessThan(licenseIndex);

  const aboutButton = renderer.root.findAll((node: any) => node.props.onPress === props.onOpenAboutAppScreen)[0];

  act(() => {
    aboutButton.props.onPress();
  });

  expect(props.onOpenAboutAppScreen).toHaveBeenCalledTimes(1);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- SettingsScreen.test.tsx --runInBand`

Expected: 「このアプリについて」が見つからず失敗する。

- [x] **Step 3: Implement settings entry**

`SettingsScreenProps` に `onOpenAboutAppScreen: () => void` を追加し、アプリ情報セクションでライセンスボタンの上に `ActionPill` を追加する。

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- SettingsScreen.test.tsx --runInBand`

Expected: PASS.

### Task 2: このアプリについて画面

**Files:**
- Create: `src/app/components/AboutAppScreen.tsx`
- Test: `src/app/components/__tests__/AboutAppScreen.test.tsx`
- Modify: `src/app/appStyles.ts`

- [x] **Step 1: Write the failing test**

`AboutAppScreen` がタイトル、戻る導線、アプリアイコン、本文の主要文言を表示するテストを作る。

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- AboutAppScreen.test.tsx --runInBand`

Expected: モジュール未作成で失敗する。

- [x] **Step 3: Implement screen**

`AboutAppScreen` で `AppScreenHeader`、`ScrollView`、`Image`、本文セクションを描画する。アイコンは `require('../../../assets/icon.png')` を使う。

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- AboutAppScreen.test.tsx --runInBand`

Expected: PASS.

### Task 3: Navigation wiring and verification

**Files:**
- Modify: `src/app/App.tsx`

- [x] **Step 1: Wire navigation**

`SettingsStackParamList` に `AboutApp: undefined` を追加し、`SettingsHome` から `navigation.navigate('AboutApp')` を渡す。`SettingsStack.Screen name="AboutApp"` で `AboutAppScreen` を描画する。

- [x] **Step 2: Run focused tests**

Run: `npm test -- SettingsScreen.test.tsx AboutAppScreen.test.tsx --runInBand`

Expected: PASS.

- [x] **Step 3: Run typecheck**

Run: `npm run typecheck`

Result: 既存テストファイルの型エラーで失敗。今回追加した `AboutAppScreen` 由来の型エラーはなし。

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-06-10-about-app-screen-design.md docs/superpowers/plans/2026-06-10-about-app-screen.md src/app/App.tsx src/app/appStyles.ts src/app/components/AboutAppScreen.tsx src/app/components/SettingsScreen.tsx src/app/components/__tests__/AboutAppScreen.test.tsx src/app/components/__tests__/SettingsScreen.test.tsx
git commit -m "feat(settings): このアプリについて画面を追加"
```
