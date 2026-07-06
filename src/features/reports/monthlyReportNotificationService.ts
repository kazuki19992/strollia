import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** Androidの通知チャンネルID。月次レポート通知はこのチャンネルを使う。 */
export const MONTHLY_REPORT_NOTIFICATION_CHANNEL_ID = 'monthly-reports';

/** スケジュール済み通知の識別子。重複登録チェックと解除に使う。 */
const MONTHLY_REPORT_NOTIFICATION_ID = 'monthly-report';

/**
 * Android 向けの月次レポート通知チャンネルを作成する。
 *
 * iOS はチャンネルが不要なため Android 以外では何もしない。
 * アプリ起動時に一度呼び出す。
 */
export async function setupMonthlyReportNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(MONTHLY_REPORT_NOTIFICATION_CHANNEL_ID, {
    name: '月次レポート',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * Plus加入状態に合わせて月次レポート通知のスケジュールを同期する。
 *
 * - Plus非加入の場合はスケジュール済み通知を解除する（エラーは警告のみ）。
 * - Plus加入かつ通知権限あり・未スケジュールの場合のみ毎月1日9:00に繰り返し通知を登録する。
 * - すでにスケジュール済みの場合は何もしない（重複を防ぐため）。
 */
export async function syncMonthlyReportNotification(isPlusActive: boolean): Promise<void> {
  if (!isPlusActive) {
    try {
      await Notifications.cancelScheduledNotificationAsync(MONTHLY_REPORT_NOTIFICATION_ID);
    } catch (error: unknown) {
      console.warn('Failed to cancel monthly report notification:', error);
    }
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

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: MONTHLY_REPORT_NOTIFICATION_ID,
      content: {
        title: '先月のレポートが完成しました！',
        body: 'いますぐ確認しましょう！👀',
        data: { screen: 'monthlyReport' },
        channelId: MONTHLY_REPORT_NOTIFICATION_CHANNEL_ID,
      } as Notifications.NotificationContentInput & { channelId: string },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        day: 1,
        hour: 9,
        minute: 0,
        repeats: true,
      },
    });
  } catch (error: unknown) {
    console.warn('Failed to schedule monthly report notification:', error);
  }
}

/**
 * 通知のデータが月次レポート通知のものかどうかを判定する。
 *
 * タップしたときの画面遷移先を特定するために使う。
 */
export function isMonthlyReportNotification(data: unknown): boolean {
  return typeof data === 'object' && data !== null && (data as Record<string, unknown>)['screen'] === 'monthlyReport';
}
