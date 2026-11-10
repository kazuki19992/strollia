import * as Notifications from 'expo-notifications';

import { ACHIEVEMENT_NOTIFICATION_CHANNEL_ID } from '@/features/achievements/achievementNotificationService';
import { getLandmarkAreaById, getLandmarkPackById, getLandmarkSpotById, type LandmarkSpot } from './landmarkCatalog';
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
      // 複数地点スポットは全地点の到達で初めてスポット到達になるため「コンプリート」と伝える
      title: spot.isMultiArea ? 'スポットをコンプリートしました！' : 'スポットに到達しました！',
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
 * 複数地点スポットの途中の地点到達をローカル通知する。
 *
 * スポット全体の到達ではないため実績処理は伴わず、通知のみ。進捗(visited/total)は
 * 記録側が確定した値を受け取る。通知チャンネルはスポット到達通知と同じ。
 */
export async function notifyLandmarkAreaArrival(event: {
  areaId: string;
  visitedAreaCount: number;
  totalAreaCount: number;
}): Promise<void> {
  const resolved = getLandmarkAreaById(event.areaId);

  // マスタから消えた地点は表示名が解決できないため通知しない
  if (!resolved) {
    return;
  }

  const permissions = await Notifications.getPermissionsAsync();

  if (!permissions.granted) {
    return;
  }

  const { area, spot } = resolved;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '地点に到達しました！',
      channelId: ACHIEVEMENT_NOTIFICATION_CHANNEL_ID,
      body: `${area.name}に到達しました（${spot.name} ${event.visitedAreaCount}/${event.totalAreaCount}）`,
      data: { landmarkAreaId: area.id, landmarkSpotId: spot.id },
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

  const verb = spot.isMultiArea ? 'をコンプリートしました' : 'に到達しました';

  return packSummaries.length > 0 ? `${spot.name}${verb}（${packSummaries.join('・')}）` : `${spot.name}${verb}`;
}
