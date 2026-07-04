import { AchievementListItem } from '@/features/achievements/achievementRepository';

/** 実績グリッドの表示状態。 */
export type AchievementDisplayState = 'unlocked' | 'next' | 'hidden';

/**
 * カテゴリごとに sortOrder 昇順で表示状態を解決する。
 *
 * @param items 実績一覧。
 * @returns 実績IDから表示状態へのマップ。
 */
export function resolveAchievementDisplayStates(items: AchievementListItem[]): Map<string, AchievementDisplayState> {
  const byCategory = new Map<string, AchievementListItem[]>();

  for (const item of items) {
    const category = item.definition.category;
    const list = byCategory.get(category) ?? [];
    list.push(item);
    byCategory.set(category, list);
  }

  const states = new Map<string, AchievementDisplayState>();

  for (const list of byCategory.values()) {
    const sorted = [...list].sort((a, b) => a.definition.sortOrder - b.definition.sortOrder);
    let firstLockedSeen = false;

    for (const item of sorted) {
      if (item.unlockedAt != null) {
        states.set(item.definition.id, 'unlocked');
        continue;
      }

      if (!firstLockedSeen) {
        firstLockedSeen = true;
        states.set(item.definition.id, 'next');
        continue;
      }

      states.set(item.definition.id, 'hidden');
    }
  }

  return states;
}
