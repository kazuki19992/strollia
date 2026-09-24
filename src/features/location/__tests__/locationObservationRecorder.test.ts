import { withExclusiveTransaction } from '@/db/database';
import type { LandmarkSpot } from '@/features/landmarks/landmarkCatalog';
import type { LandmarkDetectionSnapshot } from '@/features/landmarks/landmarkRecordingService';
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
const mockHasRawIdentity = jest.fn();
const mockInsert = jest.fn();
const mockShouldSave = jest.fn();
const mockGetVisitedCells = jest.fn();
const mockUpsertVisitedCells = jest.fn();
const mockInsertLandmarkVisit = jest.fn();

jest.mock('@/db/database', () => ({
  withExclusiveTransaction: jest.fn(async (callback: (txn: typeof mockTxn) => Promise<void>) => callback(mockTxn)),
}));

jest.mock('@/features/location/locationRecordingStateRepository', () => ({
  getLocationRecordingStateInCurrentTransaction: (...args: unknown[]) => mockGetState(...args),
  upsertLocationRecordingStateInCurrentTransaction: (...args: unknown[]) => mockUpsertState(...args),
}));

jest.mock('@/features/logs/logRepository', () => ({
  getLatestLocationPointInCurrentTransaction: (...args: unknown[]) => mockGetLatest(...args),
  hasLocationPointRawIdentityInCurrentTransaction: (...args: unknown[]) => mockHasRawIdentity(...args),
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

jest.mock('@/features/landmarks/landmarkVisitRepository', () => ({
  insertLandmarkSpotVisitInCurrentTransaction: (...args: unknown[]) => mockInsertLandmarkVisit(...args),
}));

const initialPersistedState = {
  activeStayPlaceId: null,
  candidateStayPlaceId: null,
  candidateCount: 0,
  outsideCount: 0,
  lastObservedAt: null,
  lastVisitedGridPoint: null,
  landmarkCandidateSpotId: null,
  landmarkCandidateEnteredAt: null,
  landmarkOutsideCount: 0,
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

/** 自宅と同じ座標に置いたテスト用スポット。半径200m・滞在180秒。 */
const spot: LandmarkSpot = {
  id: '01a0c450-6c00-7000-8000-000000000101',
  name: 'テスト用スポット',
  prefecture: 'TOKYO',
  latitude: 35,
  longitude: 139,
  radiusMeters: 200,
  dwellSeconds: 180,
  packs: [{ packId: '01a0c450-6c00-7000-8000-000000000001', order: 1 }],
};

/**
 * 自宅の吸着半径(50m)内にありながら、自宅中心からは外れる小さなスポット。
 *
 * 到達判定が生座標と吸着座標のどちらを見ているかを区別するために使う。
 */
const snapRadiusSpot: LandmarkSpot = {
  ...spot,
  id: '01a0c450-6c00-7000-8000-000000000102',
  name: '吸着半径内のスポット',
  latitude: 35 + 40 / 6_371_000 / (Math.PI / 180),
  radiusMeters: 20,
  dwellSeconds: 0,
};

/** Plus有効時の検知スナップショットを作る。 */
function enabledLandmarkDetection(visitedSpotIds: string[] = []): LandmarkDetectionSnapshot {
  return { status: 'enabled', spots: [spot], visitedSpotIds: new Set(visitedSpotIds) };
}

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

/**
 * 通常の有効滞在場所取得結果を持つ記録入力を作る。
 *
 * スポット検知はPlus限定のため、既定はPlus無効相当の `disabled` とする。
 */
function input(rawPoint: NewLocationPoint): RecordLocationObservationInput {
  return {
    rawPoint,
    activeStayPlaces: { status: 'ready', stayPlaces: [home] },
    landmarkDetection: { status: 'disabled' },
    now: '2026-08-23T01:00:00.000Z',
  };
}

/** 保存が成立する既定のモック応答へ戻す。 */
function resetMocksToDefaults(): void {
  jest.clearAllMocks();
  mockGetState.mockResolvedValue({ ...initialPersistedState });
  mockUpsertState.mockResolvedValue(undefined);
  mockGetLatest.mockResolvedValue(null);
  mockHasRawIdentity.mockResolvedValue(false);
  mockInsert.mockResolvedValue({ locationPointId: 1, previousPoint: null, nextPoint: null, distanceDeltaMeters: 0 });
  mockShouldSave.mockReturnValue(true);
  mockGetVisitedCells.mockReturnValue([]);
  mockUpsertVisitedCells.mockResolvedValue(undefined);
  // 実装は新規に行を追加できたときtrueを返す。既定は初回到達として扱う
  mockInsertLandmarkVisit.mockResolvedValue(true);
}

describe('原子的な位置観測記録 recordLocationObservation', () => {
  beforeEach(() => {
    resetMocksToDefaults();
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
      ...initialPersistedState,
      activeStayPlaceId: home.id,
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
    const previousVisitedGridPoint = {
      recordedAt: '2026-08-23T00:00:05.000Z',
      latitude: 35.2,
      longitude: 139.2,
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
      lastVisitedGridPoint: previousVisitedGridPoint,
    });
    mockGetLatest.mockResolvedValue(latestSavedPoint);
    mockGetVisitedCells.mockReturnValue([cell]);

    await recordLocationObservation(input(rawPoint));

    expect(mockShouldSave).toHaveBeenCalledWith(effectiveCurrentPoint, effectivePreviousSavedPoint);
    expect(mockGetVisitedCells).toHaveBeenCalledWith(previousVisitedGridPoint, effectiveCurrentPoint);
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
    expect(mockUpsertState).toHaveBeenCalledWith(
      expect.objectContaining({
        lastVisitedGridPoint: {
          recordedAt: rawPoint.recordedAt,
          latitude: home.latitude,
          longitude: home.longitude,
        },
      }),
      '2026-08-23T01:00:00.000Z',
      mockTxn,
    );
  });

  it('GPSログ保存対象外でも状態とVisited Gridを同じtransactionで更新する', async () => {
    const rawPoint = pointAtHome('2026-08-23T00:00:10.000Z');
    mockShouldSave.mockReturnValue(false);
    mockGetVisitedCells.mockReturnValue([cell]);

    await expect(recordLocationObservation(input(rawPoint))).resolves.toEqual({ status: 'not-saved', arrivedLandmarkSpotId: null });

    expect(mockHasRawIdentity).toHaveBeenCalledWith(rawPoint, mockTxn);
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpsertVisitedCells).toHaveBeenCalledWith([cell], rawPoint.recordedAt, mockTxn);
    expect(mockUpsertState).toHaveBeenCalledWith(
      expect.objectContaining({
        lastObservedAt: rawPoint.recordedAt,
        lastVisitedGridPoint: {
          recordedAt: rawPoint.recordedAt,
          latitude: home.latitude,
          longitude: home.longitude,
        },
      }),
      '2026-08-23T01:00:00.000Z',
      mockTxn,
    );
  });

  it('GPSログ保存対象外でも既存の同一生観測なら状態とVisited Gridを更新しない', async () => {
    const rawPoint = pointAt(home.latitude + 0.0001, home.longitude + 0.0001, '2026-08-23T00:00:10.000Z');
    mockGetState.mockResolvedValue({ ...initialPersistedState, activeStayPlaceId: home.id });
    mockShouldSave.mockReturnValue(false);
    mockHasRawIdentity.mockResolvedValue(true);
    mockGetVisitedCells.mockReturnValue([cell]);

    await expect(recordLocationObservation(input(rawPoint))).resolves.toEqual({ status: 'duplicate' });

    expect(mockHasRawIdentity).toHaveBeenCalledWith(rawPoint, mockTxn);
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockGetVisitedCells).not.toHaveBeenCalled();
    expect(mockUpsertVisitedCells).not.toHaveBeenCalled();
    expect(mockUpsertState).not.toHaveBeenCalled();
  });

  it('別セッション相当の保存対象外観測でも永続補間起点を次の観測へ引き継ぐ', async () => {
    const first = pointOutsideHome('2026-08-23T00:00:10.000Z');
    const second = pointAt(home.latitude + 0.002, home.longitude, '2026-08-23T00:00:20.000Z');
    let persistedState = { ...initialPersistedState };
    mockGetState.mockImplementation(async () => persistedState);
    mockUpsertState.mockImplementation(async (state) => {
      persistedState = state;
    });
    mockShouldSave.mockReturnValue(false);
    mockGetVisitedCells.mockReturnValue([cell]);

    await recordLocationObservation(input(first));
    await recordLocationObservation(input(second));

    expect(mockGetVisitedCells).toHaveBeenNthCalledWith(1, null, expect.objectContaining({ recordedAt: first.recordedAt }));
    expect(mockGetVisitedCells).toHaveBeenNthCalledWith(
      2,
      { recordedAt: first.recordedAt, latitude: first.latitude, longitude: first.longitude },
      expect.objectContaining({ recordedAt: second.recordedAt }),
    );
  });

  it('セルを生成できない観測では以前の永続補間起点を保持する', async () => {
    const previousVisitedGridPoint = {
      recordedAt: '2026-08-23T00:00:00.000Z',
      latitude: 35.1,
      longitude: 139.1,
    };
    const rawPoint = pointOutsideHome('2026-08-23T00:00:10.000Z');
    mockGetState.mockResolvedValue({ ...initialPersistedState, lastVisitedGridPoint: previousVisitedGridPoint });
    mockShouldSave.mockReturnValue(false);
    mockGetVisitedCells.mockReturnValue([]);

    await recordLocationObservation(input(rawPoint));

    expect(mockUpsertState).toHaveBeenCalledWith(
      expect.objectContaining({ lastVisitedGridPoint: previousVisitedGridPoint }),
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
    });
    expect(mockGetLatest).not.toHaveBeenCalled();
    expect(mockUpsertState).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpsertVisitedCells).not.toHaveBeenCalled();
  });

  it('端末時計巻き戻りで最終観測日時が1時間超未来でも現在の観測へ復旧する', async () => {
    const rawPoint = pointAtHome('2026-08-23T12:00:00.000Z');
    mockGetState.mockResolvedValue({
      ...initialPersistedState,
      candidateStayPlaceId: home.id,
      candidateCount: 2,
      lastObservedAt: '2026-08-23T13:00:01.000Z',
    });
    mockGetVisitedCells.mockReturnValue([cell]);

    await expect(recordLocationObservation({ ...input(rawPoint), now: '2026-08-23T12:00:00.000Z' })).resolves.toEqual(
      expect.objectContaining({ status: 'saved' }),
    );

    expect(mockInsert).toHaveBeenCalledWith(expect.any(Object), '2026-08-23T12:00:00.000Z', mockTxn);
    expect(mockUpsertVisitedCells).toHaveBeenCalledWith([cell], rawPoint.recordedAt, mockTxn);
    expect(mockUpsertState).toHaveBeenCalledWith(
      expect.objectContaining({ lastObservedAt: rawPoint.recordedAt }),
      '2026-08-23T12:00:00.000Z',
      mockTxn,
    );
  });

  it('滞在場所取得失敗時は生座標を使い吸着状態を維持する', async () => {
    const rawPoint = pointOutsideHome('2026-08-23T00:00:10.000Z');
    const activePersistedState = {
      ...initialPersistedState,
      activeStayPlaceId: home.id,
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
      ...initialPersistedState,
      activeStayPlaceId: home.id,
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

    await expect(recordLocationObservation(input(rawPoint))).resolves.toEqual({ status: 'duplicate' });

    expect(mockHasRawIdentity).not.toHaveBeenCalled();
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

describe('スポット到達の記録', () => {
  /** 滞在時間の計測が進行中の永続状態。 */
  const dwellingPersistedState = {
    ...initialPersistedState,
    landmarkCandidateSpotId: spot.id,
    landmarkCandidateEnteredAt: '2026-08-23T00:00:00.000Z',
    landmarkOutsideCount: 1,
  };

  beforeEach(() => {
    resetMocksToDefaults();
  });

  it('Plus無効なら到達を記録せず滞在状態をリセットする', async () => {
    mockGetState.mockResolvedValue({ ...dwellingPersistedState });

    await recordLocationObservation({
      ...input(pointAtHome('2026-08-23T00:05:00.000Z')),
      landmarkDetection: { status: 'disabled' },
    });

    expect(mockInsertLandmarkVisit).not.toHaveBeenCalled();
    expect(mockUpsertState).toHaveBeenCalledWith(
      expect.objectContaining({
        landmarkCandidateSpotId: null,
        landmarkCandidateEnteredAt: null,
        landmarkOutsideCount: 0,
      }),
      '2026-08-23T01:00:00.000Z',
      mockTxn,
    );
  });

  it('取得失敗時は滞在状態を保持する', async () => {
    mockGetState.mockResolvedValue({ ...dwellingPersistedState });

    await recordLocationObservation({
      ...input(pointAtHome('2026-08-23T00:05:00.000Z')),
      landmarkDetection: { status: 'unavailable' },
    });

    expect(mockInsertLandmarkVisit).not.toHaveBeenCalled();
    expect(mockUpsertState).toHaveBeenCalledWith(
      expect.objectContaining({
        landmarkCandidateSpotId: spot.id,
        landmarkCandidateEnteredAt: '2026-08-23T00:00:00.000Z',
        landmarkOutsideCount: 1,
      }),
      '2026-08-23T01:00:00.000Z',
      mockTxn,
    );
  });

  it('半径内の最初の観測では到達せず入場時刻を記録する', async () => {
    const rawPoint = pointAtHome('2026-08-23T00:00:10.000Z');

    await recordLocationObservation({ ...input(rawPoint), landmarkDetection: enabledLandmarkDetection() });

    expect(mockInsertLandmarkVisit).not.toHaveBeenCalled();
    expect(mockUpsertState).toHaveBeenCalledWith(
      expect.objectContaining({
        landmarkCandidateSpotId: spot.id,
        landmarkCandidateEnteredAt: rawPoint.recordedAt,
        landmarkOutsideCount: 0,
      }),
      '2026-08-23T01:00:00.000Z',
      mockTxn,
    );
  });

  it('到達が確定するとlandmark_spot_visitsへINSERTする', async () => {
    let persistedState = { ...initialPersistedState };
    mockGetState.mockImplementation(async () => persistedState);
    mockUpsertState.mockImplementation(async (state) => {
      persistedState = state;
    });
    const detection = enabledLandmarkDetection();

    const beforeArrival = await recordLocationObservation({
      ...input(pointAtHome('2026-08-23T00:00:00.000Z')),
      landmarkDetection: detection,
    });
    const arrival = pointAtHome('2026-08-23T00:03:00.000Z');
    const arrivalResult = await recordLocationObservation({ ...input(arrival), landmarkDetection: detection });

    // 呼び出し側が到達通知と完走実績評価をこの戻り値だけで判断できるようにする
    expect(beforeArrival).toEqual(expect.objectContaining({ status: 'saved', arrivedLandmarkSpotId: null }));
    expect(arrivalResult).toEqual(expect.objectContaining({ status: 'saved', arrivedLandmarkSpotId: spot.id }));
    expect(mockInsertLandmarkVisit).toHaveBeenCalledTimes(1);
    expect(mockInsertLandmarkVisit).toHaveBeenCalledWith(
      {
        spotId: spot.id,
        visitedAt: arrival.recordedAt,
        visitedLocalDate: arrival.localDate,
        locationPointId: 1,
      },
      '2026-08-23T01:00:00.000Z',
      mockTxn,
    );
    expect(persistedState.landmarkCandidateSpotId).toBeNull();
  });

  it('保存されない観測でも到達を確定できる', async () => {
    // 立ち止まっている間はGPS保存フィルタが点を捨てるため、保存されない観測でも
    // 到達が確定しなければ「滝の前で眺める」ケースで永久に到達できない
    mockShouldSave.mockReturnValue(false);
    mockGetState.mockResolvedValue({
      ...initialPersistedState,
      landmarkCandidateSpotId: spot.id,
      landmarkCandidateEnteredAt: '2026-08-23T00:00:00.000Z',
    });
    const arrival = pointAtHome('2026-08-23T00:03:00.000Z');

    await expect(recordLocationObservation({ ...input(arrival), landmarkDetection: enabledLandmarkDetection() })).resolves.toEqual({
      status: 'not-saved',
      arrivedLandmarkSpotId: spot.id,
    });

    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockInsertLandmarkVisit).toHaveBeenCalledWith(
      {
        spotId: spot.id,
        visitedAt: arrival.recordedAt,
        visitedLocalDate: arrival.localDate,
        locationPointId: null,
      },
      '2026-08-23T01:00:00.000Z',
      mockTxn,
    );
  });

  it('到達済みスポットでは再びINSERTしない', async () => {
    mockGetState.mockResolvedValue({
      ...initialPersistedState,
      landmarkCandidateSpotId: spot.id,
      landmarkCandidateEnteredAt: '2026-08-23T00:00:00.000Z',
    });

    await recordLocationObservation({
      ...input(pointAtHome('2026-08-23T00:03:00.000Z')),
      landmarkDetection: enabledLandmarkDetection([spot.id]),
    });

    expect(mockInsertLandmarkVisit).not.toHaveBeenCalled();
  });

  it('同一バッチ内の再到達では到達を報告しない', async () => {
    // 検知対象の到達済みID集合は配信バッチ単位のスナップショットで直前の到達を含まない。
    // 到達確定後に判定状態が初期化されるため同じスポットが再び候補になるが、
    // 行が増えていない以上は通知も実績評価も走らせてはいけない。
    mockGetState.mockResolvedValue({
      ...initialPersistedState,
      landmarkCandidateSpotId: spot.id,
      landmarkCandidateEnteredAt: '2026-08-23T00:00:00.000Z',
    });
    mockInsertLandmarkVisit.mockResolvedValue(false);

    const result = await recordLocationObservation({
      ...input(pointAtHome('2026-08-23T00:03:00.000Z')),
      landmarkDetection: enabledLandmarkDetection(),
    });

    expect(mockInsertLandmarkVisit).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ arrivedLandmarkSpotId: null }));
  });

  it('吸着中でも生座標でスポットを判定する', async () => {
    // 吸着座標で判定すると、自宅中心(=スポットの半径外)へ寄せられた位置が混入し到達できない
    mockGetState.mockResolvedValue({ ...initialPersistedState, activeStayPlaceId: home.id });
    const rawPoint = pointAtDistanceFromHome(40, '2026-08-23T00:00:10.000Z');

    const result = await recordLocationObservation({
      ...input(rawPoint),
      landmarkDetection: { status: 'enabled', spots: [snapRadiusSpot], visitedSpotIds: new Set<string>() },
    });

    expect(result).toEqual(expect.objectContaining({ point: expect.objectContaining({ snappedStayPlaceId: home.id }) }));
    expect(mockInsertLandmarkVisit).toHaveBeenCalledWith(
      expect.objectContaining({ spotId: snapRadiusSpot.id }),
      '2026-08-23T01:00:00.000Z',
      mockTxn,
    );
  });
});
