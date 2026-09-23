import * as Notifications from 'expo-notifications';

import { ACHIEVEMENT_NOTIFICATION_CHANNEL_ID } from '@/features/achievements/achievementNotificationService';
import { getLandmarkPackById, getLandmarkSpotById, type LandmarkSpot } from './landmarkCatalog';
import { resolveLandmarkPackProgress } from './landmarkPackProgress';
import { getVisitedLandmarkSpotIds } from './landmarkVisitRepository';

/**
 * スポット到達をローカル通知する。
 *
 * 到達はまだ実績ではないため、トロフィー演出(AchievementUnlockModal)は出さず通知のみとする。
 * パック完走時は既存の実績解除フローが別途トロフィー演出を行うため、ここで「制覇しました」は出さない。
 *
 * 通知チャンネルは実績と同じものを使う。ユーザーから見れば同じ「達成」系の通知であり、
 * チャンネルを分けると通知設定の粒度だけが増えて利点がない。
 */
export async function notifyLandmarkSpotArrival(spotId: string): Promise<void> {
  const spot = getLandmarkSpotById(spotId);

  // マスタから消えたスポットの到達記録が残っていても通知しない(表示名が解決できない)
  if (!spot) {
    return;
  }

  const permissions = await Notifications.getPermissionsAsync();

  if (!permissions.granted) {
    return;
  }

  const body = await createArrivalBody(spot);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'スポットに到達しました！',
      channelId: ACHIEVEMENT_NOTIFICATION_CHANNEL_ID,
      body,
      data: { landmarkSpotId: spot.id },
      sound: true,
      vibrate: [0, 1000],
    } as Notifications.NotificationContentInput & { channelId: string },
    trigger: null,
  });
}

/**
 * 「華厳の滝に到達しました（日本三名瀑 1/3）」形式の本文を作る。
 *
 * 進捗はDBから到達済みIDを取り直して数える。到達のINSERTはトランザクション確定後に
 * 通知されるため、この再取得には今回の到達が含まれ、分子が1つ足りなくならない。
 */
async function createArrivalBody(spot: LandmarkSpot): Promise<string> {
  const visitedSpotIds = await getVisitedLandmarkSpotIds();
  const progressByPackId = new Map(resolveLandmarkPackProgress(visitedSpotIds).map((progress) => [progress.packId, progress]));

  const packSummaries = spot.packs
    .map((membership) => {
      const pack = getLandmarkPackById(membership.packId);
      const progress = progressByPackId.get(membership.packId);

      return pack && progress ? `${pack.name} ${progress.visitedCount}/${progress.totalCount}` : null;
    })
    .filter((summary): summary is string => summary != null);

  return packSummaries.length > 0 ? `${spot.name}に到達しました（${packSummaries.join('・')}）` : `${spot.name}に到達しました`;
}
