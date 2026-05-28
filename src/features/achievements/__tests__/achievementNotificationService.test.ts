import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getBooleanSetting, setSetting } from '../../settings/settingsRepository';
import { markAchievementPushDelivered } from '../achievementRepository';
import { ACHIEVEMENT_NOTIFICATION_CHANNEL_ID, requestAchievementNotificationPermissionOnFirstLaunch, notifyAchievementUnlocked, setupAchievementNotificationChannel } from '../achievementNotificationService';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { HIGH: 'high' },
}));

jest.mock('../../settings/settingsRepository', () => ({
  getBooleanSetting: jest.fn(),
  setSetting: jest.fn(),
}));

jest.mock('../achievementRepository', () => ({
  markAchievementPushDelivered: jest.fn(),
}));

const definition = {
  id: 'log-days-1',
  title: 'はじめの一歩',
  description: 'GPSログを1日分記録する',
  category: 'logDays',
  condition: { type: 'logDays', threshold: 1 },
  trophyImage: 1,
  trophyImageUri: 'file:///trophy.png',
  shareText: 'share',
  sortOrder: 1,
  enabled: true,
} as any;

const originalPlatformOS = Platform.OS;

describe('実績通知 achievementNotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    Platform.OS = originalPlatformOS;
  });

  it('初回起動時だけ通知権限を要求する', async () => {
    (getBooleanSetting as jest.Mock).mockResolvedValue(false);

    await requestAchievementNotificationPermissionOnFirstLaunch();

    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(setSetting).toHaveBeenCalledWith('achievementNotificationPermissionRequested', true);
  });

  it('すでに要求済みの場合は通知権限を再要求しない', async () => {
    (getBooleanSetting as jest.Mock).mockResolvedValue(true);

    await requestAchievementNotificationPermissionOnFirstLaunch();

    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('通知許可済みの場合は解除通知を送り送信済みにする', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });

    await notifyAchievementUnlocked(definition);

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          body: 'はじめの一歩を達成しました！',
          attachments: [{ identifier: 'log-days-1', url: 'file:///trophy.png', type: 'image/png' }],
          channelId: ACHIEVEMENT_NOTIFICATION_CHANNEL_ID,
          sound: true,
          vibrate: [0, 1000],
        }),
      }),
    );
    expect(markAchievementPushDelivered).toHaveBeenCalledWith('log-days-1');
  });

  it('Android通知チャンネルを作成できる', async () => {
    Platform.OS = 'android';

    await setupAchievementNotificationChannel();

    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(ACHIEVEMENT_NOTIFICATION_CHANNEL_ID, expect.objectContaining({
      name: '実績',
      vibrationPattern: [0, 1000],
      enableVibrate: true,
    }));
  });

  it('通知未許可の場合は解除通知を送らない', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });

    await notifyAchievementUnlocked(definition);

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
