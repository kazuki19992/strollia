import { NewLocationPoint } from '../../types/gps';
import { recordVisitedAdminAreasForPoint } from './adminAreaResolver';
import { AchievementDefinition } from './achievementDefinitions';
import { evaluateAndStoreAchievementUnlocks, resetAchievementUnlocksForDevelopment } from './achievementRepository';
import { notifyAchievementUnlocks } from './achievementNotificationService';

/** 実績評価サービスのオプション。 */
export type EvaluateAchievementsAndNotifyOptions = {
  /** 開発中の動作確認用に解除済み実績を消してから再評価する。 */
  resetBeforeEvaluate?: boolean;
};

/** 保存済み進捗を再評価し、新規解除実績があれば通知する。 */
export async function evaluateAchievementsAndNotify(options: EvaluateAchievementsAndNotifyOptions = {}): Promise<AchievementDefinition[]> {
  if (options.resetBeforeEvaluate) {
    await resetAchievementUnlocksForDevelopment();
  }

  const newlyUnlocked = await evaluateAndStoreAchievementUnlocks();
  await notifyAchievementUnlocks(newlyUnlocked);
  return newlyUnlocked;
}

/** 新規GPSポイント保存後に訪問エリアと実績を更新する。 */
export async function processAchievementsForSavedPoint(point: NewLocationPoint): Promise<AchievementDefinition[]> {
  await recordVisitedAdminAreasForPoint(point).catch(() => undefined);
  return evaluateAchievementsAndNotify();
}
