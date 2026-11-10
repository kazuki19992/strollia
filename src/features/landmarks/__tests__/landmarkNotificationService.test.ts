import * as Notifications from 'expo-notifications';

import { notifyLandmarkAreaArrival, notifyLandmarkSpotArrival } from '@/features/landmarks/landmarkNotificationService';
import { getVisitedLandmarkSpotIds } from '@/features/landmarks/landmarkVisitRepository';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
}));

/** テスト用の複数地点スポットID。マスタに複数地点スポットが無くても検証できるよう差し替える。 */
const MULTI_SPOT_ID = 'multi-spot';

/** テスト用の複数地点スポット。日本三名瀑パックに所属させ、進捗の書式を既存と同じ経路で確かめる。 */
const MULTI_SPOT = {
  id: 'multi-spot',
  name: '二地点スポット',
  areas: [
    { id: 'multi-area-a', name: '地点A', latitude: 35, longitude: 139, radiusMeters: 100, dwellSeconds: 60 },
    { id: 'multi-area-b', name: '地点B', latitude: 35.1, longitude: 139.1, radiusMeters: 100, dwellSeconds: 60 },
  ],
  isMultiArea: true,
  packs: [{ packId: '01a0c450-6c00-7000-8000-000000000001', order: 9 }],
};

jest.mock('@/features/landmarks/landmarkCatalog', () => {
  const actual = jest.requireActual('@/features/landmarks/landmarkCatalog');
  return {
    ...actual,
    getLandmarkSpotById: (id: string) => (id === 'multi-spot' ? MULTI_SPOT : actual.getLandmarkSpotById(id)),
    getLandmarkAreaById: (id: string) =>
      id === 'multi-area-a' ? { area: MULTI_SPOT.areas[0], spot: MULTI_SPOT } : actual.getLandmarkAreaById(id),
  };
});

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

  it('複数地点スポットのコンプリートは専用の文言で通知する', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });

    await notifyLandmarkSpotArrival(MULTI_SPOT_ID);

    const [[request]] = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
    expect(request.content.title).toBe('スポットをコンプリートしました！');
    expect(request.content.body).toBe('二地点スポットをコンプリートしました（日本三名瀑 1/3）');
    expect(request.content.data).toEqual({ landmarkSpotId: MULTI_SPOT_ID });
  });
});

describe('地点到達通知 notifyLandmarkAreaArrival', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('地点名とスポット内の進捗を本文に含め、地点IDとスポットIDを添える', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });

    await notifyLandmarkAreaArrival({ areaId: 'multi-area-a', visitedAreaCount: 1, totalAreaCount: 2 });

    const [[request]] = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
    expect(request.content.title).toBe('地点に到達しました！');
    expect(request.content.body).toBe('地点Aに到達しました（二地点スポット 1/2）');
    expect(request.content.data).toEqual({ landmarkAreaId: 'multi-area-a', landmarkSpotId: MULTI_SPOT_ID });
    expect(request.content.channelId).toBe('achievements');
  });

  it('通知が許可されていなければ何も送らない', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });

    await notifyLandmarkAreaArrival({ areaId: 'multi-area-a', visitedAreaCount: 1, totalAreaCount: 2 });

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('マスタに存在しない地点IDでは何も送らない', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });

    await notifyLandmarkAreaArrival({ areaId: 'unknown-area', visitedAreaCount: 1, totalAreaCount: 2 });

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
