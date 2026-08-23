import type { LocationObject } from 'expo-location';

import type { NewLocationPoint } from '@/types/gps';
import type { StayPlace } from '@/features/stayPlaces/stayPlaceTypes';

import { beginGpxImportPriority, resetGpxImportPriorityForTest } from '@/features/location/gpxImportPriority';
import { createLocationRecordingSession, flushLocationsBufferedDuringGpxImport } from '@/features/location/locationRecordingSession';

const mockInitializeDatabase = jest.fn();
const mockProcessAchievementsForSavedPoint = jest.fn();
const mockGetLatestLocationPoint = jest.fn();
const mockRecordLocationObservation = jest.fn();
const mockToLocationPoint = jest.fn();

jest.mock('@/db/database', () => ({
  initializeDatabase: (...args: unknown[]) => mockInitializeDatabase(...args),
}));

jest.mock('@/features/achievements/achievementService', () => ({
  processAchievementsForSavedPoint: (...args: unknown[]) => mockProcessAchievementsForSavedPoint(...args),
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
    mockRecordLocationObservation.mockResolvedValue({ status: 'not-saved' });
    mockProcessAchievementsForSavedPoint.mockResolvedValue(undefined);
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
});

describe('GPXインポート優先モードのバッファリング', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetGpxImportPriorityForTest();
    mockInitializeDatabase.mockResolvedValue(undefined);
    mockToLocationPoint.mockImplementation((item: LocationObject) => (item.timestamp === 1 ? firstPoint : secondPoint));
    mockRecordLocationObservation.mockResolvedValue({ status: 'not-saved' });
    mockProcessAchievementsForSavedPoint.mockResolvedValue(undefined);
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
      .mockResolvedValueOnce({ status: 'not-saved' })
      .mockRejectedValueOnce(new Error('database is locked'))
      .mockResolvedValue({ status: 'not-saved' });
    const session = await createLocationRecordingSession();

    await expect(session.recordLocations([location(20), location(10)])).rejects.toThrow('database is locked');
    await session.recordLocations([]);

    expect(mockRecordLocationObservation).toHaveBeenCalledTimes(3);
    expect(mockRecordLocationObservation.mock.calls[2][0].rawPoint.recordedAt).toBe(point('020').recordedAt);
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
    mockRecordLocationObservation.mockRejectedValueOnce(new Error('database is locked')).mockResolvedValue({ status: 'not-saved' });
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
