import { withExclusiveTransaction } from '@/db/database';
import {
  recordLocationObservation,
  RecordLocationObservationInput,
  RecordLocationObservationResult,
} from '@/features/location/locationObservationRecorder';
import { StayPlace } from '@/features/stayPlaces/stayPlaceTypes';
import { NewLocationPoint } from '@/types/gps';

const mockTxn = {
  getFirstAsync: jest.fn(),
  runAsync: jest.fn(),
};
const mockGetState = jest.fn();
const mockUpsertState = jest.fn();
const mockGetLatest = jest.fn();
const mockInsert = jest.fn();
const mockShouldSave = jest.fn();
const mockGetVisitedCells = jest.fn();
const mockUpsertVisitedCells = jest.fn();

jest.mock('@/db/database', () => ({
  withExclusiveTransaction: jest.fn(async (callback: (txn: typeof mockTxn) => Promise<void>) => callback(mockTxn)),
}));

jest.mock('@/features/location/locationRecordingStateRepository', () => ({
  getLocationRecordingStateInCurrentTransaction: (...args: unknown[]) => mockGetState(...args),
  upsertLocationRecordingStateInCurrentTransaction: (...args: unknown[]) => mockUpsertState(...args),
}));

jest.mock('@/features/logs/logRepository', () => ({
  getLatestLocationPointInCurrentTransaction: (...args: unknown[]) => mockGetLatest(...args),
  insertLocationPointInCurrentTransaction: (...args: unknown[]) => mockInsert(...args),
}));

jest.mock('@/features/location/locationSaveFilter', () => ({
  shouldSaveLocationPoint: (...args: unknown[]) => mockShouldSave(...args),
}));

jest.mock('@/features/location/grid/gridInterpolation', () => ({
  getVisitedCellsForLocationPoint: (...args: unknown[]) => mockGetVisitedCells(...args),
}));

jest.mock('@/features/location/visitedCellRepository', () => ({
  upsertVisitedCellsInCurrentTransaction: (...args: unknown[]) => mockUpsertVisitedCells(...args),
}));

const initialPersistedState = {
  activeStayPlaceId: null,
  candidateStayPlaceId: null,
  candidateCount: 0,
  outsideCount: 0,
  lastObservedAt: null,
};

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

const cell = { cellId: '100:1:1', cellSizeMeters: 100, x: 1, y: 1 };

/** 指定時刻の生GPS観測を作る。 */
function pointAt(latitude: number, longitude: number, recordedAt: string): NewLocationPoint {
  return {
    recordedAt,
    localDate: '2026-08-23',
    latitude,
    longitude,
    altitude: null,
    speed: 0,
    heading: null,
    accuracy: 5,
    altitudeAccuracy: null,
  };
}

/** 自宅中心の観測を作る。 */
function pointAtHome(recordedAt: string): NewLocationPoint {
  return pointAt(home.latitude, home.longitude, recordedAt);
}

/** 自宅から指定距離だけ北へ離れた合成観測を作る。 */
function pointAtDistanceFromHome(distanceMeters: number, recordedAt: string): NewLocationPoint {
  const latitudeOffset = (distanceMeters / 6_371_000) * (180 / Math.PI);
  return pointAt(home.latitude + latitudeOffset, home.longitude, recordedAt);
}

/** 自宅の吸着半径50mより十分外側の観測を作る。 */
function pointOutsideHome(recordedAt: string): NewLocationPoint {
  return pointAt(home.latitude + 0.001, home.longitude, recordedAt);
}

/** 通常の有効滞在場所取得結果を持つ記録入力を作る。 */
function input(rawPoint: NewLocationPoint): RecordLocationObservationInput {
  return {
    rawPoint,
    activeStayPlaces: { status: 'ready', stayPlaces: [home] },
    previousVisitedCellPoint: null,
    now: '2026-08-23T01:00:00.000Z',
  };
}

describe('原子的な位置観測記録 recordLocationObservation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetState.mockResolvedValue({ ...initialPersistedState });
    mockUpsertState.mockResolvedValue(undefined);
    mockGetLatest.mockResolvedValue(null);
    mockInsert.mockResolvedValue({ locationPointId: 1, previousPoint: null, nextPoint: null, distanceDeltaMeters: 0 });
    mockShouldSave.mockReturnValue(true);
    mockGetVisitedCells.mockReturnValue([]);
    mockUpsertVisitedCells.mockResolvedValue(undefined);
  });

  it('別々の呼び出しでも永続状態を引き継ぎ3点目から吸着する', async () => {
    let persistedState = { ...initialPersistedState };
    mockGetState.mockImplementation(async () => persistedState);
    mockUpsertState.mockImplementation(async (state) => {
      persistedState = state;
    });

    const first = await recordLocationObservation(input(pointAtHome('2026-08-23T00:00:10.000Z')));
    const second = await recordLocationObservation(input(pointAtHome('2026-08-23T00:00:20.000Z')));
    const third = await recordLocationObservation(input(pointAtHome('2026-08-23T00:00:30.000Z')));

    expect(first.status).toBe('saved');
    expect(second.status).toBe('saved');
    expect(third).toEqual(
      expect.objectContaining({
        status: 'saved',
        point: expect.objectContaining({
          effectiveLatitude: home.latitude,
          effectiveLongitude: home.longitude,
          snappedStayPlaceId: home.id,
        }),
      }),
    );
  });

  it('自宅付近の密集観測を別配信相当で処理しても中心と生座標を往復しない', async () => {
    let persistedState = { ...initialPersistedState };
    mockGetState.mockImplementation(async () => persistedState);
    mockUpsertState.mockImplementation(async (state) => {
      persistedState = state;
    });
    const observations = Array.from({ length: 12 }, (_, index) =>
      pointAtDistanceFromHome(index % 2 === 0 ? 12 : 18, `2026-08-23T00:${String(index).padStart(2, '0')}:00.000Z`),
    );

    const results: RecordLocationObservationResult[] = [];
    for (const rawPoint of observations) {
      results.push(await recordLocationObservation(input(rawPoint)));
    }

    const saved = results.filter(
      (result): result is Extract<RecordLocationObservationResult, { status: 'saved' }> => result.status === 'saved',
    );
    expect(saved).toHaveLength(12);
    expect(saved.slice(2).every((result) => result.point.snappedStayPlaceId === home.id)).toBe(true);
    expect(saved.slice(2).every((result) => result.point.effectiveLatitude === home.latitude)).toBe(true);
    expect(saved.slice(2).every((result) => result.point.effectiveLongitude === home.longitude)).toBe(true);
  });

  it('吸着中の範囲外観測も別々の呼び出しで数え3点目に退出する', async () => {
    let persistedState = {
      activeStayPlaceId: home.id,
      candidateStayPlaceId: null,
      candidateCount: 0,
      outsideCount: 0,
      lastObservedAt: '2026-08-23T00:00:00.000Z',
    };
    mockGetState.mockImplementation(async () => persistedState);
    mockUpsertState.mockImplementation(async (state) => {
      persistedState = state;
    });

    const first = await recordLocationObservation(input(pointOutsideHome('2026-08-23T00:00:10.000Z')));
    const second = await recordLocationObservation(input(pointOutsideHome('2026-08-23T00:00:20.000Z')));
    const third = await recordLocationObservation(input(pointOutsideHome('2026-08-23T00:00:30.000Z')));

    expect(first).toEqual(expect.objectContaining({ point: expect.objectContaining({ snappedStayPlaceId: home.id }) }));
    expect(second).toEqual(expect.objectContaining({ point: expect.objectContaining({ snappedStayPlaceId: home.id }) }));
    expect(third).toEqual(expect.objectContaining({ point: expect.objectContaining({ snappedStayPlaceId: null }) }));
    expect(persistedState.activeStayPlaceId).toBeNull();
  });

  it('吸着中は生座標をDBへ保持し保存判定とGridに有効座標を渡す', async () => {
    const rawPoint = pointAt(home.latitude + 0.0001, home.longitude + 0.0001, '2026-08-23T00:00:10.000Z');
    const latestSavedPoint = {
      id: 10,
      ...pointAt(34.9, 138.9, '2026-08-23T00:00:00.000Z'),
      effectiveLatitude: 35.1,
      effectiveLongitude: 139.1,
      snappedStayPlaceId: 2,
    };
    const previousVisitedCellPoint = {
      ...pointAt(35.2, 139.2, '2026-08-23T00:00:05.000Z'),
      effectiveLatitude: 35.2,
      effectiveLongitude: 139.2,
      snappedStayPlaceId: 3,
    };
    const effectiveCurrentPoint = {
      ...rawPoint,
      latitude: home.latitude,
      longitude: home.longitude,
      effectiveLatitude: home.latitude,
      effectiveLongitude: home.longitude,
      snappedStayPlaceId: home.id,
    };
    const effectivePreviousSavedPoint = {
      ...latestSavedPoint,
      latitude: latestSavedPoint.effectiveLatitude,
      longitude: latestSavedPoint.effectiveLongitude,
    };
    mockGetState.mockResolvedValue({
      activeStayPlaceId: home.id,
      candidateStayPlaceId: null,
      candidateCount: 0,
      outsideCount: 0,
      lastObservedAt: null,
    });
    mockGetLatest.mockResolvedValue(latestSavedPoint);

    await recordLocationObservation({ ...input(rawPoint), previousVisitedCellPoint });

    expect(mockShouldSave).toHaveBeenCalledWith(effectiveCurrentPoint, effectivePreviousSavedPoint);
    expect(mockGetVisitedCells).toHaveBeenCalledWith(previousVisitedCellPoint, effectiveCurrentPoint);
    expect(mockInsert).toHaveBeenCalledWith(
      {
        ...rawPoint,
        effectiveLatitude: home.latitude,
        effectiveLongitude: home.longitude,
        snappedStayPlaceId: home.id,
      },
      '2026-08-23T01:00:00.000Z',
      mockTxn,
    );
  });

  it('GPSログ保存対象外でも状態とVisited Gridを同じtransactionで更新する', async () => {
    const rawPoint = pointAtHome('2026-08-23T00:00:10.000Z');
    mockShouldSave.mockReturnValue(false);
    mockGetVisitedCells.mockReturnValue([cell]);

    await expect(recordLocationObservation(input(rawPoint))).resolves.toEqual(
      expect.objectContaining({ status: 'not-saved', visitedCellPoint: expect.any(Object) }),
    );

    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpsertVisitedCells).toHaveBeenCalledWith([cell], rawPoint.recordedAt, mockTxn);
    expect(mockUpsertState).toHaveBeenCalledWith(
      expect.objectContaining({ lastObservedAt: rawPoint.recordedAt }),
      '2026-08-23T01:00:00.000Z',
      mockTxn,
    );
  });

  it('最終処理日時以前の観測は状態・GPS・Gridへ反映しない', async () => {
    mockGetState.mockResolvedValue({
      ...initialPersistedState,
      candidateStayPlaceId: home.id,
      candidateCount: 2,
      lastObservedAt: '2026-08-23T00:00:30.000Z',
    });

    await expect(recordLocationObservation(input(pointAtHome('2026-08-23T00:00:20.000Z')))).resolves.toEqual({
      status: 'stale',
      visitedCellPoint: null,
    });
    expect(mockGetLatest).not.toHaveBeenCalled();
    expect(mockUpsertState).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpsertVisitedCells).not.toHaveBeenCalled();
  });

  it('滞在場所取得失敗時は生座標を使い吸着状態を維持する', async () => {
    const rawPoint = pointOutsideHome('2026-08-23T00:00:10.000Z');
    const activePersistedState = {
      activeStayPlaceId: home.id,
      candidateStayPlaceId: null,
      candidateCount: 0,
      outsideCount: 2,
      lastObservedAt: '2026-08-23T00:00:00.000Z',
    };
    mockGetState.mockResolvedValue(activePersistedState);

    const result = await recordLocationObservation({
      ...input(rawPoint),
      activeStayPlaces: { status: 'unavailable' },
    });

    expect(result).toEqual(
      expect.objectContaining({
        point: expect.objectContaining({
          effectiveLatitude: rawPoint.latitude,
          effectiveLongitude: rawPoint.longitude,
          snappedStayPlaceId: null,
        }),
      }),
    );
    expect(mockUpsertState).toHaveBeenCalledWith(
      { ...activePersistedState, lastObservedAt: rawPoint.recordedAt },
      '2026-08-23T01:00:00.000Z',
      mockTxn,
    );
  });

  it('保存済み吸着先が有効一覧から外れた場合は次の正常観測で解除する', async () => {
    const rawPoint = pointAtHome('2026-08-23T00:00:10.000Z');
    mockGetState.mockResolvedValue({
      activeStayPlaceId: home.id,
      candidateStayPlaceId: null,
      candidateCount: 0,
      outsideCount: 2,
      lastObservedAt: '2026-08-23T00:00:00.000Z',
    });

    const result = await recordLocationObservation({
      ...input(rawPoint),
      activeStayPlaces: { status: 'ready', stayPlaces: [] },
    });

    expect(result).toEqual(expect.objectContaining({ point: expect.objectContaining({ snappedStayPlaceId: null }) }));
    expect(mockUpsertState).toHaveBeenCalledWith(
      expect.objectContaining({ activeStayPlaceId: null, candidateCount: 0, outsideCount: 0 }),
      '2026-08-23T01:00:00.000Z',
      mockTxn,
    );
  });

  it('重複GPS点は吸着状態とVisited Gridを更新しない', async () => {
    const rawPoint = pointAtHome('2026-08-23T00:00:10.000Z');
    mockGetVisitedCells.mockReturnValue([cell]);
    mockInsert.mockResolvedValue(null);

    await expect(recordLocationObservation(input(rawPoint))).resolves.toEqual({ status: 'duplicate', visitedCellPoint: null });

    expect(mockInsert).toHaveBeenCalledWith(expect.any(Object), '2026-08-23T01:00:00.000Z', mockTxn);
    expect(mockUpsertVisitedCells).not.toHaveBeenCalled();
    expect(mockUpsertState).not.toHaveBeenCalled();
  });

  it('GPS点・日別集計後にGrid更新が失敗した場合はtransactionのエラーを伝播する', async () => {
    const rawPoint = pointAtHome('2026-08-23T00:00:10.000Z');
    mockGetVisitedCells.mockReturnValue([cell]);
    mockUpsertVisitedCells.mockRejectedValue(new Error('grid write failed'));

    await expect(recordLocationObservation(input(rawPoint))).rejects.toThrow('grid write failed');

    expect(withExclusiveTransaction).toHaveBeenCalledTimes(1);
    expect(mockGetState).toHaveBeenCalledWith(mockTxn);
    expect(mockGetLatest).toHaveBeenCalledWith(mockTxn);
    expect(mockInsert).toHaveBeenCalledWith(expect.any(Object), '2026-08-23T01:00:00.000Z', mockTxn);
    expect(mockUpsertVisitedCells).toHaveBeenCalledWith([cell], rawPoint.recordedAt, mockTxn);
    expect(mockUpsertState).not.toHaveBeenCalled();
  });
});
