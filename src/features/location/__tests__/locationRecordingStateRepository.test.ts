import type * as SQLite from 'expo-sqlite';

import { INITIAL_STAY_PLACE_SNAP_STATE } from '@/features/stayPlaces/stayPlaceSnapResolver';
import {
  getLocationRecordingStateInCurrentTransaction,
  upsertLocationRecordingStateInCurrentTransaction,
} from '@/features/location/locationRecordingStateRepository';

/** 状態リポジトリへ渡すSQLiteランナーのモック。 */
const mockRunner = {
  getFirstAsync: jest.fn(),
  runAsync: jest.fn(),
};

describe('位置情報記録状態リポジトリ locationRecordingStateRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('状態行がない場合は未吸着の初期状態を返す', async () => {
    mockRunner.getFirstAsync.mockResolvedValue(null);

    await expect(getLocationRecordingStateInCurrentTransaction(mockRunner as unknown as SQLite.SQLiteDatabase)).resolves.toEqual({
      ...INITIAL_STAY_PLACE_SNAP_STATE,
      lastObservedAt: null,
      lastVisitedGridPoint: null,
    });
  });

  it('状態行をcamelCaseの永続化状態へ変換して返す', async () => {
    mockRunner.getFirstAsync.mockResolvedValue({
      activeStayPlaceId: 7,
      candidateStayPlaceId: 8,
      candidateCount: 2,
      outsideCount: 1,
      lastObservedAt: '2026-08-23T00:00:10.000Z',
      lastVisitedGridRecordedAt: '2026-08-23T00:00:09.000Z',
      lastVisitedGridLatitude: 35,
      lastVisitedGridLongitude: 139,
    });

    await expect(getLocationRecordingStateInCurrentTransaction(mockRunner as unknown as SQLite.SQLiteDatabase)).resolves.toEqual({
      activeStayPlaceId: 7,
      candidateStayPlaceId: 8,
      candidateCount: 2,
      outsideCount: 1,
      lastObservedAt: '2026-08-23T00:00:10.000Z',
      lastVisitedGridPoint: {
        recordedAt: '2026-08-23T00:00:09.000Z',
        latitude: 35,
        longitude: 139,
      },
    });
    expect(mockRunner.getFirstAsync).toHaveBeenCalledWith(expect.stringContaining('active_stay_place_id AS activeStayPlaceId'));
    expect(mockRunner.getFirstAsync).toHaveBeenCalledWith(expect.stringContaining('WHERE id = 1'));
  });

  it.each([
    ['観測日時', null, 35, 139],
    ['緯度', '2026-08-23T00:00:09.000Z', null, 139],
    ['経度', '2026-08-23T00:00:09.000Z', 35, null],
  ])('補間起点の%sがNULLなら補間起点なしとして返す', async (_label, recordedAt, latitude, longitude) => {
    mockRunner.getFirstAsync.mockResolvedValue({
      activeStayPlaceId: null,
      candidateStayPlaceId: null,
      candidateCount: 0,
      outsideCount: 0,
      lastObservedAt: null,
      lastVisitedGridRecordedAt: recordedAt,
      lastVisitedGridLatitude: latitude,
      lastVisitedGridLongitude: longitude,
    });

    await expect(getLocationRecordingStateInCurrentTransaction(mockRunner as unknown as SQLite.SQLiteDatabase)).resolves.toEqual({
      ...INITIAL_STAY_PLACE_SNAP_STATE,
      lastObservedAt: null,
      lastVisitedGridPoint: null,
    });
  });

  it.each([
    ['有限でない緯度', Number.NaN, 139],
    ['有限でない経度', 35, Number.POSITIVE_INFINITY],
    ['範囲外の緯度', 91, 139],
    ['範囲外の経度', 35, -181],
  ])('補間起点の%sは補間起点なしとして返す', async (_label, latitude, longitude) => {
    mockRunner.getFirstAsync.mockResolvedValue({
      activeStayPlaceId: null,
      candidateStayPlaceId: null,
      candidateCount: 0,
      outsideCount: 0,
      lastObservedAt: null,
      lastVisitedGridRecordedAt: '2026-08-23T00:00:09.000Z',
      lastVisitedGridLatitude: latitude,
      lastVisitedGridLongitude: longitude,
    });

    await expect(getLocationRecordingStateInCurrentTransaction(mockRunner as unknown as SQLite.SQLiteDatabase)).resolves.toEqual({
      ...INITIAL_STAY_PLACE_SNAP_STATE,
      lastObservedAt: null,
      lastVisitedGridPoint: null,
    });
  });

  it('単一行へ吸着状態と最終観測日時を保存する', async () => {
    const state = {
      activeStayPlaceId: 7,
      candidateStayPlaceId: null,
      candidateCount: 0,
      outsideCount: 1,
      lastObservedAt: '2026-08-23T00:00:10.000Z',
      lastVisitedGridPoint: {
        recordedAt: '2026-08-23T00:00:09.000Z',
        latitude: 35,
        longitude: 139,
      },
    };

    await upsertLocationRecordingStateInCurrentTransaction(
      state,
      '2026-08-23T00:00:11.000Z',
      mockRunner as unknown as SQLite.SQLiteDatabase,
    );

    expect(mockRunner.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT(id) DO UPDATE SET'),
      1,
      7,
      null,
      0,
      1,
      '2026-08-23T00:00:10.000Z',
      '2026-08-23T00:00:09.000Z',
      35,
      139,
      '2026-08-23T00:00:11.000Z',
    );
  });

  it('補間起点なしの場合は3列すべてへNULLを保存する', async () => {
    await upsertLocationRecordingStateInCurrentTransaction(
      {
        ...INITIAL_STAY_PLACE_SNAP_STATE,
        lastObservedAt: null,
        lastVisitedGridPoint: null,
      },
      '2026-08-23T00:00:11.000Z',
      mockRunner as unknown as SQLite.SQLiteDatabase,
    );

    expect(mockRunner.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('last_visited_grid_recorded_at'),
      1,
      null,
      null,
      0,
      0,
      null,
      null,
      null,
      null,
      '2026-08-23T00:00:11.000Z',
    );
  });
});
