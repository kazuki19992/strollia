import { evaluateAndStoreAchievementUnlocks, resetAchievementUnlocksForDevelopment } from '../achievementRepository';
import { evaluateAchievementsAndNotify, processAchievementsForSavedPoint } from '../achievementService';
import { notifyAchievementUnlocks } from '../achievementNotificationService';
import { recordVisitedAdminAreasForPoint } from '../adminAreaResolver';

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
    (recordVisitedAdminAreasForPoint as jest.Mock).mockResolvedValue(undefined);
  });

  it('開発用オプションが有効な場合は解除済み実績をリセットしてから再評価する', async () => {
    await evaluateAchievementsAndNotify({ resetBeforeEvaluate: true });

    expect(resetAchievementUnlocksForDevelopment).toHaveBeenCalledTimes(1);
    expect(evaluateAndStoreAchievementUnlocks).toHaveBeenCalledTimes(1);
    expect(notifyAchievementUnlocks).toHaveBeenCalledWith([]);
  });

  it('通常評価では解除済み実績をリセットせず評価と通知を行う', async () => {
    await evaluateAchievementsAndNotify();

    expect(resetAchievementUnlocksForDevelopment).not.toHaveBeenCalled();
    expect(evaluateAndStoreAchievementUnlocks).toHaveBeenCalledTimes(1);
    expect(notifyAchievementUnlocks).toHaveBeenCalledTimes(1);
  });

  it('保存済みGPSポイントIDを行政区域履歴の記録へ渡す', async () => {
    await processAchievementsForSavedPoint(
      {
        recordedAt: '2026-05-07T00:00:00.000Z',
        localDate: '2026-05-07',
        latitude: 35,
        longitude: 139,
        altitude: null,
        speed: null,
        heading: null,
        accuracy: 10,
        altitudeAccuracy: null,
      },
      123,
    );

    expect(recordVisitedAdminAreasForPoint).toHaveBeenCalledWith(expect.objectContaining({ localDate: '2026-05-07' }), 123);
  });
});
