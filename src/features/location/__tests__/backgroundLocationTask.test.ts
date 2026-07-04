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

jest.mock('@/features/location/locationRecordingSession', () => ({
  createLocationRecordingSession: (...args: unknown[]) => mockCreateLocationRecordingSession(...args),
}));

describe('バックグラウンド位置情報タスク', () => {
  beforeAll(() => {
    jest.isolateModules(() => {
      require('../backgroundLocationTask');
    });
    expect(definedTask).toEqual(expect.any(Function));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRecordLocations.mockResolvedValue(undefined);
    mockCreateLocationRecordingSession.mockResolvedValue({ recordLocations: mockRecordLocations });
  });

  it('受信した位置情報配列を共通保存セッションへ渡す', async () => {
    const location = { timestamp: 1, coords: {} } as LocationObject;

    await definedTask!({ data: { locations: [location] }, error: null });

    expect(mockCreateLocationRecordingSession).toHaveBeenCalledTimes(1);
    expect(mockRecordLocations).toHaveBeenCalledWith([location]);
  });

  it('位置情報が空の場合は保存セッションを作らない', async () => {
    await definedTask!({ data: { locations: [] }, error: null });
    await definedTask!({ error: null });

    expect(mockCreateLocationRecordingSession).not.toHaveBeenCalled();
  });

  it('タスクエラーがある場合は警告し、保存セッションを作らない', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await definedTask!({ data: { locations: [{ timestamp: 1, coords: {} } as LocationObject] }, error: new Error('failed') });

    expect(mockCreateLocationRecordingSession).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('Background location task failed:', 'failed');
    warn.mockRestore();
  });
});
