import type { AchievementDefinition } from '@/features/achievements/achievementDefinitions';
import type { AchievementListItem } from '@/features/achievements/achievementRepository';
import { resolveAchievementDisplayStates } from '@/app/components/achievementDisplayState';

/** テスト用の実績一覧項目を作る。 */
function item(id: string, category: AchievementDefinition['category'], sortOrder: number, unlockedAt: string | null): AchievementListItem {
  return {
    definition: {
      id,
      title: id,
      description: '',
      category,
      condition: { type: 'logDays', threshold: 1 },
      trophyImage: 1,
      trophyImageUri: null,
      shareText: '',
      sortOrder,
      enabled: true,
    },
    unlockedAt,
    progressValue: 0,
  };
}

describe('表示状態判定 resolveAchievementDisplayStates', () => {
  test('カテゴリ内で解除済み→次→それ以降を判定する', () => {
    const items = [
      item('a1', 'distance', 1001, '2026-01-01T00:00:00.000Z'),
      item('a2', 'distance', 1002, null),
      item('a3', 'distance', 1003, null),
    ];

    const states = resolveAchievementDisplayStates(items);

    expect(states.get('a1')).toBe('unlocked');
    expect(states.get('a2')).toBe('next');
    expect(states.get('a3')).toBe('hidden');
  });

  test('カテゴリごとに独立して next を決める', () => {
    const items = [item('d1', 'distance', 1001, null), item('p1', 'prefecture', 4001, null)];

    const states = resolveAchievementDisplayStates(items);

    expect(states.get('d1')).toBe('next');
    expect(states.get('p1')).toBe('next');
  });

  test('sortOrder が逆順で渡っても昇順で next を決める', () => {
    const items = [
      item('a3', 'distance', 1003, null),
      item('a1', 'distance', 1001, '2026-01-01T00:00:00.000Z'),
      item('a2', 'distance', 1002, null),
    ];

    const states = resolveAchievementDisplayStates(items);

    expect(states.get('a2')).toBe('next');
    expect(states.get('a3')).toBe('hidden');
  });
});
