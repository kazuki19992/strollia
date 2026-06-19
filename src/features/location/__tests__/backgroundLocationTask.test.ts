import type { LocationObject } from 'expo-location';

type TaskBody = {
  data?: { locations?: LocationObject[] };
  error: Error | null;
};

const mockRecordLocations = jest.fn();
const mockCreateLocationRecordingSession = jest.fn();
let definedTask: ((body: TaskBody) => Promise<void>) | null = null;

jest.mock('expo-task-manager', () => ({
  isTaskDefined: jest.fn(() => false),
  defineTask: jest.fn((_name: string, handler: (body: TaskBody) => Promise<void>) => {
    definedTask = handler;
  }),
}));

jest.mock('../locationRecordingSession', () => ({
  createLocationRecordingSession: (...args: unknown[]) => mockCreateLocationRecordingSession(...args),
}));

jest.mock('../../../db/database', () => ({ initializeDatabase: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../achievements/achievementService', () => ({ processAchievementsForSavedPoint: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../logs/logRepository', () => ({
  getLatestLocationPoint: jest.fn().mockResolvedValue(null),
  insertLocationPoint: jest.fn().mockResolvedValue(1),
}));
jest.mock('../locationMapper', () => ({ toLocationPoint: jest.fn(() => ({ recordedAt: '2026-06-19T00:00:00.000Z' })) }));
jest.mock('../grid/gridInterpolation', () => ({ getVisitedCellsForLocationPoint: jest.fn(() => []) }));
jest.mock('../locationSaveFilter', () => ({ shouldSaveLocationPoint: jest.fn(() => false) }));
jest.mock('../visitedCellRepository', () => ({ upsertVisitedCells: jest.fn().mockResolvedValue(undefined) }));

describe('バックグラウンド位置情報タスク', () => {
  beforeAll(() => {
    jest.isolateModules(() => {
      require('../backgroundLocationTask');
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRecordLocations.mockResolvedValue(undefined);
    mockCreateLocationRecordingSession.mockResolvedValue({ recordLocations: mockRecordLocations });
  });

  it('受信した位置情報配列を共通保存セッションへ渡す', async () => {
    const location = { timestamp: 1, coords: {} } as LocationObject;

    await definedTask?.({ data: { locations: [location] }, error: null });

    expect(mockCreateLocationRecordingSession).toHaveBeenCalledTimes(1);
    expect(mockRecordLocations).toHaveBeenCalledWith([location]);
  });

  it('位置情報が空の場合は保存セッションを作らない', async () => {
    await definedTask?.({ data: { locations: [] }, error: null });
    await definedTask?.({ error: null });

    expect(mockCreateLocationRecordingSession).not.toHaveBeenCalled();
  });

  it('タスクエラーがある場合は警告し、保存セッションを作らない', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await definedTask?.({ data: { locations: [{ timestamp: 1, coords: {} } as LocationObject] }, error: new Error('failed') });

    expect(mockCreateLocationRecordingSession).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('Background location task failed:', 'failed');
    warn.mockRestore();
  });
});
