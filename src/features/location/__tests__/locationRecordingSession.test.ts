import type { LocationObject } from 'expo-location';

import type { LocationPoint, NewLocationPoint } from '@/types/gps';

import { beginGpxImportPriority, resetGpxImportPriorityForTest } from '@/features/location/gpxImportPriority';
import { createLocationRecordingSession, flushLocationsBufferedDuringGpxImport } from '@/features/location/locationRecordingSession';

const mockInitializeDatabase = jest.fn();
const mockProcessAchievementsForSavedPoint = jest.fn();
const mockGetLatestLocationPoint = jest.fn();
const mockInsertLocationPoint = jest.fn();
const mockToLocationPoint = jest.fn();
const mockGetVisitedCellsForLocationPoint = jest.fn();
const mockShouldSaveLocationPoint = jest.fn();
const mockUpsertVisitedCells = jest.fn();

jest.mock('@/db/database', () => ({
  initializeDatabase: (...args: unknown[]) => mockInitializeDatabase(...args),
}));

jest.mock('@/features/achievements/achievementService', () => ({
  processAchievementsForSavedPoint: (...args: unknown[]) => mockProcessAchievementsForSavedPoint(...args),
}));

jest.mock('@/features/logs/logRepository', () => ({
  getLatestLocationPoint: (...args: unknown[]) => mockGetLatestLocationPoint(...args),
  insertLocationPoint: (...args: unknown[]) => mockInsertLocationPoint(...args),
}));

jest.mock('@/features/location/locationMapper', () => ({
  toLocationPoint: (...args: unknown[]) => mockToLocationPoint(...args),
}));

jest.mock('@/features/location/grid/gridInterpolation', () => ({
  getVisitedCellsForLocationPoint: (...args: unknown[]) => mockGetVisitedCellsForLocationPoint(...args),
}));

jest.mock('@/features/location/locationSaveFilter', () => ({
  shouldSaveLocationPoint: (...args: unknown[]) => mockShouldSaveLocationPoint(...args),
}));

jest.mock('@/features/location/visitedCellRepository', () => ({
  upsertVisitedCells: (...args: unknown[]) => mockUpsertVisitedCells(...args),
}));

const latestPoint: LocationPoint = {
  id: 10,
  recordedAt: '2026-06-19T00:00:00.000Z',
  localDate: '2026-06-19',
  latitude: 35,
  longitude: 139,
  altitude: null,
  speed: 1,
  heading: null,
  accuracy: 5,
  altitudeAccuracy: null,
};

const firstPoint: NewLocationPoint = {
  ...latestPoint,
  recordedAt: '2026-06-19T00:00:10.000Z',
  latitude: 35.0001,
};
delete (firstPoint as Partial<LocationPoint>).id;

const secondPoint: NewLocationPoint = {
  ...firstPoint,
  recordedAt: '2026-06-19T00:00:20.000Z',
  latitude: 35.0002,
};

const firstLocation = { timestamp: 1, coords: {} } as LocationObject;
const secondLocation = { timestamp: 2, coords: {} } as LocationObject;

describe('位置情報保存セッション', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInitializeDatabase.mockResolvedValue(undefined);
    mockGetLatestLocationPoint.mockResolvedValue(latestPoint);
    mockToLocationPoint.mockReturnValueOnce(firstPoint).mockReturnValueOnce(secondPoint);
    mockGetVisitedCellsForLocationPoint.mockReturnValue([{ cellId: 'cell' }]);
    mockUpsertVisitedCells.mockResolvedValue(undefined);
    mockShouldSaveLocationPoint.mockReturnValue(true);
    mockInsertLocationPoint.mockResolvedValueOnce(11).mockResolvedValueOnce(12);
    mockProcessAchievementsForSavedPoint.mockResolvedValue(undefined);
  });

  it('セッション開始時に最新点を一度だけ取得し、保存した前回点を次の呼び出しへ引き継ぐ', async () => {
    const session = await createLocationRecordingSession();

    await session.recordLocations([firstLocation]);
    await session.recordLocations([secondLocation]);

    expect(mockInitializeDatabase).toHaveBeenCalledTimes(1);
    expect(mockGetLatestLocationPoint).toHaveBeenCalledTimes(1);
    expect(mockShouldSaveLocationPoint).toHaveBeenNthCalledWith(1, firstPoint, latestPoint);
    expect(mockShouldSaveLocationPoint).toHaveBeenNthCalledWith(2, secondPoint, firstPoint);
    expect(mockInsertLocationPoint).toHaveBeenCalledTimes(2);
  });

  it('GPSログの保存対象外でもVisited Gridを更新し、次の補間へ観測点を引き継ぐ', async () => {
    mockShouldSaveLocationPoint.mockReturnValue(false);
    const session = await createLocationRecordingSession();

    await session.recordLocations([firstLocation]);
    await session.recordLocations([secondLocation]);

    expect(mockGetVisitedCellsForLocationPoint).toHaveBeenNthCalledWith(1, latestPoint, firstPoint);
    expect(mockGetVisitedCellsForLocationPoint).toHaveBeenNthCalledWith(2, firstPoint, secondPoint);
    expect(mockUpsertVisitedCells).toHaveBeenCalledTimes(2);
    expect(mockInsertLocationPoint).not.toHaveBeenCalled();
  });

  it('GPSポイント保存後に実績を処理し、実績失敗は呼び出し元へ伝播させない', async () => {
    mockProcessAchievementsForSavedPoint.mockRejectedValueOnce(new Error('achievement failed'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const session = await createLocationRecordingSession();

    await expect(session.recordLocations([firstLocation])).resolves.toBeUndefined();

    expect(mockInsertLocationPoint).toHaveBeenCalledWith(firstPoint);
    expect(mockProcessAchievementsForSavedPoint).toHaveBeenCalledWith(firstPoint, 11);
    expect(warn).toHaveBeenCalledWith('Achievement processing failed:', expect.any(Error));
    warn.mockRestore();
  });

  it('空配列では位置変換や保存処理を行わない', async () => {
    const session = await createLocationRecordingSession();

    await session.recordLocations([]);

    expect(mockToLocationPoint).not.toHaveBeenCalled();
    expect(mockUpsertVisitedCells).not.toHaveBeenCalled();
    expect(mockInsertLocationPoint).not.toHaveBeenCalled();
  });
});

describe('GPXインポート優先モードのバッファリング', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // mockReturnValueOnce のキューは clearAllMocks では消えず前の describe から持ち越されるため、明示的にリセットする
    mockToLocationPoint.mockReset();
    mockInsertLocationPoint.mockReset();
    resetGpxImportPriorityForTest();
    mockInitializeDatabase.mockResolvedValue(undefined);
    mockGetLatestLocationPoint.mockResolvedValue(latestPoint);
    mockToLocationPoint.mockReturnValueOnce(firstPoint).mockReturnValueOnce(secondPoint);
    mockGetVisitedCellsForLocationPoint.mockReturnValue([{ cellId: 'cell' }]);
    mockUpsertVisitedCells.mockResolvedValue(undefined);
    mockShouldSaveLocationPoint.mockReturnValue(true);
    mockInsertLocationPoint.mockResolvedValueOnce(11).mockResolvedValueOnce(12);
    mockProcessAchievementsForSavedPoint.mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetGpxImportPriorityForTest();
  });

  it('インポート中はDBへ書き込まず位置情報をバッファへ退避する', async () => {
    const session = await createLocationRecordingSession();
    beginGpxImportPriority();

    await session.recordLocations([firstLocation]);

    expect(mockToLocationPoint).not.toHaveBeenCalled();
    expect(mockUpsertVisitedCells).not.toHaveBeenCalled();
    expect(mockInsertLocationPoint).not.toHaveBeenCalled();
  });

  it('flushでバッファ分を通常の保存規則でまとめて取り込む', async () => {
    const session = await createLocationRecordingSession();
    beginGpxImportPriority();
    await session.recordLocations([firstLocation]);
    await session.recordLocations([secondLocation]);

    await flushLocationsBufferedDuringGpxImport();

    // flush内で新しいセッションが作られ、退避した2点が受信順に処理される
    expect(mockToLocationPoint).toHaveBeenCalledTimes(2);
    expect(mockInsertLocationPoint).toHaveBeenCalledTimes(2);
    expect(mockInsertLocationPoint).toHaveBeenNthCalledWith(1, firstPoint);
    expect(mockInsertLocationPoint).toHaveBeenNthCalledWith(2, secondPoint);
  });

  it('バッファが空の場合はflushで何もしない', async () => {
    beginGpxImportPriority();

    await flushLocationsBufferedDuringGpxImport();

    expect(mockInitializeDatabase).not.toHaveBeenCalled();
    expect(mockInsertLocationPoint).not.toHaveBeenCalled();
  });

  it('flush後の位置情報は通常どおりDBへ書き込まれる', async () => {
    const session = await createLocationRecordingSession();
    beginGpxImportPriority();
    await flushLocationsBufferedDuringGpxImport();

    await session.recordLocations([firstLocation]);

    expect(mockInsertLocationPoint).toHaveBeenCalledTimes(1);
  });

  it('通常記録の保存が途中で失敗した場合は未確定分をバッファへ戻し、次の記録時に再試行する', async () => {
    mockToLocationPoint.mockReset();
    mockInsertLocationPoint.mockReset();
    // 1回目のrecordLocations: firstの保存で失敗 → [first, second] が未確定としてバッファへ戻る
    // 2回目のrecordLocations: バッファ分を回収して first, second の順に保存する
    mockToLocationPoint.mockReturnValueOnce(firstPoint).mockReturnValueOnce(firstPoint).mockReturnValueOnce(secondPoint);
    mockInsertLocationPoint.mockRejectedValueOnce(new Error('database is locked')).mockResolvedValueOnce(11).mockResolvedValueOnce(12);
    const session = await createLocationRecordingSession();

    await expect(session.recordLocations([firstLocation, secondLocation])).rejects.toThrow('database is locked');

    await session.recordLocations([]);

    expect(mockInsertLocationPoint).toHaveBeenCalledTimes(3);
    expect(mockInsertLocationPoint).toHaveBeenNthCalledWith(2, firstPoint);
    expect(mockInsertLocationPoint).toHaveBeenNthCalledWith(3, secondPoint);
  });

  it('flushが失敗した場合は退避分をバッファへ戻し、次の記録時に受信順を保って回収する', async () => {
    const session = await createLocationRecordingSession();
    beginGpxImportPriority();
    await session.recordLocations([firstLocation]);

    // flush内のセッション生成を失敗させる(SQLITE_BUSY等を想定)
    mockGetLatestLocationPoint.mockRejectedValueOnce(new Error('database is locked'));
    await expect(flushLocationsBufferedDuringGpxImport()).rejects.toThrow('database is locked');

    // 位置情報は失われず、次の通常記録でバッファ分(first)→新着(second)の順に処理される
    await session.recordLocations([secondLocation]);

    expect(mockInsertLocationPoint).toHaveBeenCalledTimes(2);
    expect(mockInsertLocationPoint).toHaveBeenNthCalledWith(1, firstPoint);
    expect(mockInsertLocationPoint).toHaveBeenNthCalledWith(2, secondPoint);
  });
});
