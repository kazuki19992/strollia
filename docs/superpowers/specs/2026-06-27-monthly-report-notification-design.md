# 月次レポート通知 設計書

**日付:** 2026-06-27

## 概要

毎月1日の午前9時に、Plusユーザーへ「先月のレポートが完成しました」というローカルプッシュ通知を送信する。通知タップで月次レポート画面へ遷移する。一般ユーザーには通知を出さない。

---

## 通知仕様

| 項目 | 値 |
|------|-----|
| タイトル | 先月のレポートが完成しました！ |
| 本文 | いますぐ確認しましょう！👀 |
| 発火タイミング | 毎月1日 午前9時（端末のローカルタイム） |
| 対象 | Plusユーザーのみ |
| トリガー種別 | `CalendarTriggerInput` (`day: 1, hour: 9, minute: 0, repeats: true`) |
| 通知データ | `{ screen: 'monthlyReport' }` |
| Android チャンネル | `monthly-reports`（名前: 「月次レポート」） |

---

## アーキテクチャ

### 新規ファイル: `src/features/reports/monthlyReportNotificationService.ts`

**責務:** 月次レポート通知のスケジュール管理とタップハンドリングのロジック。

**公開関数:**

```ts
// Plus状態に応じて通知を登録/解除する。App起動時・Plus状態変化時に呼ぶ。
syncMonthlyReportNotification(isPlusActive: boolean): Promise<void>

// 月次レポート通知チャンネルを作成する（Android専用）。
setupMonthlyReportNotificationChannel(): Promise<void>

// 通知のdataからmonthlyReport遷移対象かどうかを判定する。
isMonthlyReportNotification(data: unknown): boolean
```

**内部実装:**

- `scheduleMonthlyReportNotification()` — 既存スケジュールを確認し、未登録の場合のみ `scheduleNotificationAsync` を呼ぶ（重複防止）
- `cancelMonthlyReportNotification()` — `identifier` で管理した通知を `cancelScheduledNotificationAsync` で解除
- 通知 `identifier` は定数 `MONTHLY_REPORT_NOTIFICATION_ID = 'monthly-report'` で固定

---

## App.tsx への統合

### 1. 起動時のスケジュール同期

既存の Plus 状態確定後（`getPremiumAccessState()` の結果受け取り箇所）に追加:

```ts
syncMonthlyReportNotification(accessState.isPlusActive)
```

### 2. Plus 状態変化時の追従

既存の `subscribeToCustomerInfoUpdates` コールバック内に追加:

```ts
syncMonthlyReportNotification(state.isPlusActive)
```

### 3. 通知タップによる画面遷移

`useEffect` で `Notifications.addNotificationResponseReceivedListener` を登録:

```ts
useEffect(() => {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    if (isMonthlyReportNotification(response.notification.request.content.data)) {
      openMonthlyReport();
    }
  });
  return () => sub.remove();
}, []);
```

### 4. コールドスタート対応

`Notifications.useLastNotificationResponse()` を使い、アプリが通知タップで起動した場合も遷移する。ただし `isReady` フラグが `true` になってからデータが揃っているため、`isReady` を条件に含めて遷移を遅延させる:

```ts
const lastNotificationResponse = Notifications.useLastNotificationResponse();

useEffect(() => {
  if (!isReady) return;
  if (lastNotificationResponse && isMonthlyReportNotification(
    lastNotificationResponse.notification.request.content.data
  )) {
    openMonthlyReport();
  }
}, [isReady, lastNotificationResponse]);
```

### 5. Android チャンネルのセットアップ

既存の `setupAchievementNotificationChannel()` と同じ箇所（`useEffect` 内）で `setupMonthlyReportNotificationChannel()` を追加呼び出し。

---

## エラーハンドリング

- 通知権限が未許可の場合: `scheduleMonthlyReportNotification` 内で権限確認し、未許可なら何もしない（実績通知と同じパターン）
- スケジュール失敗: `console.warn` に留め、アプリの動作は継続
- コールドスタート時のデータ未ロード: `isReady` フラグで制御し、ロード完了後に遷移

---

## テスト方針

- `monthlyReportNotificationService.test.ts` を新規作成
  - `syncMonthlyReportNotification(true)` → `scheduleNotificationAsync` が呼ばれる
  - `syncMonthlyReportNotification(false)` → `cancelScheduledNotificationAsync` が呼ばれる
  - 重複スケジュール防止: 既登録状態で `syncMonthlyReportNotification(true)` → `scheduleNotificationAsync` が呼ばれない
  - `isMonthlyReportNotification` の正常・異常パターン

---

## スコープ外

- サーバーサイドプッシュ（APNs / FCM）への拡張
- 通知権限の初回要求フロー（既存の実績通知の権限要求に相乗り）
