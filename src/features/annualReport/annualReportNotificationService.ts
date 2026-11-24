import * as Notifications from 'expo-notifications';
// expo-notifications 58 のビルド形式では eslint-plugin-import が名前空間経由の enum を解決できず誤検知するため、名前付きで import する
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

/** Androidの通知チャンネルID。年間レポート通知はこのチャンネルを使う。 */
export const ANNUAL_REPORT_NOTIFICATION_CHANNEL_ID = 'annual-reports';

/** 通知データの `screen` に入れる値。タップ時に年間レポート通知かを判定するために使う。 */
const ANNUAL_REPORT_NOTIFICATION_SCREEN = 'annualReport';

/** 年ごとのスケジュール済み通知の識別子。同じ年の再予約で置き換えるために固定する。 */
function annualReportNotificationId(year: number): string {
  return `annual-report-${year}`;
}

/**
 * Android 向けの年間レポート通知チャンネルを作成する。
 *
 * iOS はチャンネルが不要なため Android 以外では何もしない。アプリ起動時に一度呼び出す。
 */
export async function setupAnnualReportNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(ANNUAL_REPORT_NOTIFICATION_CHANNEL_ID, {
    name: '年間レポート',
    importance: AndroidImportance.DEFAULT,
  });
}

/**
 * 年間レポートの完成通知を指定日時に予約する。
 *
 * - 通知権限がなければ予約しない。この機能のために権限リクエストは行わない（既存の許可状態だけを見る）。
 * - 同じ年の予約が残っていれば取り消して置き換える（アプリ再起動などでの二重通知を避ける）。
 *
 * @param year レポート対象年
 * @param at 通知を出す日時
 * @returns 予約できた場合 true。権限なし・失敗時は false
 */
export async function scheduleAnnualReportNotification(year: number, at: Date): Promise<boolean> {
  try {
    const permissions = await Notifications.getPermissionsAsync();
    if (!permissions.granted) {
      return false;
    }

    const identifier = annualReportNotificationId(year);
    await Notifications.cancelScheduledNotificationAsync(identifier);
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: '今年をふりかえりませんか？',
        body: `${year}年の年間レポートを作りました！`,
        data: { screen: ANNUAL_REPORT_NOTIFICATION_SCREEN, year },
        channelId: ANNUAL_REPORT_NOTIFICATION_CHANNEL_ID,
      } as Notifications.NotificationContentInput & { channelId: string },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
    return true;
  } catch (error: unknown) {
    console.warn('Failed to schedule annual report notification:', error);
    return false;
  }
}

/**
 * 通知データが年間レポート通知のものであれば対象年を返す。
 *
 * タップ時の遷移先判定に使う。別種の通知や year が整数でないデータは null。
 */
export function parseAnnualReportNotification(data: unknown): { year: number } | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const record = data as Record<string, unknown>;
  if (record['screen'] !== ANNUAL_REPORT_NOTIFICATION_SCREEN) {
    return null;
  }
  const year = record['year'];
  return typeof year === 'number' && Number.isInteger(year) ? { year } : null;
}
