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
  SchedulableTriggerInputTypes: { CALENDAR: 'calendar' },
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
            channelId: 'monthly-reports',
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
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([{ identifier: 'monthly-report' }]);

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
