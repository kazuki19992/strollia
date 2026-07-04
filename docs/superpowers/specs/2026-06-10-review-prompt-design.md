# 200km実績解除後のApp Storeレビュー促進 設計

## 概要

総移動距離200km（実績ID `distance-200`）を解除し、その実績解除ダイアログを閉じたときに、システム標準のApp Storeレビュー促進ダイアログ（`expo-store-review`）を表示する。重複表示は設定フラグで防ぐ。

## ライブラリ

- `expo-store-review` — iOSの `SKStoreReviewController` を使うシステム標準レビューダイアログ。
  - `StoreReview.isAvailableAsync()` で利用可否を確認
  - `StoreReview.requestReview()` でダイアログ要求（表示頻度はOSが制御）

## トリガー条件（純粋関数で判定）

`shouldRequestReviewAfterAchievement` を新規モジュール `src/features/review/reviewPromptLogic.ts` に定義し、テスト可能にする。

```typescript
export type ReviewPromptContext = {
  /** 閉じた実績のID。 */
  dismissedAchievementId: string;
  /** まだ未表示の実績通知が残っているか。 */
  hasPendingNotifications: boolean;
  /** 既にレビュー促進済みか。 */
  hasAlreadyPrompted: boolean;
};

/**
 * 実績ダイアログを閉じた後にレビュー促進を出すべきか判定する。
 * - distance-200（総移動距離200km）を閉じたとき
 * - 連続表示中の他の実績通知が残っていない
 * - まだ一度も促していない
 */
export function shouldRequestReviewAfterAchievement(context: ReviewPromptContext): boolean {
  return context.dismissedAchievementId === REVIEW_PROMPT_ACHIEVEMENT_ID && !context.hasPendingNotifications && !context.hasAlreadyPrompted;
}

/** レビュー促進のトリガーとなる実績ID。 */
export const REVIEW_PROMPT_ACHIEVEMENT_ID = 'distance-200';
```

## レビュー要求の実行（副作用ラッパー）

`src/features/review/storeReview.ts` に `requestStoreReview` を定義し、`expo-store-review` を薄くラップする（テストでモックしやすくする）。

```typescript
import * as StoreReview from 'expo-store-review';

/** 利用可能ならシステムのレビュー促進ダイアログを要求する。 */
export async function requestStoreReview(): Promise<void> {
  if (!(await StoreReview.isAvailableAsync())) {
    return;
  }
  await StoreReview.requestReview();
}
```

## App.tsx への配線

- 定数: `REVIEW_PROMPTED_SETTING_KEY = 'reviewPrompted'`
- state: `hasPromptedReview`（boolean）。起動時に `getBooleanSetting(REVIEW_PROMPTED_SETTING_KEY, false)` で読み込む。
- `closeAchievementUnlockModal` 内、`setPendingAchievementNotifications` でキューを縮めたあと、`shouldRequestReviewAfterAchievement` で判定する。
  - 判定に渡す `hasPendingNotifications` は「縮めた後のキューに残りがあるか」（`notifications.length > 1` を閉じる前に判定）。
  - 条件成立時:
    1. `setHasPromptedReview(true)` + `setSetting(REVIEW_PROMPTED_SETTING_KEY, true)`
    2. ダイアログ退場アニメーション（約500ms）と被らないよう、`setTimeout(..., 700)` で `requestStoreReview()` を呼ぶ。

```typescript
function closeAchievementUnlockModal(): void {
  const current = activeAchievementNotification;
  if (!current) return;

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
    setSetting(REVIEW_PROMPTED_SETTING_KEY, true).catch(() => undefined);
    setTimeout(() => {
      requestStoreReview().catch((error: unknown) => {
        console.warn('Failed to request store review:', error);
      });
    }, 700);
  }
}
```

## ファイル構成

| ファイル                                   | 種別 | 責務                                             |
| ------------------------------------------ | ---- | ------------------------------------------------ |
| `src/features/review/reviewPromptLogic.ts` | 新規 | 判定純粋関数・定数                               |
| `src/features/review/storeReview.ts`       | 新規 | expo-store-reviewラッパー                        |
| `src/app/App.tsx`                          | 改修 | state・設定読込・closeAchievementUnlockModal配線 |
| `package.json`                             | 改修 | expo-store-review追加                            |

## テスト方針

- `reviewPromptLogic.test.ts`: distance-200で条件成立／他ID・キュー残り・促進済みで不成立
- `storeReview.test.ts`: isAvailableAsync=falseで requestReview を呼ばない、true で呼ぶ
- App統合テスト（任意）: 200km実績を閉じると requestStoreReview が呼ばれる（expo-store-reviewモック）

## 補足

- Appleはレビュー促進の表示頻度をシステムで制御（年3回まで等）するため、`requestReview()` を呼んでも必ず表示されるとは限らない。これはガイドライン準拠の正しい挙動。
- `expo-store-review` はネイティブモジュールのため、導入後は再ビルドが必要。
