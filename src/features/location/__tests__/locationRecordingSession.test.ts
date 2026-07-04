import type { LocationObject } from 'expo-location';

import type { LocationPoint, NewLocationPoint } from '../../../types/gps';

import { createLocationRecordingSession } from '../locationRecordingSession';

const mockInitializeDatabase = jest.fn();
const mockProcessAchievementsForSavedPoint = jest.fn();
const mockGetLatestLocationPoint = jest.fn();
const mockInsertLocationPoint = jest.fn();
const mockToLocationPoint = jest.fn();
const mockGetVisitedCellsForLocationPoint = jest.fn();
const mockShouldSaveLocationPoint = jest.fn();
const mockUpsertVisitedCells = jest.fn();

jest.mock('../../../db/database', () => ({
  initializeDatabase: (...args: unknown[]) => mockInitializeDatabase(...args),
}));

jest.mock('../../achievements/achievementService', () => ({
  processAchievementsForSavedPoint: (...args: unknown[]) => mockProcessAchievementsForSavedPoint(...args),
}));

jest.mock('../../logs/logRepository', () => ({
  getLatestLocationPoint: (...args: unknown[]) => mockGetLatestLocationPoint(...args),
  insertLocationPoint: (...args: unknown[]) => mockInsertLocationPoint(...args),
}));

jest.mock('../locationMapper', () => ({
  toLocationPoint: (...args: unknown[]) => mockToLocationPoint(...args),
}));

jest.mock('../grid/gridInterpolation', () => ({
  getVisitedCellsForLocationPoint: (...args: unknown[]) => mockGetVisitedCellsForLocationPoint(...args),
}));

jest.mock('../locationSaveFilter', () => ({
  shouldSaveLocationPoint: (...args: unknown[]) => mockShouldSaveLocationPoint(...args),
}));

jest.mock('../visitedCellRepository', () => ({
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
