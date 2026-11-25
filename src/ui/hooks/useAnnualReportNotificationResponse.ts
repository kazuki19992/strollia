import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';

import { parseAnnualReportNotification } from '@/features/annualReport/annualReportNotificationService';

/** `useAnnualReportNotificationResponse` が受け取る依存の型。 */
export type UseAnnualReportNotificationResponseArgs = {
  /** アプリの初期化が完了しているかどうか。 */
  isReady: boolean;
  /**
   * 年間レポートを開く関数。ref 経由で最新の関数を参照する。
   * 公開期間内かどうかの判定は呼び出し側で行う。
   */
  onOpenAnnualReport: (year: number) => void;
};

/**
 * 年間レポート通知のタップをハンドルするカスタムフック。
 * `useMonthlyReportNotificationResponse` と同じ構造で、実行中のタップとコールドスタート起動の両方を扱う。
 */
export function useAnnualReportNotificationResponse({ isReady, onOpenAnnualReport }: UseAnnualReportNotificationResponseArgs): void {
  /** 通知リスナーの古いクロージャを避けるため、最新の `onOpenAnnualReport` を ref 経由で参照する。 */
  const openAnnualReportRef = useRef<(year: number) => void>(() => undefined);
  /** リスナー内で stale な state を読まないよう、`isReady` の最新値を保持する。 */
  const isReadyRef = useRef(false);
  /** 同一通知IDを二重処理しないためのガード。 */
  const lastHandledNotificationIdRef = useRef<string | null>(null);

  const lastNotificationResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    openAnnualReportRef.current = onOpenAnnualReport;
  });

  useEffect(() => {
    isReadyRef.current = isReady;
  }, [isReady]);

  /** 実行中の通知タップを購読し、年間レポート通知ならストーリーを開く。 */
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const parsed = parseAnnualReportNotification(response.notification.request.content.data);
      if (!parsed) return;
      if (!isReadyRef.current) return;
      const id = response.notification.request.identifier;
      if (lastHandledNotificationIdRef.current === id) return;
      lastHandledNotificationIdRef.current = id;
      openAnnualReportRef.current(parsed.year);
    });
    return () => subscription.remove();
  }, []);

  /** 初期化完了後、通知タップでの起動（コールドスタート）だった場合にストーリーを開く。 */
  useEffect(() => {
    if (!isReady) return;
    if (!lastNotificationResponse) return;
    const parsed = parseAnnualReportNotification(lastNotificationResponse.notification.request.content.data);
    if (!parsed) return;
    const id = lastNotificationResponse.notification.request.identifier;
    if (lastHandledNotificationIdRef.current === id) return;
    lastHandledNotificationIdRef.current = id;
    openAnnualReportRef.current(parsed.year);
  }, [isReady, lastNotificationResponse]);
}
