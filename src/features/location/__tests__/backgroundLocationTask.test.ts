import type { LocationObject } from 'expo-location';

type TaskBody = {
  data?: { locations?: LocationObject[] };
  error: Error | null;
};

const mockRecordLocations = jest.fn();
const mockCreateLocationRecordingSession = jest.fn();
// isolateModules で読み込むタスクとモジュールインスタンスを共有するため、gpxImportPriority はモックで差し替える
const mockIsGpxImportPriorityActive = jest.fn(() => false);
const mockBufferLocationsDuringGpxImport = jest.fn();
const mockGetPremiumAccessState = jest.fn();
const mockGetStayPlaces = jest.fn();
const mockResolveActiveStayPlaces = jest.fn();
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

jest.mock('@/features/location/gpxImportPriority', () => ({
  isGpxImportPriorityActive: () => mockIsGpxImportPriorityActive(),
  bufferLocationsDuringGpxImport: (...args: unknown[]) => mockBufferLocationsDuringGpxImport(...args),
}));

jest.mock('@/features/premium/revenueCatAccess', () => ({
  getPremiumAccessState: (...args: unknown[]) => mockGetPremiumAccessState(...args),
}));

jest.mock('@/features/stayPlaces/stayPlaceRepository', () => ({
  getStayPlaces: (...args: unknown[]) => mockGetStayPlaces(...args),
}));

jest.mock('@/features/stayPlaces/stayPlaceAccess', () => ({
  resolveActiveStayPlaces: (...args: unknown[]) => mockResolveActiveStayPlaces(...args),
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
    mockGetPremiumAccessState.mockResolvedValue({ isPlusActive: false });
    mockGetStayPlaces.mockResolvedValue([]);
    mockResolveActiveStayPlaces.mockReturnValue([]);
  });

  it('受信した位置情報配列を共通保存セッションへ渡す', async () => {
    const location = { timestamp: 1, coords: {} } as LocationObject;

    await definedTask!({ data: { locations: [location] }, error: null });

    expect(mockCreateLocationRecordingSession).toHaveBeenCalledTimes(1);
    expect(mockRecordLocations).toHaveBeenCalledWith([location]);
  });

  it('別々のバックグラウンド配信も共通記録セッションへ順番に渡す', async () => {
    const locations = [
      { timestamp: 10, coords: {} } as LocationObject,
      { timestamp: 20, coords: {} } as LocationObject,
      { timestamp: 30, coords: {} } as LocationObject,
    ];

    for (const item of locations) {
      await definedTask!({ data: { locations: [item] }, error: null });
    }

    expect(mockCreateLocationRecordingSession).toHaveBeenCalledTimes(3);
    expect(mockRecordLocations).toHaveBeenNthCalledWith(1, [locations[0]]);
    expect(mockRecordLocations).toHaveBeenNthCalledWith(2, [locations[1]]);
    expect(mockRecordLocations).toHaveBeenNthCalledWith(3, [locations[2]]);
  });

  it('現在のPlus状態で解決した有効滞在場所を保存セッションへ渡す', async () => {
    const home = { id: 1, name: '自宅' };
    const activePlaces = [home];
    mockGetPremiumAccessState.mockResolvedValue({ isPlusActive: false });
    mockGetStayPlaces.mockResolvedValue([home]);
    mockResolveActiveStayPlaces.mockReturnValue(activePlaces);

    await definedTask!({ data: { locations: [{ timestamp: 1, coords: {} } as LocationObject] }, error: null });

    const options = mockCreateLocationRecordingSession.mock.calls[0][0] as { getActiveStayPlaces: () => Promise<unknown[]> };
    await expect(options.getActiveStayPlaces()).resolves.toEqual(activePlaces);
    expect(mockGetPremiumAccessState).toHaveBeenCalledTimes(1);
    expect(mockResolveActiveStayPlaces).toHaveBeenCalledWith([home], false);
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

  it('GPXインポート中はセッションを作らず(DBへ触れず)位置情報をバッファへ退避する', async () => {
    const location = { timestamp: 1, coords: {} } as LocationObject;
    mockIsGpxImportPriorityActive.mockReturnValueOnce(true);

    await definedTask!({ data: { locations: [location] }, error: null });

    // セッション生成(initializeDatabase等のDBアクセス)自体を行わない
    expect(mockCreateLocationRecordingSession).not.toHaveBeenCalled();
    expect(mockBufferLocationsDuringGpxImport).toHaveBeenCalledWith([location]);
  });
});
