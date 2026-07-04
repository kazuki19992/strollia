import { PendingAchievementNotification } from '../achievementRepository';
import { AchievementDefinition } from '../achievementDefinitions';
import { filterDismissedAchievementNotifications } from '../pendingNotifications';

const definition = {
  id: 'odo-1',
  title: '1km移動した',
  description: '総移動距離が1kmに到達しました。',
  category: 'distance',
  condition: { type: 'totalDistanceMeters', threshold: 1_000 },
  trophyImage: 1,
  trophyImageUri: null,
  shareText: 'すとろりあで1km移動したを達成しました！',
  sortOrder: 1,
  enabled: true,
} satisfies AchievementDefinition;

/**
 * テスト用の実績解除キューを作る。
 *
 * @param queueId 実績解除キューID。
 * @returns テスト用の実績解除キュー。
 */
function createNotification(queueId: number): PendingAchievementNotification {
  return {
    queueId,
    definition,
  };
}

describe('実績解除キュー filterDismissedAchievementNotifications', () => {
  test('閉じた実績解除キューを除外する', () => {
    const notifications = [createNotification(1), createNotification(2), createNotification(3)];

    expect(filterDismissedAchievementNotifications(notifications, new Set([2]))).toEqual([createNotification(1), createNotification(3)]);
  });

  test('閉じた実績解除キューがない場合は全件を返す', () => {
    const notifications = [createNotification(1), createNotification(2)];

    expect(filterDismissedAchievementNotifications(notifications, new Set())).toEqual(notifications);
  });
});
