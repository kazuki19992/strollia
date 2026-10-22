import * as Notifications from 'expo-notifications';

import { notifyLandmarkSpotArrival } from '@/features/landmarks/landmarkNotificationService';
import { getVisitedLandmarkSpotIds } from '@/features/landmarks/landmarkVisitRepository';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
}));

jest.mock('@/features/landmarks/landmarkVisitRepository', () => ({
  getVisitedLandmarkSpotIds: jest.fn(),
}));

// 実績通知チャンネルIDの参照だけで設定リポジトリ経由の実SQLiteを開かないよう遮断する
jest.mock('@/features/settings/settingsRepository', () => ({
  getBooleanSetting: jest.fn(),
  setSetting: jest.fn(),
}));

jest.mock('@/features/achievements/achievementRepository', () => ({
  markAchievementPushDelivered: jest.fn(),
}));

/** 華厳の滝(日本三名瀑の1件目)のスポットID。 */
const KEGON_ID = '01a0c450-6c00-7000-8000-000000000101';

/** 那智の滝(日本三名瀑の2件目)のスポットID。 */
const NACHI_ID = '01a0c450-6c00-7000-8000-000000000102';

describe('スポット到達通知 landmarkNotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getVisitedLandmarkSpotIds as jest.Mock).mockResolvedValue(new Set([KEGON_ID]));
  });

  it('通知が許可されていなければ何も送らない', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });

    await notifyLandmarkSpotArrival(KEGON_ID);

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('スポット名とパック進捗を本文に含める', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });

    await notifyLandmarkSpotArrival(KEGON_ID);

    const [[request]] = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
    expect(request.content.title).toBe('スポットに到達しました！');
    expect(request.content.body).toContain('華厳の滝');
    expect(request.content.body).toContain('日本三名瀑 1/3');
  });

  it('進捗は到達記録を取り直した結果で数える', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (getVisitedLandmarkSpotIds as jest.Mock).mockResolvedValue(new Set([KEGON_ID, NACHI_ID]));

    await notifyLandmarkSpotArrival(NACHI_ID);

    const [[request]] = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
    expect(request.content.body).toBe('那智の滝に到達しました（日本三名瀑 2/3）');
  });

  it('実績と同じ通知チャンネルとスポットIDを添えて送る', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });

    await notifyLandmarkSpotArrival(KEGON_ID);

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          channelId: 'achievements',
          data: { landmarkSpotId: KEGON_ID },
          sound: true,
          vibrate: [0, 1000],
        }),
        trigger: null,
      }),
    );
  });

  it('トロフィー画像は添付せず控えめな通知にする', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });

    await notifyLandmarkSpotArrival(KEGON_ID);

    const [[request]] = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
    expect(request.content.attachments).toBeUndefined();
  });

  it('マスタに存在しないスポットIDでは何も送らない', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });

    await notifyLandmarkSpotArrival('01a0c450-6c00-7000-8000-00000000ffff');

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(getVisitedLandmarkSpotIds).not.toHaveBeenCalled();
  });
});
