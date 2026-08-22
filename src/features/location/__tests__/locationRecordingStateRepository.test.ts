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
    });
  });

  it('状態行をcamelCaseの永続化状態へ変換して返す', async () => {
    mockRunner.getFirstAsync.mockResolvedValue({
      activeStayPlaceId: 7,
      candidateStayPlaceId: 8,
      candidateCount: 2,
      outsideCount: 1,
      lastObservedAt: '2026-08-23T00:00:10.000Z',
    });

    await expect(getLocationRecordingStateInCurrentTransaction(mockRunner as unknown as SQLite.SQLiteDatabase)).resolves.toEqual({
      activeStayPlaceId: 7,
      candidateStayPlaceId: 8,
      candidateCount: 2,
      outsideCount: 1,
      lastObservedAt: '2026-08-23T00:00:10.000Z',
    });
    expect(mockRunner.getFirstAsync).toHaveBeenCalledWith(expect.stringContaining('active_stay_place_id AS activeStayPlaceId'));
    expect(mockRunner.getFirstAsync).toHaveBeenCalledWith(expect.stringContaining('WHERE id = 1'));
  });

  it('単一行へ吸着状態と最終観測日時を保存する', async () => {
    const state = {
      activeStayPlaceId: 7,
      candidateStayPlaceId: null,
      candidateCount: 0,
      outsideCount: 1,
      lastObservedAt: '2026-08-23T00:00:10.000Z',
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
      '2026-08-23T00:00:11.000Z',
    );
  });
});
