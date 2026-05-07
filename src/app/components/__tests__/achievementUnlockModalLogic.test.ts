import {
  ACHIEVEMENT_MODAL_SWIPE_DISMISS_DISTANCE,
  ACHIEVEMENT_MODAL_SWIPE_DISMISS_VELOCITY,
  shouldDismissAchievementModalSwipe,
  shouldDismissAchievementModalTerminate,
} from '../achievementUnlockModalLogic';

describe('実績解除ダイアログの閉じ判定', () => {
  test('移動量がしきい値未満で速度も遅い場合は閉じない', () => {
    expect(shouldDismissAchievementModalSwipe({ dx: 12, dy: 10, vx: 0.1, vy: 0.1 })).toBe(false);
  });

  test('移動量がしきい値以上の場合は閉じる', () => {
    expect(shouldDismissAchievementModalSwipe({ dx: ACHIEVEMENT_MODAL_SWIPE_DISMISS_DISTANCE, dy: 0, vx: 0, vy: 0 })).toBe(true);
  });

  test('速度がしきい値以上の場合は閉じる', () => {
    expect(shouldDismissAchievementModalSwipe({ dx: 1, dy: 1, vx: ACHIEVEMENT_MODAL_SWIPE_DISMISS_VELOCITY, vy: 0 })).toBe(true);
  });

  test('中断時は移動量がしきい値以上の場合だけ閉じる', () => {
    expect(shouldDismissAchievementModalTerminate({ dx: ACHIEVEMENT_MODAL_SWIPE_DISMISS_DISTANCE - 1, dy: 0 })).toBe(false);
    expect(shouldDismissAchievementModalTerminate({ dx: ACHIEVEMENT_MODAL_SWIPE_DISMISS_DISTANCE, dy: 0 })).toBe(true);
  });
});
