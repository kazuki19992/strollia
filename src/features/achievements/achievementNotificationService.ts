import * as Notifications from 'expo-notifications';

import { setSetting, getBooleanSetting } from '../settings/settingsRepository';
import { AchievementDefinition } from './achievementDefinitions';
import { markAchievementPushDelivered } from './achievementRepository';

/** 初回起動時の通知権限要求を記録する設定キー。 */
const ACHIEVEMENT_NOTIFICATION_PERMISSION_REQUESTED_KEY = 'achievementNotificationPermissionRequested';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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
      body: `${definition.title}を達成しました！`,
      attachments: definition.trophyImageUri
        ? [{ identifier: definition.id, url: definition.trophyImageUri, type: 'image/png' }]
        : undefined,
      data: { achievementId: definition.id, trophyImageUri: definition.trophyImageUri },
      vibrate: [0, 1000],
    },
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
