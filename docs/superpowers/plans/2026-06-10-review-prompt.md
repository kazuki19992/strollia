# 200km実績後のApp Storeレビュー促進 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 総移動距離200km実績（`distance-200`）の解除ダイアログを閉じたときに、システム標準のApp Storeレビュー促進ダイアログを一度だけ表示する。

**Architecture:** 判定は純粋関数 `shouldRequestReviewAfterAchievement` に切り出し、`expo-store-review` の呼び出しは薄いラッパー `requestStoreReview` に分離。App.tsxの `closeAchievementUnlockModal` で配線し、重複は設定フラグで防ぐ。

**Tech Stack:** React Native / Expo (expo-store-review 新規), TypeScript, Jest

参照spec: `docs/superpowers/specs/2026-06-10-review-prompt-design.md`

---

## File Structure

- **新規** `src/features/review/reviewPromptLogic.ts` — 判定純粋関数・定数
- **新規** `src/features/review/storeReview.ts` — expo-store-reviewラッパー
- **新規** `src/features/review/__tests__/reviewPromptLogic.test.ts`
- **新規** `src/features/review/__tests__/storeReview.test.ts`
- **改修** `src/app/App.tsx` — state・設定読込・closeAchievementUnlockModal配線
- **改修** `package.json` — expo-store-review追加

テストコマンド: `npx jest`

---

### Task 1: expo-store-review インストール

**Files:**
- Modify: `package.json`（自動）

- [ ] **Step 1: インストール**

```bash
npx expo install expo-store-review
```

- [ ] **Step 2: 確認**

```bash
node -e "console.log(require('./package.json').dependencies['expo-store-review'])"
```

Expected: バージョン文字列が出力される。

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: expo-store-reviewをインストールする"
```

---

### Task 2: レビュー促進の判定ロジック

**Files:**
- Create: `src/features/review/reviewPromptLogic.ts`
- Test: `src/features/review/__tests__/reviewPromptLogic.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/features/review/__tests__/reviewPromptLogic.test.ts`:

```typescript
import { REVIEW_PROMPT_ACHIEVEMENT_ID, shouldRequestReviewAfterAchievement } from '../reviewPromptLogic';

describe('レビュー促進判定 shouldRequestReviewAfterAchievement', () => {
  it('トリガー実績IDはdistance-200', () => {
    expect(REVIEW_PROMPT_ACHIEVEMENT_ID).toBe('distance-200');
  });

  it('distance-200を閉じ・キュー空・未促進なら促す', () => {
    expect(
      shouldRequestReviewAfterAchievement({
        dismissedAchievementId: 'distance-200',
        hasPendingNotifications: false,
        hasAlreadyPrompted: false,
      }),
    ).toBe(true);
  });

  it('別の実績IDなら促さない', () => {
    expect(
      shouldRequestReviewAfterAchievement({
        dismissedAchievementId: 'distance-100',
        hasPendingNotifications: false,
        hasAlreadyPrompted: false,
      }),
    ).toBe(false);
  });

  it('他の実績通知が残っていれば促さない', () => {
    expect(
      shouldRequestReviewAfterAchievement({
        dismissedAchievementId: 'distance-200',
        hasPendingNotifications: true,
        hasAlreadyPrompted: false,
      }),
    ).toBe(false);
  });

  it('既に促進済みなら促さない', () => {
    expect(
      shouldRequestReviewAfterAchievement({
        dismissedAchievementId: 'distance-200',
        hasPendingNotifications: false,
        hasAlreadyPrompted: true,
      }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: テスト実行（FAIL確認）**

```bash
npx jest src/features/review/__tests__/reviewPromptLogic.test.ts
```

Expected: FAIL（モジュール未存在）

- [ ] **Step 3: 実装**

`src/features/review/reviewPromptLogic.ts`:

```typescript
/** レビュー促進のトリガーとなる実績ID（総移動距離200km）。 */
export const REVIEW_PROMPT_ACHIEVEMENT_ID = 'distance-200';

/** レビュー促進を出すべきか判定するための文脈。 */
export type ReviewPromptContext = {
  /** 閉じた実績のID。 */
  dismissedAchievementId: string;
  /** まだ未表示の実績通知が残っているか。 */
  hasPendingNotifications: boolean;
  /** 既にレビュー促進済みか。 */
  hasAlreadyPrompted: boolean;
};

/**
 * 実績解除ダイアログを閉じた後にレビュー促進を出すべきか判定する。
 *
 * 総移動距離200km（`distance-200`）を閉じ、連続表示中の他の実績通知が残っておらず、
 * まだ一度も促していない場合にのみtrueを返す。
 *
 * @param context - 判定に使う文脈。
 * @returns レビュー促進を要求すべきならtrue。
 */
export function shouldRequestReviewAfterAchievement(context: ReviewPromptContext): boolean {
  return (
    context.dismissedAchievementId === REVIEW_PROMPT_ACHIEVEMENT_ID &&
    !context.hasPendingNotifications &&
    !context.hasAlreadyPrompted
  );
}
```

- [ ] **Step 4: テスト実行（PASS確認）**

```bash
npx jest src/features/review/__tests__/reviewPromptLogic.test.ts
```

Expected: PASS（5テスト）

- [ ] **Step 5: Commit**

```bash
git add src/features/review/reviewPromptLogic.ts src/features/review/__tests__/reviewPromptLogic.test.ts
git commit -m "feat(review): レビュー促進の判定ロジックを追加する"
```

---

### Task 3: expo-store-review ラッパー

**Files:**
- Create: `src/features/review/storeReview.ts`
- Test: `src/features/review/__tests__/storeReview.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/features/review/__tests__/storeReview.test.ts`:

```typescript
const mockIsAvailableAsync = jest.fn();
const mockRequestReview = jest.fn();

jest.mock('expo-store-review', () => ({
  isAvailableAsync: (...args: unknown[]) => mockIsAvailableAsync(...args),
  requestReview: (...args: unknown[]) => mockRequestReview(...args),
}));

import { requestStoreReview } from '../storeReview';

describe('ストアレビュー要求 requestStoreReview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestReview.mockResolvedValue(undefined);
  });

  it('利用可能なときrequestReviewを呼ぶ', async () => {
    mockIsAvailableAsync.mockResolvedValue(true);

    await requestStoreReview();

    expect(mockRequestReview).toHaveBeenCalledTimes(1);
  });

  it('利用不可のときrequestReviewを呼ばない', async () => {
    mockIsAvailableAsync.mockResolvedValue(false);

    await requestStoreReview();

    expect(mockRequestReview).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: テスト実行（FAIL確認）**

```bash
npx jest src/features/review/__tests__/storeReview.test.ts
```

Expected: FAIL（モジュール未存在）

- [ ] **Step 3: 実装**

`src/features/review/storeReview.ts`:

```typescript
import * as StoreReview from 'expo-store-review';

/**
 * 利用可能ならシステム標準のApp Storeレビュー促進ダイアログを要求する。
 *
 * 実際の表示頻度はOSが制御するため、呼び出しても必ず表示されるとは限らない。
 *
 * @returns レビュー要求の完了を表すPromise。
 */
export async function requestStoreReview(): Promise<void> {
  if (!(await StoreReview.isAvailableAsync())) {
    return;
  }

  await StoreReview.requestReview();
}
```

- [ ] **Step 4: テスト実行（PASS確認）**

```bash
npx jest src/features/review/__tests__/storeReview.test.ts
```

Expected: PASS（2テスト）

- [ ] **Step 5: Commit**

```bash
git add src/features/review/storeReview.ts src/features/review/__tests__/storeReview.test.ts
git commit -m "feat(review): expo-store-reviewラッパーを追加する"
```

---

### Task 4: App.tsx への配線

**Files:**
- Modify: `src/app/App.tsx`

- [ ] **Step 1: imports と定数を追加**

imports（既存featureインポート群の近く）に追加:

```typescript
import { shouldRequestReviewAfterAchievement } from '../features/review/reviewPromptLogic';
import { requestStoreReview } from '../features/review/storeReview';
```

定数（`CUSTOM_ICON_IMAGE_URI_SETTING_KEY` の近く、`src/app/App.tsx:131` 付近）に追加:

```typescript
const REVIEW_PROMPTED_SETTING_KEY = 'reviewPrompted';
```

- [ ] **Step 2: state を追加**

`customIconImageUri` state の近くに追加:

```typescript
  const [hasPromptedReview, setHasPromptedReview] = useState(false);
```

- [ ] **Step 3: 設定読み込みに追加**

`Promise.all`（`src/app/App.tsx:472-478` 付近）へ `getBooleanSetting` を追加し、結果を反映する。

`Promise.all` の配列末尾に追加:

```typescript
          getBooleanSetting(REVIEW_PROMPTED_SETTING_KEY, false),
```

分割代入の末尾に `savedReviewPrompted` を追加し、setterを呼ぶ:

```typescript
        const [savedKeepScreenAwake, savedShowPhotosOnMap, savedUserLocationIcon, savedAppColorPresetId, savedCustomIconImageUri, savedReviewPrompted] = await Promise.all([
          getBooleanSetting(KEEP_SCREEN_AWAKE_SETTING_KEY, false),
          getBooleanSetting(SHOW_PHOTOS_ON_MAP_SETTING_KEY, false),
          getStringSetting(USER_LOCATION_ICON_SETTING_KEY, DEFAULT_USER_LOCATION_ICON_ID),
          getStringSetting(APP_COLOR_PRESET_SETTING_KEY, DEFAULT_APP_COLOR_PRESET_ID),
          getStringSetting(CUSTOM_ICON_IMAGE_URI_SETTING_KEY, ''),
          getBooleanSetting(REVIEW_PROMPTED_SETTING_KEY, false),
        ]);
```

setter群（`setCustomIconImageUri(...)` の後）に追加:

```typescript
        setHasPromptedReview(savedReviewPrompted);
```

- [ ] **Step 4: closeAchievementUnlockModal を更新**

`src/app/App.tsx:886-896` の関数を以下へ置き換え:

```typescript
  /** 実績解除モーダルを閉じ、次の未表示実績があれば続けて表示する。 */
  function closeAchievementUnlockModal(): void {
    const current = activeAchievementNotification;

    if (!current) {
      return;
    }

    const hasPendingAfterClose = pendingAchievementNotifications.length > 1;

    dismissedAchievementQueueIdsRef.current.add(current.queueId);
    markAchievementShownInApp(current.queueId).catch(() => undefined);
    setPendingAchievementNotifications((notifications) => notifications.slice(1));

    if (
      shouldRequestReviewAfterAchievement({
        dismissedAchievementId: current.definition.id,
        hasPendingNotifications: hasPendingAfterClose,
        hasAlreadyPrompted: hasPromptedReview,
      })
    ) {
      setHasPromptedReview(true);
      setSetting(REVIEW_PROMPTED_SETTING_KEY, true).catch((error: unknown) => {
        console.warn('Failed to persist review prompted flag:', error);
      });
      // ダイアログ退場アニメーション（約500ms）と被らないよう少し遅らせて要求する。
      setTimeout(() => {
        requestStoreReview().catch((error: unknown) => {
          console.warn('Failed to request store review:', error);
        });
      }, 700);
    }
  }
```

- [ ] **Step 5: 全テスト実行**

```bash
npx jest
```

Expected: PASS（既存テストに回帰なし）

- [ ] **Step 6: 型チェック**

```bash
npx tsc --noEmit 2>&1 | grep -v "importRepository.test" | head
```

Expected: App.tsx に型エラーなし。

- [ ] **Step 7: Commit**

```bash
git add src/app/App.tsx
git commit -m "feat(review): 200km実績を閉じたらレビュー促進を要求する"
```

---

## 完了後

全タスク完了後、`superpowers:finishing-a-development-branch` スキルでテスト確認・ブランチ完了処理を行う。
