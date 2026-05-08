import { AchievementDefinition } from '../../../features/achievements/achievementDefinitions';
import { AchievementListItem } from '../../../features/achievements/achievementRepository';
jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: () => null,
}));

const { getAchievementProgressLabel } = require('../AchievementListScreen') as typeof import('../AchievementListScreen');

/** テスト用の実績一覧項目を作る。 */
function item(condition: AchievementDefinition['condition'], progressValue: number, unlockedAt: string | null = null): AchievementListItem {
  return {
    definition: {
      id: `test-${condition.type}`,
      title: 'テスト実績',
      description: 'テスト用です。',
      category: condition.type === 'prefectureCount' ? 'prefecture' : condition.type === 'municipalityCount' ? 'municipality' : 'distance',
      condition,
      trophyImage: 1,
      trophyImageUri: null,
      shareText: '共有文言',
      sortOrder: 1,
      enabled: true,
    },
    unlockedAt,
    progressValue,
  };
}

describe('実績進捗ラベル getAchievementProgressLabel', () => {
  test('解除済みの場合は達成日を表示する', () => {
    expect(getAchievementProgressLabel(item({ type: 'logDays', threshold: 7 }, 7, '2026-05-08T00:00:00.000Z'))).toContain('達成:');
  });

  test('総移動距離の進捗をkmで表示する', () => {
    expect(getAchievementProgressLabel(item({ type: 'totalDistanceMeters', threshold: 100_000 }, 50_000))).toBe('50km / 100km');
  });

  test('ログ記録日数の進捗を表示する', () => {
    expect(getAchievementProgressLabel(item({ type: 'logDays', threshold: 7 }, 3))).toBe('3 / 7 日');
  });

  test('都道府県訪問数の進捗を表示する', () => {
    expect(getAchievementProgressLabel(item({ type: 'prefectureCount', threshold: 47 }, 5))).toBe('5 / 47 都道府県');
  });

  test('市区町村訪問数の進捗を表示する', () => {
    expect(getAchievementProgressLabel(item({ type: 'municipalityCount', threshold: 1000 }, 50))).toBe('50 / 1000 市区町村');
  });
});
