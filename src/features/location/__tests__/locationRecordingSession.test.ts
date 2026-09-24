import type { LocationObject } from 'expo-location';

import type { LandmarkDetectionSnapshot } from '@/features/landmarks/landmarkRecordingService';
import type { NewLocationPoint } from '@/types/gps';
import type { StayPlace } from '@/features/stayPlaces/stayPlaceTypes';

import { beginGpxImportPriority, resetGpxImportPriorityForTest } from '@/features/location/gpxImportPriority';
import { createLocationRecordingSession, flushLocationsBufferedDuringGpxImport } from '@/features/location/locationRecordingSession';

const mockInitializeDatabase = jest.fn();
const mockProcessAchievementsForSavedPoint = jest.fn();
const mockEvaluateAchievementsAndNotify = jest.fn();
const mockNotifyLandmarkSpotArrival = jest.fn();
const mockGetLatestLocationPoint = jest.fn();
const mockRecordLocationObservation = jest.fn();
const mockToLocationPoint = jest.fn();

jest.mock('@/db/database', () => ({
  initializeDatabase: (...args: unknown[]) => mockInitializeDatabase(...args),
}));

jest.mock('@/features/achievements/achievementService', () => ({
  processAchievementsForSavedPoint: (...args: unknown[]) => mockProcessAchievementsForSavedPoint(...args),
  evaluateAchievementsAndNotify: (...args: unknown[]) => mockEvaluateAchievementsAndNotify(...args),
}));

jest.mock('@/features/landmarks/landmarkNotificationService', () => ({
  notifyLandmarkSpotArrival: (...args: unknown[]) => mockNotifyLandmarkSpotArrival(...args),
}));

jest.mock('@/features/logs/logRepository', () => ({
  getLatestLocationPoint: (...args: unknown[]) => mockGetLatestLocationPoint(...args),
}));

jest.mock('@/features/location/locationObservationRecorder', () => ({
  recordLocationObservation: (...args: unknown[]) => mockRecordLocationObservation(...args),
}));

jest.mock('@/features/location/locationMapper', () => ({
  toLocationPoint: (...args: unknown[]) => mockToLocationPoint(...args),
}));

const firstPoint: NewLocationPoint = {
  recordedAt: '2026-06-19T00:00:10.000Z',
  localDate: '2026-06-19',
  latitude: 35.0001,
  longitude: 139,
  altitude: null,
  speed: 1,
  heading: null,
  accuracy: 5,
  altitudeAccuracy: null,
};

const secondPoint: NewLocationPoint = {
  ...firstPoint,
  recordedAt: '2026-06-19T00:00:20.000Z',
  latitude: 35.0002,
};

const effectivePoint: NewLocationPoint = {
  ...firstPoint,
  effectiveLatitude: 35,
  effectiveLongitude: 139,
  snappedStayPlaceId: 1,
};

const firstLocation = { timestamp: 1, coords: {} } as LocationObject;
const secondLocation = { timestamp: 2, coords: {} } as LocationObject;

const home: StayPlace = {
  id: 1,
  name: '自宅',
  iconHexcode: '1F3E0',
  latitude: 35,
  longitude: 139,
  privacyRadiusMeters: null,
  createdAt: '2026-08-19T00:00:00.000Z',
  updatedAt: '2026-08-19T00:00:00.000Z',
};

/** Plus有効時のスポット検知スナップショット。 */
const enabledDetection: LandmarkDetectionSnapshot = { status: 'enabled', spots: [], visitedSpotIds: new Set<string>() };

/** 到達確定を表すスポットID(華厳の滝)。 */
const arrivedSpotId = '01a0c450-6c00-7000-8000-000000000101';

/** 指定timestampのExpo位置情報を作る。 */
function location(timestamp: number): LocationObject {
  return { timestamp, coords: {} } as LocationObject;
}

/** 観測日時を識別できる生GPS点を作る。 */
function point(recordedAt: string): NewLocationPoint {
  return { ...firstPoint, recordedAt };
}

describe('位置情報保存セッション', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInitializeDatabase.mockResolvedValue(undefined);
    mockToLocationPoint.mockImplementation((item: LocationObject) => (item.timestamp === 1 ? firstPoint : secondPoint));
    mockRecordLocationObservation.mockResolvedValue({ status: 'not-saved', arrivedLandmarkSpotId: null });
    mockProcessAchievementsForSavedPoint.mockResolvedValue(undefined);
    mockEvaluateAchievementsAndNotify.mockResolvedValue([]);
    mockNotifyLandmarkSpotArrival.mockResolvedValue(undefined);
  });

  it('セッション開始時に最新GPS点を取得せず、RecorderへGrid補間起点を渡さない', async () => {
    const session = await createLocationRecordingSession();

    await session.recordLocations([firstLocation]);
    await session.recordLocations([secondLocation]);

    expect(mockInitializeDatabase).toHaveBeenCalledTimes(1);
    expect(mockGetLatestLocationPoint).not.toHaveBeenCalled();
    expect(mockRecordLocationObservation).toHaveBeenNthCalledWith(1, expect.objectContaining({ rawPoint: firstPoint }));
    expect(mockRecordLocationObservation).toHaveBeenNthCalledWith(2, expect.objectContaining({ rawPoint: secondPoint }));
    expect(mockRecordLocationObservation.mock.calls[0][0]).not.toHaveProperty('previousVisitedCellPoint');
    expect(mockRecordLocationObservation.mock.calls[1][0]).not.toHaveProperty('previousVisitedCellPoint');
  });

  it('受信順が前後したバッチを観測日時順にRecorderへ渡す', async () => {
    mockToLocationPoint.mockImplementation((item: LocationObject) => point(String(item.timestamp).padStart(3, '0')));
    const session = await createLocationRecordingSession();

    await session.recordLocations([location(30), location(10), location(20)]);

    expect(mockRecordLocationObservation.mock.calls.map(([input]) => input.rawPoint.recordedAt)).toEqual([
      point('010').recordedAt,
      point('020').recordedAt,
      point('030').recordedAt,
    ]);
  });

  it('同じ観測日時の位置情報は受信順を保ってRecorderへ渡す', async () => {
    const firstAtSameTime = { timestamp: 10, coords: { latitude: 35 } } as LocationObject;
    const secondAtSameTime = { timestamp: 10, coords: { latitude: 36 } } as LocationObject;
    mockToLocationPoint.mockImplementation((item: LocationObject) =>
      point(item.coords.latitude === 35 ? 'first-at-same-time' : 'second-at-same-time'),
    );
    const session = await createLocationRecordingSession();

    await session.recordLocations([firstAtSameTime, secondAtSameTime]);

    expect(mockRecordLocationObservation.mock.calls.map(([input]) => input.rawPoint.recordedAt)).toEqual([
      'first-at-same-time',
      'second-at-same-time',
    ]);
  });

  it('滞在場所取得失敗をunavailableとしてRecorderへ渡す', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const session = await createLocationRecordingSession({
      getActiveStayPlaces: async () => {
        throw new Error('RevenueCat unavailable');
      },
    });

    await session.recordLocations([firstLocation]);

    expect(mockRecordLocationObservation).toHaveBeenCalledWith(expect.objectContaining({ activeStayPlaces: { status: 'unavailable' } }));
    expect(warn).toHaveBeenCalledWith('Stay place loading failed:', expect.any(Error));
    warn.mockRestore();
  });

  it('保存確定した点だけを実績処理へ渡す', async () => {
    mockRecordLocationObservation.mockResolvedValue({
      status: 'saved',
      point: effectivePoint,
      locationPointId: 11,
      arrivedLandmarkSpotId: null,
    });
    const session = await createLocationRecordingSession();

    await session.recordLocations([firstLocation]);

    expect(mockProcessAchievementsForSavedPoint).toHaveBeenCalledWith(effectivePoint, 11);
  });

  it('GPSポイント保存後に実績を処理し、実績失敗は呼び出し元へ伝播させない', async () => {
    mockRecordLocationObservation.mockResolvedValue({
      status: 'saved',
      point: effectivePoint,
      locationPointId: 11,
      arrivedLandmarkSpotId: null,
    });
    mockProcessAchievementsForSavedPoint.mockRejectedValueOnce(new Error('achievement failed'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const session = await createLocationRecordingSession();

    await expect(session.recordLocations([firstLocation])).resolves.toBeUndefined();

    expect(mockRecordLocationObservation).toHaveBeenCalledTimes(1);
    expect(mockProcessAchievementsForSavedPoint).toHaveBeenCalledWith(effectivePoint, 11);
    expect(warn).toHaveBeenCalledWith('Achievement processing failed:', expect.any(Error));
    warn.mockRestore();
  });

  it('空配列では位置変換や記録処理を行わない', async () => {
    const session = await createLocationRecordingSession();

    await session.recordLocations([]);

    expect(mockToLocationPoint).not.toHaveBeenCalled();
    expect(mockRecordLocationObservation).not.toHaveBeenCalled();
    expect(mockProcessAchievementsForSavedPoint).not.toHaveBeenCalled();
  });

  it('1回の位置情報バッチでは有効な滞在場所を1回だけ読み込む', async () => {
    const getActiveStayPlaces = jest.fn().mockResolvedValue([home]);
    const session = await createLocationRecordingSession({ getActiveStayPlaces });

    await session.recordLocations([firstLocation, secondLocation]);

    expect(getActiveStayPlaces).toHaveBeenCalledTimes(1);
    expect(mockRecordLocationObservation).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ activeStayPlaces: { status: 'ready', stayPlaces: [home] } }),
    );
    expect(mockRecordLocationObservation).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ activeStayPlaces: { status: 'ready', stayPlaces: [home] } }),
    );
  });

  it('1回の位置情報バッチではスポット検知対象を1回だけ読み込む', async () => {
    const getLandmarkDetection = jest.fn().mockResolvedValue(enabledDetection);
    const session = await createLocationRecordingSession({ getLandmarkDetection });

    await session.recordLocations([firstLocation, secondLocation]);

    expect(getLandmarkDetection).toHaveBeenCalledTimes(1);
    expect(mockRecordLocationObservation).toHaveBeenNthCalledWith(1, expect.objectContaining({ landmarkDetection: enabledDetection }));
    expect(mockRecordLocationObservation).toHaveBeenNthCalledWith(2, expect.objectContaining({ landmarkDetection: enabledDetection }));
  });

  it('スポット検知の取得関数が無い場合はdisabledをRecorderへ渡す', async () => {
    const session = await createLocationRecordingSession();

    await session.recordLocations([firstLocation]);

    expect(mockRecordLocationObservation).toHaveBeenCalledWith(expect.objectContaining({ landmarkDetection: { status: 'disabled' } }));
  });

  it('スポット検知の取得失敗をunavailableとしてRecorderへ渡す', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const session = await createLocationRecordingSession({
      getLandmarkDetection: async () => {
        throw new Error('RevenueCat unavailable');
      },
    });

    await session.recordLocations([firstLocation]);

    expect(mockRecordLocationObservation).toHaveBeenCalledWith(expect.objectContaining({ landmarkDetection: { status: 'unavailable' } }));
    expect(warn).toHaveBeenCalledWith('Landmark detection loading failed:', expect.any(Error));
    warn.mockRestore();
  });
});

describe('スポット到達時の通知と実績評価', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInitializeDatabase.mockResolvedValue(undefined);
    mockToLocationPoint.mockImplementation((item: LocationObject) => (item.timestamp === 1 ? firstPoint : secondPoint));
    mockRecordLocationObservation.mockResolvedValue({ status: 'not-saved', arrivedLandmarkSpotId: null });
    mockProcessAchievementsForSavedPoint.mockResolvedValue(undefined);
    mockEvaluateAchievementsAndNotify.mockResolvedValue([]);
    mockNotifyLandmarkSpotArrival.mockResolvedValue(undefined);
  });

  it('保存されない観測で到達しても通知する', async () => {
    mockRecordLocationObservation.mockResolvedValue({ status: 'not-saved', arrivedLandmarkSpotId: arrivedSpotId });
    const session = await createLocationRecordingSession();

    await session.recordLocations([firstLocation]);

    expect(mockNotifyLandmarkSpotArrival).toHaveBeenCalledTimes(1);
    expect(mockNotifyLandmarkSpotArrival).toHaveBeenCalledWith(arrivedSpotId);
  });

  it('保存された観測で到達しても通知する', async () => {
    mockRecordLocationObservation.mockResolvedValue({
      status: 'saved',
      point: effectivePoint,
      locationPointId: 11,
      arrivedLandmarkSpotId: arrivedSpotId,
    });
    const session = await createLocationRecordingSession();

    await session.recordLocations([firstLocation]);

    expect(mockNotifyLandmarkSpotArrival).toHaveBeenCalledWith(arrivedSpotId);
  });

  it('到達がなければ通知しない', async () => {
    const session = await createLocationRecordingSession();

    await session.recordLocations([firstLocation]);

    expect(mockNotifyLandmarkSpotArrival).not.toHaveBeenCalled();
  });

  it('到達通知の失敗は呼び出し元へ伝播させない', async () => {
    mockRecordLocationObservation.mockResolvedValue({ status: 'not-saved', arrivedLandmarkSpotId: arrivedSpotId });
    mockNotifyLandmarkSpotArrival.mockRejectedValueOnce(new Error('notification failed'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const session = await createLocationRecordingSession();

    await expect(session.recordLocations([firstLocation])).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith('Landmark arrival notification failed:', expect.any(Error));
    warn.mockRestore();
  });

  it('保存点が無い配信バッチでも到達があれば実績を評価する', async () => {
    // 立ち止まって到達した瞬間にパック完走実績を解除するため、保存点がなくても評価する
    mockRecordLocationObservation.mockResolvedValue({ status: 'not-saved', arrivedLandmarkSpotId: arrivedSpotId });
    const session = await createLocationRecordingSession();

    await session.recordLocations([firstLocation]);

    expect(mockEvaluateAchievementsAndNotify).toHaveBeenCalledTimes(1);
    expect(mockProcessAchievementsForSavedPoint).not.toHaveBeenCalled();
  });

  it('保存点がある場合は到達があっても実績評価を二重に走らせない', async () => {
    mockRecordLocationObservation.mockResolvedValue({
      status: 'saved',
      point: effectivePoint,
      locationPointId: 11,
      arrivedLandmarkSpotId: arrivedSpotId,
    });
    const session = await createLocationRecordingSession();

    await session.recordLocations([firstLocation]);

    expect(mockProcessAchievementsForSavedPoint).toHaveBeenCalledTimes(1);
    expect(mockEvaluateAchievementsAndNotify).not.toHaveBeenCalled();
  });

  it('到達がなければ保存点なしの配信バッチで実績を評価しない', async () => {
    const session = await createLocationRecordingSession();

    await session.recordLocations([firstLocation]);

    expect(mockEvaluateAchievementsAndNotify).not.toHaveBeenCalled();
    expect(mockProcessAchievementsForSavedPoint).not.toHaveBeenCalled();
  });

  it('到達による実績評価の失敗は呼び出し元へ伝播させない', async () => {
    mockRecordLocationObservation.mockResolvedValue({ status: 'not-saved', arrivedLandmarkSpotId: arrivedSpotId });
    mockEvaluateAchievementsAndNotify.mockRejectedValueOnce(new Error('achievement failed'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const session = await createLocationRecordingSession();

    await expect(session.recordLocations([firstLocation])).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith('Achievement processing failed:', expect.any(Error));
    warn.mockRestore();
  });

  it('到達通知は実績通知より先に流す', async () => {
    // 「到達しました」→「実績を達成しました」の順で届くよう、実績評価より前に通知する
    const callOrder: string[] = [];
    mockRecordLocationObservation.mockResolvedValue({
      status: 'saved',
      point: effectivePoint,
      locationPointId: 11,
      arrivedLandmarkSpotId: arrivedSpotId,
    });
    mockNotifyLandmarkSpotArrival.mockImplementation(async () => {
      callOrder.push('arrival');
    });
    mockProcessAchievementsForSavedPoint.mockImplementation(async () => {
      callOrder.push('achievement');
    });
    const session = await createLocationRecordingSession();

    await session.recordLocations([firstLocation]);

    expect(callOrder).toEqual(['arrival', 'achievement']);
  });
});

describe('GPXインポート優先モードのバッファリング', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetGpxImportPriorityForTest();
    mockInitializeDatabase.mockResolvedValue(undefined);
    mockToLocationPoint.mockImplementation((item: LocationObject) => (item.timestamp === 1 ? firstPoint : secondPoint));
    mockRecordLocationObservation.mockResolvedValue({ status: 'not-saved', arrivedLandmarkSpotId: null });
    mockProcessAchievementsForSavedPoint.mockResolvedValue(undefined);
    mockEvaluateAchievementsAndNotify.mockResolvedValue([]);
    mockNotifyLandmarkSpotArrival.mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetGpxImportPriorityForTest();
  });

  it('インポート中はRecorderへ渡さず位置情報をバッファへ退避する', async () => {
    const session = await createLocationRecordingSession();
    beginGpxImportPriority();

    await session.recordLocations([firstLocation]);

    expect(mockToLocationPoint).not.toHaveBeenCalled();
    expect(mockRecordLocationObservation).not.toHaveBeenCalled();
  });

  it('flushでバッファ分を通常のRecorderへまとめて取り込む', async () => {
    const session = await createLocationRecordingSession();
    beginGpxImportPriority();
    await session.recordLocations([firstLocation]);
    await session.recordLocations([secondLocation]);

    await flushLocationsBufferedDuringGpxImport();

    expect(mockToLocationPoint).toHaveBeenCalledTimes(2);
    expect(mockRecordLocationObservation).toHaveBeenCalledTimes(2);
    expect(mockRecordLocationObservation).toHaveBeenNthCalledWith(1, expect.objectContaining({ rawPoint: firstPoint }));
    expect(mockRecordLocationObservation).toHaveBeenNthCalledWith(2, expect.objectContaining({ rawPoint: secondPoint }));
  });

  it('バッファが空の場合はflushで何もしない', async () => {
    beginGpxImportPriority();

    await flushLocationsBufferedDuringGpxImport();

    expect(mockInitializeDatabase).not.toHaveBeenCalled();
    expect(mockRecordLocationObservation).not.toHaveBeenCalled();
  });

  it('flush後の位置情報は通常どおりRecorderへ渡す', async () => {
    const session = await createLocationRecordingSession();
    beginGpxImportPriority();
    await flushLocationsBufferedDuringGpxImport();

    await session.recordLocations([firstLocation]);

    expect(mockRecordLocationObservation).toHaveBeenCalledTimes(1);
  });

  it('ソート後の未処理観測だけを失敗時に再キューする', async () => {
    mockToLocationPoint.mockImplementation((item: LocationObject) => point(String(item.timestamp).padStart(3, '0')));
    mockRecordLocationObservation
      .mockResolvedValueOnce({ status: 'not-saved', arrivedLandmarkSpotId: null })
      .mockRejectedValueOnce(new Error('database is locked'))
      .mockResolvedValue({ status: 'not-saved', arrivedLandmarkSpotId: null });
    const session = await createLocationRecordingSession();

    await expect(session.recordLocations([location(20), location(10)])).rejects.toThrow('database is locked');
    await session.recordLocations([]);

    expect(mockRecordLocationObservation).toHaveBeenCalledTimes(3);
    expect(mockRecordLocationObservation.mock.calls[2][0].rawPoint.recordedAt).toBe(point('020').recordedAt);
  });

  it('後続Recorderが失敗しても確定済み点を実績処理し、失敗観測以降だけを再キューする', async () => {
    const recordingError = new Error('second observation failed');
    mockRecordLocationObservation
      .mockResolvedValueOnce({ status: 'saved', point: effectivePoint, locationPointId: 11, arrivedLandmarkSpotId: null })
      .mockRejectedValueOnce(recordingError)
      .mockResolvedValue({ status: 'not-saved', arrivedLandmarkSpotId: null });
    const session = await createLocationRecordingSession();

    await expect(session.recordLocations([firstLocation, secondLocation])).rejects.toBe(recordingError);

    expect(mockProcessAchievementsForSavedPoint).toHaveBeenCalledTimes(1);
    expect(mockProcessAchievementsForSavedPoint).toHaveBeenCalledWith(effectivePoint, 11);

    await session.recordLocations([]);

    expect(mockRecordLocationObservation).toHaveBeenCalledTimes(3);
    expect(mockRecordLocationObservation).toHaveBeenNthCalledWith(3, expect.objectContaining({ rawPoint: secondPoint }));
    expect(mockProcessAchievementsForSavedPoint).toHaveBeenCalledTimes(1);
  });

  it('確定済み点の実績処理が失敗しても後続Recorderの元エラーを再throwする', async () => {
    const recordingError = new Error('second observation failed');
    const achievementError = new Error('achievement failed');
    mockRecordLocationObservation
      .mockResolvedValueOnce({ status: 'saved', point: effectivePoint, locationPointId: 11, arrivedLandmarkSpotId: null })
      .mockRejectedValueOnce(recordingError);
    mockProcessAchievementsForSavedPoint.mockRejectedValueOnce(achievementError);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const session = await createLocationRecordingSession();

    await expect(session.recordLocations([firstLocation, secondLocation])).rejects.toBe(recordingError);

    expect(mockProcessAchievementsForSavedPoint).toHaveBeenCalledWith(effectivePoint, 11);
    expect(warn).toHaveBeenCalledWith('Achievement processing failed:', achievementError);
    warn.mockRestore();
  });

  it('flushが失敗した場合は退避分をバッファへ戻し、次の記録時に受信順を保って回収する', async () => {
    const session = await createLocationRecordingSession();
    beginGpxImportPriority();
    await session.recordLocations([firstLocation]);

    mockInitializeDatabase.mockRejectedValueOnce(new Error('database is locked'));
    await expect(flushLocationsBufferedDuringGpxImport()).rejects.toThrow('database is locked');

    await session.recordLocations([secondLocation]);

    expect(mockRecordLocationObservation).toHaveBeenCalledTimes(2);
    expect(mockRecordLocationObservation).toHaveBeenNthCalledWith(1, expect.objectContaining({ rawPoint: firstPoint }));
    expect(mockRecordLocationObservation).toHaveBeenNthCalledWith(2, expect.objectContaining({ rawPoint: secondPoint }));
  });

  it('flush中の記録失敗ではrecordLocations側だけがバッファへ戻し、二重復元しない', async () => {
    mockRecordLocationObservation
      .mockRejectedValueOnce(new Error('database is locked'))
      .mockResolvedValue({ status: 'not-saved', arrivedLandmarkSpotId: null });
    const session = await createLocationRecordingSession();
    beginGpxImportPriority();
    await session.recordLocations([firstLocation]);

    await expect(flushLocationsBufferedDuringGpxImport()).rejects.toThrow('database is locked');

    await session.recordLocations([secondLocation]);

    expect(mockToLocationPoint).toHaveBeenCalledTimes(3);
    expect(mockRecordLocationObservation).toHaveBeenCalledTimes(3);
    expect(mockRecordLocationObservation).toHaveBeenNthCalledWith(2, expect.objectContaining({ rawPoint: firstPoint }));
    expect(mockRecordLocationObservation).toHaveBeenNthCalledWith(3, expect.objectContaining({ rawPoint: secondPoint }));
  });
});
