import { REVIEW_PROMPT_ACHIEVEMENT_ID, shouldRequestReviewAfterAchievement } from '../reviewPromptLogic';

describe('レビュー促進判定 shouldRequestReviewAfterAchievement', () => {
  it('トリガー実績IDはdistance-200', () => {
    expect(REVIEW_PROMPT_ACHIEVEMENT_ID).toBe('distance-200');
  });

  it('distance-200を閉じ・キュー空・未促進なら促す', () => {
    expect(
      shouldRequestReviewAfterAchievement({
        dismissedAchievementId: 'distance-200',
        hasPendingNotifications: false,
        hasAlreadyPrompted: false,
      }),
    ).toBe(true);
  });

  it('別の実績IDなら促さない', () => {
    expect(
      shouldRequestReviewAfterAchievement({
        dismissedAchievementId: 'distance-100',
        hasPendingNotifications: false,
        hasAlreadyPrompted: false,
      }),
    ).toBe(false);
  });

  it('他の実績通知が残っていれば促さない', () => {
    expect(
      shouldRequestReviewAfterAchievement({
        dismissedAchievementId: 'distance-200',
        hasPendingNotifications: true,
        hasAlreadyPrompted: false,
      }),
    ).toBe(false);
  });

  it('既に促進済みなら促さない', () => {
    expect(
      shouldRequestReviewAfterAchievement({
        dismissedAchievementId: 'distance-200',
        hasPendingNotifications: false,
        hasAlreadyPrompted: true,
      }),
    ).toBe(false);
  });
});
