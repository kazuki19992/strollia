import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';

import { isMonthlyReportNotification } from '@/features/reports/monthlyReportNotificationService';

/** `useMonthlyReportNotificationResponse` が受け取る依存の型。 */
export type UseMonthlyReportNotificationResponseArgs = {
  /** アプリの初期化が完了しているかどうか。 */
  isReady: boolean;
  /** 月次レポート画面を開く関数。ref 経由で最新の関数を参照する。 */
  onOpenMonthlyReport: () => void;
};

/**
 * 月次レポート通知応答をハンドルするカスタムフック。
 *
 * App.tsx から通知応答に関わる3つの effect と対応する ref を切り出す。
 *
 * - `openMonthlyReportRef`: 常に最新の `onOpenMonthlyReport` を指す ref
 * - `isReadyRef`: `isReady` の最新値を保持する ref（通知リスナー内でクロージャ古化を避けるため）
 * - `lastHandledNotificationIdRef`: 同一通知の二重処理を防ぐための重複ガード
 *
 * フックは `useLastNotificationResponse` を内部で呼び出すため、
 * 呼び出し側は通知 hook の戻り値を個別に渡す必要はない。
 */
export function useMonthlyReportNotificationResponse({ isReady, onOpenMonthlyReport }: UseMonthlyReportNotificationResponseArgs): void {
  /**
   * 最新の `onOpenMonthlyReport` を常に参照するための ref。
   * 通知リスナーは依存配列が空のため、古いクロージャを避けるために ref を経由する。
   */
  const openMonthlyReportRef = useRef<() => void>(() => undefined);
  /**
   * isReady の最新値を保持する ref。
   * 通知リスナー内では stale な state を読まないよう ref 経由で参照する。
   */
  const isReadyRef = useRef(false);
  /**
   * 同一通知 ID を重複処理しないためのガード。
   * 通知タップ後に複数回コールバックが来る場合に備えて使う。
   */
  const lastHandledNotificationIdRef = useRef<string | null>(null);

  const lastNotificationResponse = Notifications.useLastNotificationResponse();

  /** openMonthlyReportRef を常に最新の onOpenMonthlyReport へ更新する。 */
  useEffect(() => {
    openMonthlyReportRef.current = onOpenMonthlyReport;
  });

  /** isReadyRef を isReady と同期させる。 */
  useEffect(() => {
    isReadyRef.current = isReady;
  }, [isReady]);

  /** 通知タップイベントを購読し、月次レポート通知なら画面を開く。 */
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      if (!isMonthlyReportNotification(response.notification.request.content.data)) return;
      if (!isReadyRef.current) return;
      const id = response.notification.request.identifier;
      if (lastHandledNotificationIdRef.current === id) return;
      lastHandledNotificationIdRef.current = id;
      openMonthlyReportRef.current();
    });
    return () => subscription.remove();
  }, []);

  /**
   * アプリ起動時に lastNotificationResponse を確認し、
   * 月次レポート通知でアプリが起動した場合に画面を開く。
   */
  useEffect(() => {
    if (!isReady) return;
    if (!lastNotificationResponse) return;
    if (!isMonthlyReportNotification(lastNotificationResponse.notification.request.content.data)) return;
    const id = lastNotificationResponse.notification.request.identifier;
    if (lastHandledNotificationIdRef.current === id) return;
    lastHandledNotificationIdRef.current = id;
    openMonthlyReportRef.current();
  }, [isReady, lastNotificationResponse]);
}
