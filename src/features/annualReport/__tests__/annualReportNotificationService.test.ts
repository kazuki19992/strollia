import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  ANNUAL_REPORT_NOTIFICATION_CHANNEL_ID,
  parseAnnualReportNotification,
  scheduleAnnualReportNotification,
  setupAnnualReportNotificationChannel,
} from '@/features/annualReport/annualReportNotificationService';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 'default' },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

const originalPlatformOS = Platform.OS;

describe('年間レポート通知 annualReportNotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('annual-report-2026');
    (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    Platform.OS = originalPlatformOS;
  });

  describe('setupAnnualReportNotificationChannel', () => {
    it('Androidの場合に「年間レポート」チャンネルを作成する', async () => {
      Platform.OS = 'android';

      await setupAnnualReportNotificationChannel();

      expect(ANNUAL_REPORT_NOTIFICATION_CHANNEL_ID).toBe('annual-reports');
      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith('annual-reports', {
        name: '年間レポート',
        importance: 'default',
      });
    });

    it('iOSの場合はチャンネルを作成しない', async () => {
      Platform.OS = 'ios';

      await setupAnnualReportNotificationChannel();

      expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
    });
  });

  describe('scheduleAnnualReportNotification', () => {
    const at = new Date(2026, 11, 20, 9, 0, 0);

    it('権限がなければ予約せず false を返す', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });

      await expect(scheduleAnnualReportNotification(2026, at)).resolves.toBe(false);

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('権限がなくても requestPermissionsAsync を呼ばない', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });

      await scheduleAnnualReportNotification(2026, at);

      expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    });

    it('識別子・本文・data・日時が仕様どおりに予約される', async () => {
      await expect(scheduleAnnualReportNotification(2026, at)).resolves.toBe(true);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        identifier: 'annual-report-2026',
        content: {
          title: '今年をふりかえりませんか？',
          body: '2026年の年間レポートを作りました！',
          data: { screen: 'annualReport', year: 2026 },
          channelId: 'annual-reports',
        },
        trigger: { type: 'date', date: at },
      });
    });

    it('既存の同一識別子の予約を先に取り消して置き換える', async () => {
      await scheduleAnnualReportNotification(2026, at);

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('annual-report-2026');
      expect((Notifications.cancelScheduledNotificationAsync as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
        (Notifications.scheduleNotificationAsync as jest.Mock).mock.invocationCallOrder[0],
      );
    });

    it('予約に失敗した場合は false を返す', async () => {
      jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValue(new Error('fail'));

      await expect(scheduleAnnualReportNotification(2026, at)).resolves.toBe(false);
    });
  });

  describe('parseAnnualReportNotification', () => {
    it('年間レポートの data から year を取り出す', () => {
      expect(parseAnnualReportNotification({ screen: 'annualReport', year: 2026 })).toEqual({ year: 2026 });
    });

    it('monthlyReport の data は null にする', () => {
      expect(parseAnnualReportNotification({ screen: 'monthlyReport' })).toBeNull();
    });

    it('year が数値でない・整数でない場合や data が不正な場合は null にする', () => {
      expect(parseAnnualReportNotification({ screen: 'annualReport', year: '2026' })).toBeNull();
      expect(parseAnnualReportNotification({ screen: 'annualReport', year: 2026.5 })).toBeNull();
      expect(parseAnnualReportNotification({ screen: 'annualReport' })).toBeNull();
      expect(parseAnnualReportNotification(null)).toBeNull();
      expect(parseAnnualReportNotification('annualReport')).toBeNull();
    });
  });
});
