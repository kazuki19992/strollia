# 月次レポート通知 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 毎月1日の午前9時にPlusユーザーへ月次レポート完成のローカルプッシュ通知を送り、タップで月次レポート画面へ遷移する。

**Architecture:** `expo-notifications` の `CalendarTriggerInput` で毎月1日9時に繰り返し発火するスケジュール通知を登録・解除するサービスを新規作成し、App.tsx でPlus状態変化時に同期する。通知タップはレスポンスリスナーと `useLastNotificationResponse` フックで処理する。

**Tech Stack:** expo-notifications, TypeScript, Jest

## Global Constraints

- 通知対象: Plusユーザーのみ（`isPlusActive === true`）
- 通知タイトル: `先月のレポートが完成しました！`（変更禁止）
- 通知本文: `いますぐ確認しましょう！👀`（変更禁止）
- 通知 identifier: `'monthly-report'`（固定）
- トリガー: `CalendarTriggerInput` `{ day: 1, hour: 9, minute: 0, repeats: true }`
- 通知 data: `{ screen: 'monthlyReport' }`
- Android チャンネル ID: `'monthly-reports'`、名前: `'月次レポート'`
- 権限未許可時はスケジュールしない（エラーにしない）
- スケジュール失敗時は `console.warn` のみ、アプリ動作継続

---

## ファイル構成

| 操作 | パス |
|------|------|
| 新規作成 | `src/features/reports/monthlyReportNotificationService.ts` |
| 新規作成 | `src/features/reports/__tests__/monthlyReportNotificationService.test.ts` |
| 修正 | `src/app/App.tsx` |

---

## Task 1: monthlyReportNotificationService の実装

**Files:**
- Create: `src/features/reports/monthlyReportNotificationService.ts`
- Test: `src/features/reports/__tests__/monthlyReportNotificationService.test.ts`

**Interfaces:**
- Produces:
  - `MONTHLY_REPORT_NOTIFICATION_CHANNEL_ID: string`
  - `setupMonthlyReportNotificationChannel(): Promise<void>`
  - `syncMonthlyReportNotification(isPlusActive: boolean): Promise<void>`
  - `isMonthlyReportNotification(data: unknown): boolean`

- [ ] **Step 1: テストファイルを作成する**

`src/features/reports/__tests__/monthlyReportNotificationService.test.ts` を以下の内容で作成する:

```typescript
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  MONTHLY_REPORT_NOTIFICATION_CHANNEL_ID,
  isMonthlyReportNotification,
  setupMonthlyReportNotificationChannel,
  syncMonthlyReportNotification,
} from '../monthlyReportNotificationService';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 'default' },
}));

const originalPlatformOS = Platform.OS;

describe('月次レポート通知 monthlyReportNotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    Platform.OS = originalPlatformOS;
  });

  describe('setupMonthlyReportNotificationChannel', () => {
    it('Androidの場合に通知チャンネルを作成する', async () => {
      Platform.OS = 'android';

      await setupMonthlyReportNotificationChannel();

      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        MONTHLY_REPORT_NOTIFICATION_CHANNEL_ID,
        expect.objectContaining({ name: '月次レポート' }),
      );
    });

    it('iOS の場合はチャンネルを作成しない', async () => {
      Platform.OS = 'ios';

      await setupMonthlyReportNotificationChannel();

      expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
    });
  });

  describe('syncMonthlyReportNotification', () => {
    it('Plus有効かつ権限あり・未登録の場合は通知をスケジュールする', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);

      await syncMonthlyReportNotification(true);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'monthly-report',
          content: expect.objectContaining({
            title: '先月のレポートが完成しました！',
            body: 'いますぐ確認しましょう！👀',
            data: { screen: 'monthlyReport' },
          }),
          trigger: expect.objectContaining({ day: 1, hour: 9, minute: 0, repeats: true }),
        }),
      );
    });

    it('Plus有効だが権限なしの場合はスケジュールしない', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });

      await syncMonthlyReportNotification(true);

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('Plus有効かつすでに登録済みの場合は再スケジュールしない（重複防止）', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        { identifier: 'monthly-report' },
      ]);

      await syncMonthlyReportNotification(true);

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('Plus無効の場合は通知をキャンセルする', async () => {
      await syncMonthlyReportNotification(false);

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('monthly-report');
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('isMonthlyReportNotification', () => {
    it('screen が monthlyReport のオブジェクトに対して true を返す', () => {
      expect(isMonthlyReportNotification({ screen: 'monthlyReport' })).toBe(true);
    });

    it('screen が別の値の場合は false を返す', () => {
      expect(isMonthlyReportNotification({ screen: 'map' })).toBe(false);
    });

    it('null の場合は false を返す', () => {
      expect(isMonthlyReportNotification(null)).toBe(false);
    });

    it('文字列の場合は false を返す', () => {
      expect(isMonthlyReportNotification('monthlyReport')).toBe(false);
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest src/features/reports/__tests__/monthlyReportNotificationService.test.ts --no-coverage
```

期待: `Cannot find module '../monthlyReportNotificationService'` でFAIL

- [ ] **Step 3: サービスを実装する**

`src/features/reports/monthlyReportNotificationService.ts` を以下の内容で作成する:

```typescript
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const MONTHLY_REPORT_NOTIFICATION_CHANNEL_ID = 'monthly-reports';

const MONTHLY_REPORT_NOTIFICATION_ID = 'monthly-report';

export async function setupMonthlyReportNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(MONTHLY_REPORT_NOTIFICATION_CHANNEL_ID, {
    name: '月次レポート',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function syncMonthlyReportNotification(isPlusActive: boolean): Promise<void> {
  if (!isPlusActive) {
    await Notifications.cancelScheduledNotificationAsync(MONTHLY_REPORT_NOTIFICATION_ID);
    return;
  }

  const permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) {
    return;
  }

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const alreadyScheduled = scheduled.some((n) => n.identifier === MONTHLY_REPORT_NOTIFICATION_ID);
  if (alreadyScheduled) {
    return;
  }

  await Notifications.scheduleNotificationAsync({
    identifier: MONTHLY_REPORT_NOTIFICATION_ID,
    content: {
      title: '先月のレポートが完成しました！',
      body: 'いますぐ確認しましょう！👀',
      data: { screen: 'monthlyReport' },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      day: 1,
      hour: 9,
      minute: 0,
      repeats: true,
    },
  });
}

export function isMonthlyReportNotification(data: unknown): boolean {
  return typeof data === 'object' && data !== null && (data as Record<string, unknown>)['screen'] === 'monthlyReport';
}
```

- [ ] **Step 4: テストがパスすることを確認する**

```bash
npx jest src/features/reports/__tests__/monthlyReportNotificationService.test.ts --no-coverage
```

期待: 全テスト PASS

- [ ] **Step 5: コミットする**

```bash
git add src/features/reports/monthlyReportNotificationService.ts src/features/reports/__tests__/monthlyReportNotificationService.test.ts
git commit -m "feat(reports): 月次レポートのローカル通知サービスを追加"
```

---

## Task 2: App.tsx へ統合する

**Files:**
- Modify: `src/app/App.tsx`

**Interfaces:**
- Consumes:
  - `setupMonthlyReportNotificationChannel(): Promise<void>` (Task 1)
  - `syncMonthlyReportNotification(isPlusActive: boolean): Promise<void>` (Task 1)
  - `isMonthlyReportNotification(data: unknown): boolean` (Task 1)

- [ ] **Step 1: import を追加する**

`src/app/App.tsx` の既存 import 群に以下を追加する（`achievementNotificationService` の import がある行付近）。

現在（38行目付近）:
```typescript
import { initializeAchievementNotificationHandler, requestAchievementNotificationPermissionOnFirstLaunch, setupAchievementNotificationChannel } from '../features/achievements/achievementNotificationService';
```

この行の直後に追加:
```typescript
import { isMonthlyReportNotification, setupMonthlyReportNotificationChannel, syncMonthlyReportNotification } from '../features/reports/monthlyReportNotificationService';
```

- [ ] **Step 2: Android チャンネルセットアップを追加する**

`src/app/App.tsx` の `setupAchievementNotificationChannel` を呼んでいる行（801行目付近）の直後に追加する:

現在:
```typescript
        await setupAchievementNotificationChannel().catch(() => undefined);
```

変更後:
```typescript
        await setupAchievementNotificationChannel().catch(() => undefined);
        await setupMonthlyReportNotificationChannel().catch(() => undefined);
```

- [ ] **Step 3: 初期Plus状態確定時の同期を追加する**

`src/app/App.tsx` の初期プレミアム状態を `setPremiumAccessState` で設定している箇所（712〜714行目付近）の直後に追加する:

現在:
```typescript
        if (premiumAccessUpdateVersionRef.current === initialPremiumAccessUpdateVersion) {
          setPremiumAccessState(initialPremiumAccessResult.state);
          if (initialPremiumAccessResult.confirmed) {
            setIsPremiumAccessPendingForIcon(false);
          }
        }
```

変更後:
```typescript
        if (premiumAccessUpdateVersionRef.current === initialPremiumAccessUpdateVersion) {
          setPremiumAccessState(initialPremiumAccessResult.state);
          if (initialPremiumAccessResult.confirmed) {
            setIsPremiumAccessPendingForIcon(false);
          }
          syncMonthlyReportNotification(initialPremiumAccessResult.state.isPlusActive).catch((error: unknown) => {
            console.warn('Failed to sync monthly report notification:', error);
          });
        }
```

タイムアウト後の遅延解決パス（721〜729行目付近）にも追加する:

現在:
```typescript
          initialPremiumAccessRequest
            .then((state) => {
              if (!signal.aborted && premiumAccessUpdateVersionRef.current === initialPremiumAccessUpdateVersion) {
                setPremiumAccessState(state);
                setIsPremiumAccessPendingForIcon(false);
              }
            })
```

変更後:
```typescript
          initialPremiumAccessRequest
            .then((state) => {
              if (!signal.aborted && premiumAccessUpdateVersionRef.current === initialPremiumAccessUpdateVersion) {
                setPremiumAccessState(state);
                setIsPremiumAccessPendingForIcon(false);
                syncMonthlyReportNotification(state.isPlusActive).catch((error: unknown) => {
                  console.warn('Failed to sync monthly report notification:', error);
                });
              }
            })
```

- [ ] **Step 4: RevenueCat 状態変化時の同期を追加する**

`src/app/App.tsx` の `subscribePremiumAccessStateUpdates` コールバック（837〜841行目付近）に追加する:

現在:
```typescript
  useEffect(() => subscribePremiumAccessStateUpdates((state) => {
    premiumAccessUpdateVersionRef.current += 1;
    setPremiumAccessState(state);
    setIsPremiumAccessPendingForIcon(false);
  }), []);
```

変更後:
```typescript
  useEffect(() => subscribePremiumAccessStateUpdates((state) => {
    premiumAccessUpdateVersionRef.current += 1;
    setPremiumAccessState(state);
    setIsPremiumAccessPendingForIcon(false);
    syncMonthlyReportNotification(state.isPlusActive).catch((error: unknown) => {
      console.warn('Failed to sync monthly report notification:', error);
    });
  }), []);
```

- [ ] **Step 5: フォアグラウンド/バックグラウンドでの通知タップ処理を追加する**

`src/app/App.tsx` 内に `useEffect` を追加する。既存の `subscribePremiumAccessStateUpdates` の `useEffect` の直後に挿入する:

```typescript
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      if (isMonthlyReportNotification(response.notification.request.content.data)) {
        openMonthlyReport();
      }
    });
    return () => subscription.remove();
  }, []);
```

`App.tsx` には `expo-notifications` の直接 import がないため、以下を import 群に追加する（他の `expo-*` import と並べる）:

```typescript
import * as Notifications from 'expo-notifications';
```

- [ ] **Step 6: コールドスタート対応を追加する**

`src/app/App.tsx` の `const [isReady, setIsReady]` の宣言（230行目付近）の近くに `useLastNotificationResponse` フックを追加する:

```typescript
  const lastNotificationResponse = Notifications.useLastNotificationResponse();
```

次に、`isReady` を監視する `useEffect` を追加する（Step 5 の `useEffect` の直後）:

```typescript
  useEffect(() => {
    if (!isReady) return;
    if (lastNotificationResponse && isMonthlyReportNotification(
      lastNotificationResponse.notification.request.content.data,
    )) {
      openMonthlyReport();
    }
  }, [isReady, lastNotificationResponse]);
```

- [ ] **Step 7: TypeScript が通ることを確認する**

```bash
npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 8: テストスイート全体がパスすることを確認する**

```bash
npx jest --no-coverage
```

期待: 全テスト PASS

- [ ] **Step 9: コミットする**

```bash
git add src/app/App.tsx
git commit -m "feat(reports): 月次レポート通知をApp.tsxに統合する"
```
