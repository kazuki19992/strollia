/** スワイプ閉じとして扱う移動量。 */
export const ACHIEVEMENT_MODAL_SWIPE_DISMISS_DISTANCE = 64;

/** 勢いで閉じる場合の速度。 */
export const ACHIEVEMENT_MODAL_SWIPE_DISMISS_VELOCITY = 0.65;

/** 実績解除ダイアログのスワイプ操作量。 */
export type AchievementModalSwipeGesture = {
  /** 横方向の移動量。 */
  dx: number;
  /** 縦方向の移動量。 */
  dy: number;
  /** 横方向の速度。 */
  vx: number;
  /** 縦方向の速度。 */
  vy: number;
};

/**
 * スワイプ操作を実績解除ダイアログの閉じ操作として扱うか判定する。
 *
 * @param gesture スワイプ操作の移動量と速度。
 * @returns 閉じ操作として扱う場合はtrue。
 */
export function shouldDismissAchievementModalSwipe(gesture: AchievementModalSwipeGesture): boolean {
  const distance = Math.hypot(gesture.dx, gesture.dy);
  const velocity = Math.hypot(gesture.vx, gesture.vy);

  return distance >= ACHIEVEMENT_MODAL_SWIPE_DISMISS_DISTANCE || velocity >= ACHIEVEMENT_MODAL_SWIPE_DISMISS_VELOCITY;
}

/**
 * PanResponderの中断時に実績解除ダイアログの閉じ操作として扱うか判定する。
 *
 * @param gesture スワイプ操作の移動量。
 * @returns 閉じ操作として扱う場合はtrue。
 */
export function shouldDismissAchievementModalTerminate(gesture: Pick<AchievementModalSwipeGesture, 'dx' | 'dy'>): boolean {
  const distance = Math.hypot(gesture.dx, gesture.dy);

  return distance >= ACHIEVEMENT_MODAL_SWIPE_DISMISS_DISTANCE;
}
