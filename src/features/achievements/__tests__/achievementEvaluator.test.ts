import { AchievementDefinition } from '@/features/achievements/achievementDefinitions';
import {
  evaluateAchievementUnlocks,
  getProgressValueForCondition,
  isAchievementConditionMet,
} from '@/features/achievements/achievementEvaluator';

const definitions: AchievementDefinition[] = [
  {
    id: 'distance-100',
    title: '100km',
    description: '100km歩く',
    category: 'distance',
    condition: { type: 'totalDistanceMeters', threshold: 100 },
    trophyImage: 1,
    trophyImageUri: null,
    shareText: '100km',
    sortOrder: 1,
    enabled: true,
  },
  {
    id: 'log-days-7',
    title: '7日',
    description: '7日記録する',
    category: 'logDays',
    condition: { type: 'logDays', threshold: 7 },
    trophyImage: 1,
    trophyImageUri: null,
    shareText: '7日',
    sortOrder: 2,
    enabled: true,
  },
  {
    id: 'prefectures-5',
    title: '5都道府県',
    description: '5都道府県を訪問する',
    category: 'prefecture',
    condition: { type: 'prefectureCount', threshold: 5 },
    trophyImage: 1,
    trophyImageUri: null,
    shareText: '5都道府県',
    sortOrder: 3,
    enabled: true,
  },
];

describe('実績評価 achievementEvaluator', () => {
  it('条件ごとの進捗値を取得する', () => {
    const progress = { totalDistanceMeters: 120, logDays: 7, prefectureCount: 2, municipalityCount: 1, landmarkPackVisitedCounts: {} };

    expect(getProgressValueForCondition({ type: 'totalDistanceMeters', threshold: 100 }, progress)).toBe(120);
    expect(getProgressValueForCondition({ type: 'logDays', threshold: 7 }, progress)).toBe(7);
  });

  it('閾値以上の場合に達成済みと判定する', () => {
    expect(
      isAchievementConditionMet(
        { type: 'prefectureCount', threshold: 5 },
        { totalDistanceMeters: 0, logDays: 0, prefectureCount: 5, municipalityCount: 0, landmarkPackVisitedCounts: {} },
      ),
    ).toBe(true);
  });

  it('未解除かつ達成済みの実績だけを返す', () => {
    const unlocked = evaluateAchievementUnlocks(
      { totalDistanceMeters: 150, logDays: 7, prefectureCount: 1, municipalityCount: 0, landmarkPackVisitedCounts: {} },
      new Set(['distance-100']),
      definitions,
    );

    expect(unlocked.map((definition) => definition.id)).toEqual(['log-days-7']);
  });
});

describe('スポットパック完走の判定', () => {
  it('全スポット到達で完走条件を満たす', () => {
    const condition = { type: 'landmarkPackCompletion' as const, packId: 'pack-falls', threshold: 3 };

    expect(
      isAchievementConditionMet(condition, {
        totalDistanceMeters: 0,
        logDays: 0,
        prefectureCount: 0,
        municipalityCount: 0,
        landmarkPackVisitedCounts: { 'pack-falls': 3 },
      }),
    ).toBe(true);
  });

  it('1件でも未到達なら完走しない', () => {
    const condition = { type: 'landmarkPackCompletion' as const, packId: 'pack-falls', threshold: 3 };

    expect(
      isAchievementConditionMet(condition, {
        totalDistanceMeters: 0,
        logDays: 0,
        prefectureCount: 0,
        municipalityCount: 0,
        landmarkPackVisitedCounts: { 'pack-falls': 2 },
      }),
    ).toBe(false);
  });

  it('未知のパックIDは0件として扱う', () => {
    const condition = { type: 'landmarkPackCompletion' as const, packId: 'pack-unknown', threshold: 3 };

    expect(
      isAchievementConditionMet(condition, {
        totalDistanceMeters: 0,
        logDays: 0,
        prefectureCount: 0,
        municipalityCount: 0,
        landmarkPackVisitedCounts: {},
      }),
    ).toBe(false);
  });
});
