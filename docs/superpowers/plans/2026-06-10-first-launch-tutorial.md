# First Launch Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 初回起動時だけ、共通 `Dialog` を使った4ステップのチュートリアルを表示し、最後に地図上の赤い権限付与パネルへ誘導する。

**Architecture:** `FirstLaunchTutorialDialog` は表示ステップと本文だけを持ち、枠・閉じるボタン・アニメーションは既存 `Dialog` に委譲する。表示済みフラグは既存 `app_settings` に `firstLaunchTutorialCompleted` として保存し、`App.tsx` の初期化で読み込む。ユーザー向け挙動の追加として `docs/mvp.md` も更新する。

**Tech Stack:** Expo / React Native / TypeScript / Jest / react-test-renderer / expo-sqlite settings repository

---

## File Structure

- Create: `src/app/components/FirstLaunchTutorialDialog.tsx`
  - 初回チュートリアルの4ステップ本文、現在ステップ、次へ/完了ボタンを担当する。
- Create: `src/app/components/__tests__/FirstLaunchTutorialDialog.test.tsx`
  - ステップ遷移、完了、閉じる、スワイプヒント非表示を検証する。
- Modify: `src/app/App.tsx`
  - `firstLaunchTutorialCompleted` の読み込み、表示 state、完了保存、ルート描画への組み込みを担当する。
- Modify: `src/app/__tests__/AppMapReturn.test.tsx`
  - 初回チュートリアルの表示・保存・非表示を App 統合で検証する。
- Modify: `src/app/appStyles.ts`
  - チュートリアル本文・ボタン用の最小限の共通スタイルを追加する。
- Modify: `docs/mvp.md`
  - 初回チュートリアルと赤い権限付与パネルへの誘導を記載する。

---

### Task 1: FirstLaunchTutorialDialog

**Files:**
- Create: `src/app/components/FirstLaunchTutorialDialog.tsx`
- Create: `src/app/components/__tests__/FirstLaunchTutorialDialog.test.tsx`
- Modify: `src/app/appStyles.ts`

- [ ] **Step 1: Write the failing component tests**

Create `src/app/components/__tests__/FirstLaunchTutorialDialog.test.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';

import { createStyles } from '../../appStyles';
import { lightTheme } from '../../../theme/theme';
import { FirstLaunchTutorialDialog } from '../FirstLaunchTutorialDialog';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Feather: Text, MaterialCommunityIcons: Text };
});

jest.mock('../ConfettiOverlay', () => ({ ConfettiOverlay: () => null }));

const { act, create } = require('react-test-renderer') as {
  act: (callback: () => void) => void;
  create: (element: ReactNode) => { root: any; unmount: () => void };
};

const styles = createStyles(lightTheme);

let renderer: { root: any; unmount: () => void } | null = null;

function visibleTexts(): unknown[] {
  return renderer!.root.findAllByType(Text).map((node: any) => node.props.children);
}

function press(label: string): void {
  const button = renderer!.root.findByProps({ accessibilityLabel: label });
  act(() => {
    button.props.onPress();
  });
}

describe('初回起動チュートリアル FirstLaunchTutorialDialog', () => {
  afterEach(() => {
    act(() => {
      renderer?.unmount();
    });
    renderer = null;
  });

  test('最初にアプリ説明を表示する', () => {
    act(() => {
      renderer = create(<FirstLaunchTutorialDialog visible styles={styles} onComplete={jest.fn()} />);
    });

    expect(visibleTexts()).toContain('すとろりあへようこそ');
    expect(visibleTexts()).toContain('1 / 4');
    expect(visibleTexts()).toContain('すとろりあは、歩いた場所や移動した道のりを端末内に記録するGPSロガーです。記録したデータは、あなたの明示操作なしに外部へ送信しません。');
  });

  test('次へを押すと画面下の項目、実績、権限案内の順に進む', () => {
    act(() => {
      renderer = create(<FirstLaunchTutorialDialog visible styles={styles} onComplete={jest.fn()} />);
    });

    press('次へ');
    expect(visibleTexts()).toContain('画面下の項目');
    expect(visibleTexts()).toContain('2 / 4');

    press('次へ');
    expect(visibleTexts()).toContain('実績を集める');
    expect(visibleTexts()).toContain('3 / 4');

    press('次へ');
    expect(visibleTexts()).toContain('権限を付与してはじめる');
    expect(visibleTexts()).toContain('4 / 4');
    expect(visibleTexts()).toContain('まずは位置情報の権限を付与してはじめましょう。チュートリアルを閉じたあと、地図上に表示される赤い権限付与パネルのボタンを押してください。');
  });

  test('最後のボタンで onComplete を呼ぶ', () => {
    const onComplete = jest.fn();
    act(() => {
      renderer = create(<FirstLaunchTutorialDialog visible styles={styles} onComplete={onComplete} />);
    });

    press('次へ');
    press('次へ');
    press('次へ');
    press('地図で確認する');

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test('閉じるボタンで onComplete を呼ぶ', () => {
    const onComplete = jest.fn();
    act(() => {
      renderer = create(<FirstLaunchTutorialDialog visible styles={styles} onComplete={onComplete} />);
    });

    const closeButton = renderer!.root.findByProps({ accessibilityLabel: '閉じる' });
    act(() => {
      closeButton.props.onPress();
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test('スワイプヒントを表示しない', () => {
    act(() => {
      renderer = create(<FirstLaunchTutorialDialog visible styles={styles} onComplete={jest.fn()} />);
    });

    expect(visibleTexts()).not.toContain('スワイプで閉じる');
  });
});
```

- [ ] **Step 2: Run component test to verify it fails**

Run:

```bash
npm test -- src/app/components/__tests__/FirstLaunchTutorialDialog.test.tsx --runInBand
```

Expected: FAIL because `../FirstLaunchTutorialDialog` does not exist.

- [ ] **Step 3: Add tutorial styles**

Modify `src/app/appStyles.ts` inside `StyleSheet.create({ ... })`, near `dialogSwipeHint`:

```ts
    firstLaunchTutorialStepText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '400',
      textAlign: 'center',
    },
    firstLaunchTutorialTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '400',
      lineHeight: 28,
      textAlign: 'center',
    },
    firstLaunchTutorialDescription: {
      color: colors.mutedText,
      fontSize: 15,
      fontWeight: '400',
      lineHeight: 22,
      textAlign: 'center',
    },
    firstLaunchTutorialActions: {
      alignSelf: 'stretch',
      gap: 10,
      paddingTop: 4,
    },
    firstLaunchTutorialButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 999,
      justifyContent: 'center',
      paddingHorizontal: 18,
      paddingVertical: 14,
    },
    firstLaunchTutorialButtonText: {
      color: colors.primaryText,
      fontSize: 15,
      fontWeight: '400',
    },
```

- [ ] **Step 4: Implement FirstLaunchTutorialDialog**

Create `src/app/components/FirstLaunchTutorialDialog.tsx`:

```tsx
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { AppStyles } from '../appStyles';
import { Dialog } from './Dialog';

/** 初回起動チュートリアルの1ステップ分の表示内容。 */
type TutorialStep = {
  /** 見出し。 */
  title: string;
  /** 本文。 */
  description: string;
};

/** 初回起動チュートリアルのprops。 */
export type FirstLaunchTutorialDialogProps = {
  /** 表示状態。 */
  visible: boolean;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** チュートリアル完了時に呼ぶ。 */
  onComplete: () => void;
};

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'すとろりあへようこそ',
    description: 'すとろりあは、歩いた場所や移動した道のりを端末内に記録するGPSロガーです。記録したデータは、あなたの明示操作なしに外部へ送信しません。',
  },
  {
    title: '画面下の項目',
    description: '画面下から、日ごとの記録、実績、月ごとのレポート、設定を開けます。普段は地図を見ながら、必要なときに各項目を確認できます。',
  },
  {
    title: '実績を集める',
    description: '移動距離や訪問した地域、記録日数に応じて実績が解除されます。続けて使うほど、自分の移動の積み重ねが見えるようになります。',
  },
  {
    title: '権限を付与してはじめる',
    description: 'まずは位置情報の権限を付与してはじめましょう。チュートリアルを閉じたあと、地図上に表示される赤い権限付与パネルのボタンを押してください。',
  },
];

/** 初回起動時にアプリの使い始めを案内するダイアログ。 */
export function FirstLaunchTutorialDialog({ visible, styles, onComplete }: FirstLaunchTutorialDialogProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = TUTORIAL_STEPS[stepIndex];
  const isLastStep = stepIndex === TUTORIAL_STEPS.length - 1;
  const actionLabel = isLastStep ? '地図で確認する' : '次へ';

  /** 次の説明へ進み、最後の説明では完了する。 */
  function handlePrimaryAction(): void {
    if (isLastStep) {
      onComplete();
      return;
    }

    setStepIndex((index) => Math.min(index + 1, TUTORIAL_STEPS.length - 1));
  }

  return (
    <Dialog visible={visible} autoClose={false} swipeToClose={false} styles={styles} onClose={onComplete}>
      <Text style={styles.firstLaunchTutorialStepText}>{`${stepIndex + 1} / ${TUTORIAL_STEPS.length}`}</Text>
      <Text style={styles.firstLaunchTutorialTitle}>{currentStep.title}</Text>
      <Text style={styles.firstLaunchTutorialDescription}>{currentStep.description}</Text>
      <View style={styles.firstLaunchTutorialActions}>
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          onPress={handlePrimaryAction}
          style={styles.firstLaunchTutorialButton}
        >
          <Text style={styles.firstLaunchTutorialButtonText}>{actionLabel}</Text>
        </Pressable>
      </View>
    </Dialog>
  );
}
```

- [ ] **Step 5: Run component test to verify it passes**

Run:

```bash
npm test -- src/app/components/__tests__/FirstLaunchTutorialDialog.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

Run:

```bash
git add src/app/components/FirstLaunchTutorialDialog.tsx src/app/components/__tests__/FirstLaunchTutorialDialog.test.tsx src/app/appStyles.ts
git commit -m "feat(onboarding): 初回チュートリアルダイアログを追加"
```

Expected: commit succeeds.

---

### Task 2: App Integration

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/__tests__/AppMapReturn.test.tsx`

- [ ] **Step 1: Write failing App integration tests**

Modify `src/app/__tests__/AppMapReturn.test.tsx`:

1. Add imports:

```ts
import { getBooleanSetting, setSetting } from '../../features/settings/settingsRepository';
```

2. Add a component mock after `AchievementUnlockModal` mock:

```tsx
jest.mock('../components/FirstLaunchTutorialDialog', () => ({
  FirstLaunchTutorialDialog: (props: any) => {
    const { Pressable, Text } = require('react-native');

    if (!props.visible) return null;

    return (
      <Pressable accessibilityLabel="初回チュートリアルを完了" onPress={props.onComplete}>
        <Text>初回チュートリアル</Text>
      </Pressable>
    );
  },
}));
```

3. Add reset in `beforeEach`:

```ts
(getBooleanSetting as jest.Mock).mockImplementation((key: string, fallback: boolean) => {
  if (key === 'firstLaunchTutorialCompleted') {
    return Promise.resolve(false);
  }

  return Promise.resolve(fallback);
});
(setSetting as jest.Mock).mockResolvedValue(undefined);
```

4. Add tests near the other App initialization tests:

```tsx
  test('初回チュートリアル未完了の場合は初回チュートリアルを表示する', async () => {
    let renderer: any;
    await act(async () => {
      renderer = create(<App />);
    });

    expect(renderer.root.findByProps({ accessibilityLabel: '初回チュートリアルを完了' })).toBeTruthy();
  });

  test('初回チュートリアル完了時に表示済み設定を保存する', async () => {
    let renderer: any;
    await act(async () => {
      renderer = create(<App />);
    });

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: '初回チュートリアルを完了' }).props.onPress();
    });

    expect(setSetting).toHaveBeenCalledWith('firstLaunchTutorialCompleted', true);
  });

  test('初回チュートリアル完了済みの場合は表示しない', async () => {
    (getBooleanSetting as jest.Mock).mockImplementation((key: string, fallback: boolean) => {
      if (key === 'firstLaunchTutorialCompleted') {
        return Promise.resolve(true);
      }

      return Promise.resolve(fallback);
    });

    let renderer: any;
    await act(async () => {
      renderer = create(<App />);
    });

    expect(renderer.root.findAllByProps({ accessibilityLabel: '初回チュートリアルを完了' })).toHaveLength(0);
  });
```

- [ ] **Step 2: Run App test to verify it fails**

Run:

```bash
npm test -- src/app/__tests__/AppMapReturn.test.tsx --runInBand
```

Expected: FAIL because `FirstLaunchTutorialDialog` is not imported/rendered by `App.tsx`, and `setSetting('firstLaunchTutorialCompleted', true)` is not called.

- [ ] **Step 3: Integrate tutorial state in App**

Modify `src/app/App.tsx`:

1. Add import:

```ts
import { FirstLaunchTutorialDialog } from './components/FirstLaunchTutorialDialog';
```

2. Add setting key near the other setting keys:

```ts
/** 初回起動チュートリアル完了状態をSQLiteへ保存するキー。 */
const FIRST_LAUNCH_TUTORIAL_COMPLETED_SETTING_KEY = 'firstLaunchTutorialCompleted';
```

3. Add state near the other modal/state values:

```ts
  const [isFirstLaunchTutorialVisible, setIsFirstLaunchTutorialVisible] = useState(false);
```

4. Include the setting in initialization:

```ts
        const [
          savedKeepScreenAwake,
          savedShowPhotosOnMap,
          savedUserLocationIcon,
          savedAppColorPresetId,
          savedCustomIconImageUri,
          savedReviewPrompted,
          savedFirstLaunchTutorialCompleted,
        ] = await Promise.all([
          getBooleanSetting(KEEP_SCREEN_AWAKE_SETTING_KEY, false),
          getBooleanSetting(SHOW_PHOTOS_ON_MAP_SETTING_KEY, false),
          getStringSetting(USER_LOCATION_ICON_SETTING_KEY, DEFAULT_USER_LOCATION_ICON_ID),
          getStringSetting(APP_COLOR_PRESET_SETTING_KEY, DEFAULT_APP_COLOR_PRESET_ID),
          getStringSetting(CUSTOM_ICON_IMAGE_URI_SETTING_KEY, ''),
          getBooleanSetting(REVIEW_PROMPTED_SETTING_KEY, false),
          getBooleanSetting(FIRST_LAUNCH_TUTORIAL_COMPLETED_SETTING_KEY, false),
        ]);
```

After `await refreshAchievementState(true);`, add:

```ts
        if (!savedFirstLaunchTutorialCompleted) {
          setIsFirstLaunchTutorialVisible(true);
        }
```

5. Add completion handler before render:

```ts
  /** 初回チュートリアルを閉じ、次回以降は表示しないよう保存する。 */
  function completeFirstLaunchTutorial(): void {
    setIsFirstLaunchTutorialVisible(false);
    setSetting(FIRST_LAUNCH_TUTORIAL_COMPLETED_SETTING_KEY, true).catch((error: unknown) => {
      console.warn('Failed to persist first launch tutorial flag:', error);
    });
  }
```

6. Render the tutorial near other root modals:

```tsx
      <FirstLaunchTutorialDialog
        visible={isFirstLaunchTutorialVisible}
        styles={styles}
        onComplete={completeFirstLaunchTutorial}
      />
```

- [ ] **Step 4: Run App test to verify it passes**

Run:

```bash
npm test -- src/app/__tests__/AppMapReturn.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 5: Run focused component + App tests**

Run:

```bash
npm test -- src/app/components/__tests__/FirstLaunchTutorialDialog.test.tsx src/app/__tests__/AppMapReturn.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

Run:

```bash
git add src/app/App.tsx src/app/__tests__/AppMapReturn.test.tsx
git commit -m "feat(onboarding): 初回チュートリアルを起動時に表示"
```

Expected: commit succeeds.

---

### Task 3: Docs and Verification

**Files:**
- Modify: `docs/mvp.md`

- [ ] **Step 1: Update MVP docs**

Modify `docs/mvp.md`:

1. In `## 2. MVPの範囲`, add:

```md
- 初回起動時のチュートリアルダイアログ
```

2. In `## 3. 記録方式`, after the current first paragraph, add:

```md
初回起動時は、共通ダイアログでアプリ概要、画面下の主要項目、実績システム、位置情報権限の開始導線を順番に案内する。権限要求はチュートリアル内では実行せず、チュートリアルを閉じたあとに地図上の赤い権限付与パネルのボタンを押すよう誘導する。
```

3. In `## 5. 成功条件`, add:

```md
- 初回起動時にチュートリアルを確認でき、次回起動以降は再表示されない
```

- [ ] **Step 2: Run all Jest tests**

Run:

```bash
npm test -- --runInBand
```

Expected: PASS.

- [ ] **Step 3: Run typecheck and record baseline**

Run:

```bash
npm run typecheck
```

Expected: It may FAIL with the known baseline errors in `src/app/components/__tests__/achievementGridStyles.test.ts` and `src/features/import/__tests__/importRepository.test.ts`. If new errors mention files changed by this task, fix them before committing.

- [ ] **Step 4: Inspect changed files**

Run:

```bash
git diff --stat
git diff -- src/app/components/FirstLaunchTutorialDialog.tsx src/app/components/__tests__/FirstLaunchTutorialDialog.test.tsx src/app/App.tsx src/app/__tests__/AppMapReturn.test.tsx src/app/appStyles.ts docs/mvp.md
```

Expected: diff only contains first-launch tutorial implementation, tests, styles, and docs.

- [ ] **Step 5: Commit Task 3**

Run:

```bash
git add docs/mvp.md
git commit -m "docs: 初回チュートリアルの仕様を追記"
```

Expected: commit succeeds.

---

### Task 4: Final Branch Verification

**Files:**
- Read-only verification across the branch.

- [ ] **Step 1: Check status**

Run:

```bash
git status --short
```

Expected: clean worktree.

- [ ] **Step 2: Review commit stack**

Run:

```bash
git log --oneline --decorate -4
```

Expected: latest commits include:

```text
docs: 初回チュートリアルの仕様を追記
feat(onboarding): 初回チュートリアルを起動時に表示
feat(onboarding): 初回チュートリアルダイアログを追加
docs: 初回起動チュートリアル設計を追加
```

- [ ] **Step 3: Final test command**

Run:

```bash
npm test -- --runInBand
```

Expected: PASS.

- [ ] **Step 4: Final typecheck command**

Run:

```bash
npm run typecheck
```

Expected: Either PASS, or the same known baseline failures only:

```text
src/app/components/__tests__/achievementGridStyles.test.ts(22,44): error TS2339: Property 'backgroundColor' does not exist ...
src/app/components/__tests__/achievementGridStyles.test.ts(23,44): error TS2339: Property 'borderWidth' does not exist ...
src/features/import/__tests__/importRepository.test.ts(5,9): error TS7022: 'mockDb' implicitly has type 'any' ...
src/features/import/__tests__/importRepository.test.ts(9,44): error TS7024: Function implicitly has return type 'any' ...
src/features/import/__tests__/importRepository.test.ts(9,62): error TS2502: 'txn' is referenced directly or indirectly ...
```
