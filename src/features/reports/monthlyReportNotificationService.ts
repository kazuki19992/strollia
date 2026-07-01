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

export function isMonthlyReportNotification(data: unknown): boolean {
  return typeof data === 'object' && data !== null && (data as Record<string, unknown>)['screen'] === 'monthlyReport';
}
