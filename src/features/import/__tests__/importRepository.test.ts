import { db } from '../../../db/database';
import { importLocationPointsFromGpx } from '../importRepository';

jest.mock('../../../db/database', () => ({
  db: {
    getFirstAsync: jest.fn(),
    runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 101, changes: 1 }),
    withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => callback()),
  },
}));

jest.mock('../../location/visitedCellRepository', () => ({
  upsertVisitedCells: jest.fn(),
  upsertVisitedCellsInCurrentTransaction: jest.fn(),
}));

jest.mock('../../location/grid/gridInterpolation', () => ({
  getVisitedCellsForLocationPoint: jest.fn(() => [{ cellId: '100:1:1', cellSizeMeters: 100, x: 1, y: 1 }]),
}));

const point = {
  recordedAt: '2026-05-01T00:00:00.000Z',
  localDate: '2026-05-01',
  latitude: 35,
  longitude: 139,
  altitude: null,
  speed: null,
  heading: null,
  accuracy: null,
  altitudeAccuracy: null,
};

describe('GPXインポート保存 importRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('既存データと同じ時刻・座標の点は既存データを優先してスキップする', async () => {
    (db.runAsync as jest.Mock)
      .mockResolvedValueOnce({ lastInsertRowId: 0, changes: 0 })
      .mockResolvedValue({ lastInsertRowId: 101, changes: 1 });

    const result = await importLocationPointsFromGpx([point], 'walk.gpx');

    expect(result).toEqual({ importedPointCount: 0, skippedPointCount: 1 });
    expect(
      (db.runAsync as jest.Mock).mock.calls.some((args) => typeof args[0] === 'string' && args[0].includes('INSERT INTO daily_logs')),
    ).toBe(false);
  });

  it('重複しない点はgpx-importソースで保存し日別ログを更新する', async () => {
    const result = await importLocationPointsFromGpx([point], 'walk.gpx');

    expect(result.importedPointCount).toBe(1);
    const locationInsertCall = (db.runAsync as jest.Mock).mock.calls[0];
    expect(locationInsertCall[0]).toContain("'gpx-import'");
    expect(locationInsertCall.slice(1, 10)).toEqual([
      point.recordedAt,
      point.localDate,
      point.latitude,
      point.longitude,
      point.altitude,
      point.speed,
      point.heading,
      point.accuracy,
      point.altitudeAccuracy,
    ]);
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO daily_logs'),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO import_history'),
      'gpx',
      'walk.gpx',
      point.recordedAt,
      point.recordedAt,
      1,
      0,
      expect.any(String),
    );
  });
});
