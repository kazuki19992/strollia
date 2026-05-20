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
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (evaluateAndStoreAchievementUnlocks as jest.Mock).mockResolvedValue([]);
    (recordVisitedAdminAreasForPoint as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

  it('行政区域履歴の記録に失敗しても警告して実績評価を続ける', async () => {
    const error = new Error('reverse geocode failed');
    (recordVisitedAdminAreasForPoint as jest.Mock).mockRejectedValueOnce(error);

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

    expect(console.warn).toHaveBeenCalledWith(
      'Failed to record admin area for saved point:',
      expect.objectContaining({ localDate: '2026-05-07', locationPointId: 123, error }),
    );
    expect(evaluateAndStoreAchievementUnlocks).toHaveBeenCalledTimes(1);
  });
});
