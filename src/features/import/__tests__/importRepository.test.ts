import { db } from '@/db/database';
import { importLocationPointsFromGpx } from '@/features/import/importRepository';

/** モック用のプリペアドステートメント。 */
type MockPreparedStatement = {
  sql: string;
  executeAsync: jest.Mock;
  finalizeAsync: jest.Mock;
};

jest.mock('@/db/database', () => {
  /** prepareAsync で作られたステートメントの記録(テストから参照する)。 */
  const preparedStatements: MockPreparedStatement[] = [];
  /** location_points 挿入の結果キュー(先頭から消費。空なら挿入成功のデフォルト値)。 */
  const insertPointResults: { changes: number; lastInsertRowId: number }[] = [];

  const mockDb = {
    getFirstAsync: jest.fn(),
    runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 101, changes: 1 }),
    prepareAsync: jest.fn(async (sql: string): Promise<MockPreparedStatement> => {
      const statement: MockPreparedStatement = {
        sql,
        executeAsync: jest.fn(async () => {
          if (sql.includes('location_points') && insertPointResults.length > 0) {
            return insertPointResults.shift();
          }
          return { lastInsertRowId: 101, changes: 1 };
        }),
        finalizeAsync: jest.fn().mockResolvedValue(undefined),
      };
      preparedStatements.push(statement);
      return statement;
    }),
    withExclusiveTransactionAsync: jest.fn(),
  };
  mockDb.withExclusiveTransactionAsync.mockImplementation(async (callback: (txn: typeof mockDb) => Promise<void>) => callback(mockDb));

  return {
    db: mockDb,
    withExclusiveTransaction: mockDb.withExclusiveTransactionAsync,
    __preparedStatements: preparedStatements,
    __insertPointResults: insertPointResults,
  };
});

jest.mock('@/features/location/visitedCellRepository', () => ({
  upsertVisitedCells: jest.fn(),
  upsertVisitedCellsInCurrentTransaction: jest.fn(),
}));

jest.mock('@/features/location/grid/gridInterpolation', () => ({
  getVisitedCellsForLocationPoint: jest.fn(() => [{ cellId: '100:1:1', cellSizeMeters: 100, x: 1, y: 1 }]),
}));

/** モックモジュールからテスト用の内部状態を取り出す。 */
const mockDbModule = jest.requireMock('@/db/database') as {
  __preparedStatements: MockPreparedStatement[];
  __insertPointResults: { changes: number; lastInsertRowId: number }[];
};

/** SQLに部分文字列を含むプリペアドステートメントを取得する。 */
function findStatement(sqlFragment: string): MockPreparedStatement | undefined {
  return mockDbModule.__preparedStatements.find((statement) => statement.sql.includes(sqlFragment));
}

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
    mockDbModule.__preparedStatements.length = 0;
    mockDbModule.__insertPointResults.length = 0;
  });

  it('既存データと同じ時刻・座標の点は既存データを優先してスキップする', async () => {
    mockDbModule.__insertPointResults.push({ lastInsertRowId: 0, changes: 0 });

    const result = await importLocationPointsFromGpx([point], 'walk.gpx');

    expect(result).toEqual({ importedPointCount: 0, skippedPointCount: 1 });
    // スキップされた点では日別ログを更新しない
    expect(findStatement('INSERT INTO daily_logs')?.executeAsync).not.toHaveBeenCalled();
  });

  it('重複しない点はgpx-importソースで保存し日別ログを更新する', async () => {
    const result = await importLocationPointsFromGpx([point], 'walk.gpx');

    expect(result.importedPointCount).toBe(1);

    const insertPointStatement = findStatement("'gpx-import'");
    expect(insertPointStatement).toBeDefined();
    expect(insertPointStatement!.executeAsync).toHaveBeenCalledWith(
      point.recordedAt,
      point.localDate,
      point.latitude,
      point.longitude,
      point.altitude,
      point.speed,
      point.heading,
      point.accuracy,
      point.altitudeAccuracy,
      expect.any(String),
    );

    expect(findStatement('INSERT INTO daily_logs')!.executeAsync).toHaveBeenCalledWith(
      point.localDate,
      point.recordedAt,
      point.recordedAt,
      0,
      expect.any(String),
      expect.any(String),
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

  it('プリペアドステートメントはチャンク終了時に必ずfinalizeする', async () => {
    await importLocationPointsFromGpx([point], 'walk.gpx');

    for (const statement of mockDbModule.__preparedStatements) {
      expect(statement.finalizeAsync).toHaveBeenCalledTimes(1);
    }
  });
});
