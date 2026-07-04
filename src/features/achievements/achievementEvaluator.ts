import { ACHIEVEMENT_DEFINITIONS, AchievementDefinition, AchievementCondition } from './achievementDefinitions';

/** 実績判定に使う現在の進捗値。 */
export type AchievementProgress = {
  /** 総移動距離。単位はメートル。 */
  totalDistanceMeters: number;
  /** GPSログが存在する日数。 */
  logDays: number;
  /** 訪問済み都道府県数。 */
  prefectureCount: number;
  /** 訪問済み市区町村数。 */
  municipalityCount: number;
};

/** 実績定義の解除時に記録する進捗値を取り出す。 */
export function getProgressValueForCondition(condition: AchievementCondition, progress: AchievementProgress): number {
  switch (condition.type) {
    case 'totalDistanceMeters':
      return progress.totalDistanceMeters;
    case 'logDays':
      return progress.logDays;
    case 'prefectureCount':
      return progress.prefectureCount;
    case 'municipalityCount':
      return progress.municipalityCount;
  }
}

/** 実績条件が現在の進捗で達成済みか判定する。 */
export function isAchievementConditionMet(condition: AchievementCondition, progress: AchievementProgress): boolean {
  return getProgressValueForCondition(condition, progress) >= condition.threshold;
}

/** 未解除実績のうち、現在の進捗で新しく解除できるものを返す。 */
export function evaluateAchievementUnlocks(
  progress: AchievementProgress,
  unlockedAchievementIds: Set<string>,
  definitions = ACHIEVEMENT_DEFINITIONS,
): AchievementDefinition[] {
  return definitions.filter(
    (definition) =>
      definition.enabled && !unlockedAchievementIds.has(definition.id) && isAchievementConditionMet(definition.condition, progress),
  );
}
