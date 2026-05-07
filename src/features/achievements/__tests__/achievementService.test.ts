import { evaluateAndStoreAchievementUnlocks, resetAchievementUnlocksForDevelopment } from '../achievementRepository';
import { evaluateAchievementsAndNotify } from '../achievementService';
import { notifyAchievementUnlocks } from '../achievementNotificationService';

jest.mock('../adminAreaResolver', () => ({
  recordVisitedAdminAreasForPoint: jest.fn(),
}));

jest.mock('../achievementRepository', () => ({
  evaluateAndStoreAchievementUnlocks: jest.fn(),
  resetAchievementUnlocksForDevelopment: jest.fn(),
}));

jest.mock('../achievementNotificationService', () => ({
  notifyAchievementUnlocks: jest.fn(),
}));

describe('実績サービス achievementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (evaluateAndStoreAchievementUnlocks as jest.Mock).mockResolvedValue([]);
  });

  it('開発用オプションが有効な場合は解除済み実績をリセットしてから再評価する', async () => {
    await evaluateAchievementsAndNotify({ resetBeforeEvaluate: true });

    expect(resetAchievementUnlocksForDevelopment).toHaveBeenCalledTimes(1);
    expect(evaluateAndStoreAchievementUnlocks).toHaveBeenCalledTimes(1);
    expect(notifyAchievementUnlocks).toHaveBeenCalledWith([]);
  });

  it('通常評価では解除済み実績をリセットしない', async () => {
    await evaluateAchievementsAndNotify();

    expect(resetAchievementUnlocksForDevelopment).not.toHaveBeenCalled();
  });
});
