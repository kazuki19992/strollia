import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { setSetting, getBooleanSetting } from '../settings/settingsRepository';
import { AchievementDefinition } from './achievementDefinitions';
import { markAchievementPushDelivered } from './achievementRepository';

/** 初回起動時の通知権限要求を記録する設定キー。 */
const ACHIEVEMENT_NOTIFICATION_PERMISSION_REQUESTED_KEY = 'achievementNotificationPermissionRequested';

/** 実績通知用のAndroid通知チャンネルID。 */
export const ACHIEVEMENT_NOTIFICATION_CHANNEL_ID = 'achievements';

/** 実績通知ハンドラを初期化する。 */
export function initializeAchievementNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/** Androidの実績通知チャンネルを作成する。 */
export async function setupAchievementNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(ACHIEVEMENT_NOTIFICATION_CHANNEL_ID, {
    name: '実績',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 1000],
    enableVibrate: true,
  });
}

/** 初回起動時だけ実績通知権限を要求する。 */
export async function requestAchievementNotificationPermissionOnFirstLaunch(): Promise<void> {
  const alreadyRequested = await getBooleanSetting(ACHIEVEMENT_NOTIFICATION_PERMISSION_REQUESTED_KEY, false);

  if (alreadyRequested) {
    return;
  }

  await Notifications.requestPermissionsAsync();
  await setSetting(ACHIEVEMENT_NOTIFICATION_PERMISSION_REQUESTED_KEY, true);
}

/** 通知が許可されていれば実績解除ローカル通知を送信する。 */
export async function notifyAchievementUnlocked(definition: AchievementDefinition): Promise<void> {
  const permissions = await Notifications.getPermissionsAsync();

  if (!permissions.granted) {
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '実績を達成しました！',
      channelId: ACHIEVEMENT_NOTIFICATION_CHANNEL_ID,
      body: `${definition.title}を達成しました！`,
      attachments: definition.trophyImageUri
        ? [{ identifier: definition.id, url: definition.trophyImageUri, type: 'image/png' }]
        : undefined,
      data: { achievementId: definition.id, trophyImageUri: definition.trophyImageUri },
      sound: true,
      vibrate: [0, 1000],
    } as Notifications.NotificationContentInput & { channelId: string },
    trigger: null,
  });
  await markAchievementPushDelivered(definition.id);
}

/** 複数の解除実績を順番にローカル通知する。 */
export async function notifyAchievementUnlocks(definitions: AchievementDefinition[]): Promise<void> {
  for (const definition of definitions) {
    await notifyAchievementUnlocked(definition);
  }
}
