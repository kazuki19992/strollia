import { db, withExclusiveTransaction } from '@/db/database';
import { coordinateToGridCell } from '@/features/location/grid/gridCell';
import {
  deleteAllVisitedCells,
  getVisitedCellsByIds,
  getVisitedCellsInBounds,
  upsertVisitedCellVisitsInCurrentTransaction,
  upsertVisitedCells,
} from '@/features/location/visitedCellRepository';
import { GRID_OVERLAY_CONFIG } from '@/features/map/config/gridOverlayConfig';

const mockTxn = {
  runAsync: jest.fn().mockResolvedValue({}),
};

jest.mock('@/db/database', () => ({
  db: {
    getAllAsync: jest.fn(),
    runAsync: jest.fn().mockResolvedValue({}),
  },
  withExclusiveTransaction: jest.fn(async (callback: (txn: typeof mockTxn) => Promise<void>) => callback(mockTxn)),
}));

describe('Visited Grid保存 visitedCellRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('visited cellをupsertして再訪問時にvisitCountとlastVisitedAtを更新する', async () => {
    const cell = coordinateToGridCell({ latitude: 35.681236, longitude: 139.767125 });
    (db.getAllAsync as jest.Mock).mockResolvedValue([
      {
        cellId: cell.cellId,
        cellSizeMeters: cell.cellSizeMeters,
        x: cell.x,
        y: cell.y,
        firstVisitedAt: '2026-05-23T00:00:00.000Z',
        lastVisitedAt: '2026-05-23T00:05:00.000Z',
        visitCount: 2,
      },
    ]);

    await upsertVisitedCells([cell], '2026-05-23T00:00:00.000Z');
    await upsertVisitedCells([cell], '2026-05-23T00:05:00.000Z');

    const cells = await getVisitedCellsInBounds(
      {
        minX: cell.x - 1,
        maxX: cell.x + 1,
        minY: cell.y - 1,
        maxY: cell.y + 1,
      },
      GRID_OVERLAY_CONFIG.baseCellSizeMeters,
    );

    expect(cells).toHaveLength(1);
    expect(mockTxn.runAsync).toHaveBeenCalledTimes(2);
    expect(mockTxn.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('WHEN excluded.last_visited_at > visited_cells.last_visited_at'),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
    expect(cells[0].firstVisitedAt).toBe('2026-05-23T00:00:00.000Z');
    expect(cells[0].lastVisitedAt).toBe('2026-05-23T00:05:00.000Z');
    expect(cells[0].visitCount).toBe(2);
  });

  it('範囲内のvisited cellをx/yで取得する', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValue([]);

    await getVisitedCellsInBounds({ minX: 1, maxX: 3, minY: 5, maxY: 8 }, GRID_OVERLAY_CONFIG.baseCellSizeMeters);

    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('WHERE x BETWEEN ? AND ?'), 1, 3, 5, 8);
  });

  it('範囲内のvisited cellは再訪問時刻に影響されない安定順で取得する', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValue([]);

    await getVisitedCellsInBounds({ minX: 1, maxX: 3, minY: 5, maxY: 8 }, GRID_OVERLAY_CONFIG.baseCellSizeMeters);

    expect(db.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY cell_size_meters ASC, y ASC, x ASC, cell_id ASC'),
      1,
      3,
      5,
      8,
    );
  });

  it('表示セルサイズが基本セルサイズ(100m)のときはGROUP BYを含まない従来クエリを使う', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValue([]);

    await getVisitedCellsInBounds({ minX: 1, maxX: 3, minY: 5, maxY: 8 }, GRID_OVERLAY_CONFIG.baseCellSizeMeters);

    const [query] = (db.getAllAsync as jest.Mock).mock.calls[0];
    expect(query).not.toContain('GROUP BY');
  });

  it('表示セルサイズが基本セルサイズより大きい場合はSQL側でブロック集約しcellIdへ変換する', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValue([
      {
        blockX: -3,
        blockY: 4,
        firstVisitedAt: '2026-05-23T00:00:00.000Z',
        lastVisitedAt: '2026-05-23T00:10:00.000Z',
        visitCount: 3,
      },
    ]);

    const displayCellSizeMeters = GRID_OVERLAY_CONFIG.baseCellSizeMeters * 2;
    const cells = await getVisitedCellsInBounds({ minX: -6, maxX: -5, minY: 8, maxY: 9 }, displayCellSizeMeters);

    const [query] = (db.getAllAsync as jest.Mock).mock.calls[0];
    expect(query).toContain('GROUP BY blockX, blockY');
    expect(query).toContain('MIN(first_visited_at)');
    expect(query).toContain('MAX(last_visited_at)');
    expect(query).toContain('SUM(visit_count)');
    expect(cells).toEqual([
      {
        cellId: '200:-3:4',
        cellSizeMeters: 200,
        x: -3,
        y: 4,
        firstVisitedAt: '2026-05-23T00:00:00.000Z',
        lastVisitedAt: '2026-05-23T00:10:00.000Z',
        visitCount: 3,
      },
    ]);
  });

  it('負のセル番号を真のfloor除算式で扱い、ratio8個+bounds4個の全12パラメータを順序通り渡す', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValue([]);

    const displayCellSizeMeters = GRID_OVERLAY_CONFIG.baseCellSizeMeters * 2;
    const ratio = displayCellSizeMeters / GRID_OVERLAY_CONFIG.baseCellSizeMeters;
    await getVisitedCellsInBounds({ minX: -6, maxX: -5, minY: 8, maxY: 9 }, displayCellSizeMeters);

    const [query, ...params] = (db.getAllAsync as jest.Mock).mock.calls[0];
    // SQLiteの%は0方向への切り捨てのため、((x % ?) + ?) % ? の形で真のfloor除算に補正する。
    expect(query).toContain('((x % ?) + ?) % ?');
    expect(query).toContain('((y % ?) + ?) % ?');
    // params.slice(-4)だけの検証だとratioのプレースホルダを1つ減らしても
    // (11要素配列の末尾4つがなお bounds になるため)合格してしまう。
    // 手書きSQLのバインドずれは全行が誤ブロックへ集約される致命的な壊れ方をするため、
    // 配列全体(ratio 8個 + bounds 4個)を固定して検出力を上げる。
    expect(params).toEqual([ratio, ratio, ratio, ratio, ratio, ratio, ratio, ratio, -6, -5, 8, 9]);
  });

  it('ブロック集約クエリはブロック番号順(ORDER BY blockY ASC, blockX ASC)で結果を返す', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValue([]);

    const displayCellSizeMeters = GRID_OVERLAY_CONFIG.baseCellSizeMeters * 2;
    await getVisitedCellsInBounds({ minX: -6, maxX: -5, minY: 8, maxY: 9 }, displayCellSizeMeters);

    const [query] = (db.getAllAsync as jest.Mock).mock.calls[0];
    // ORDER BYなしではGROUP BYの出力順が仕様上不定になり、200m以上表示（結合スキップ）で
    // Polygon順序が変わりネイティブviewの再挿入が起きうる。
    expect(query).toContain('ORDER BY blockY ASC, blockX ASC');
  });

  it('表示セルサイズが基本セルサイズの整数倍でない場合はrejectする', async () => {
    await expect(
      getVisitedCellsInBounds({ minX: 0, maxX: 1, minY: 0, maxY: 1 }, GRID_OVERLAY_CONFIG.baseCellSizeMeters + 50),
    ).rejects.toThrow('displayCellSizeMeters must be a multiple');

    expect(db.getAllAsync).not.toHaveBeenCalled();
  });

  it('upsertVisitedCellsは空配列入力時にDBへ書き込まない', async () => {
    await upsertVisitedCells([], '2026-05-23T00:00:00.000Z');

    expect(withExclusiveTransaction).not.toHaveBeenCalled();
    expect(db.runAsync).not.toHaveBeenCalled();
    expect(mockTxn.runAsync).not.toHaveBeenCalled();
  });

  it('同一セルへの複数訪問を1回のupsertへ集約し、訪問回数と時刻範囲を保持する', async () => {
    const cell = coordinateToGridCell({ latitude: 35.681236, longitude: 139.767125 });

    await upsertVisitedCellVisitsInCurrentTransaction(
      [
        { cell, visitedAt: '2026-05-23T00:00:00.000Z' },
        { cell, visitedAt: '2026-05-23T00:05:00.000Z' },
      ],
      mockTxn as never,
    );

    expect(mockTxn.runAsync).toHaveBeenCalledTimes(1);
    expect(mockTxn.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('visit_count = visited_cells.visit_count + excluded.visit_count'),
      cell.cellId,
      cell.cellSizeMeters,
      cell.x,
      cell.y,
      '2026-05-23T00:00:00.000Z',
      '2026-05-23T00:05:00.000Z',
      2,
      expect.any(String),
      expect.any(String),
    );
  });

  it('既存セルより古い訪問を取り込むとfirstVisitedAtを古い時刻へ更新するSQLを使う', async () => {
    const cell = coordinateToGridCell({ latitude: 35.681236, longitude: 139.767125 });

    await upsertVisitedCellVisitsInCurrentTransaction([{ cell, visitedAt: '2026-05-22T23:55:00.000Z' }], mockTxn as never);

    expect(mockTxn.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('WHEN excluded.first_visited_at < visited_cells.first_visited_at THEN excluded.first_visited_at'),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      '2026-05-22T23:55:00.000Z',
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it('deleteAllVisitedCellsはvisited_cellsを全削除する', async () => {
    await deleteAllVisitedCells();

    expect(db.runAsync).toHaveBeenCalledWith('DELETE FROM visited_cells');
  });

  it('getVisitedCellsByIdsは指定したcellIdのvisited cellを取得する', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValue([]);

    await getVisitedCellsByIds(['100:1:2', '100:3:4']);

    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('WHERE cell_id IN (?, ?)'), '100:1:2', '100:3:4');
  });

  it('getVisitedCellsByIdsは重複したcellIdを除いて問い合わせる', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValue([]);

    await getVisitedCellsByIds(['100:1:2', '100:1:2', '100:3:4']);

    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('WHERE cell_id IN (?, ?)'), '100:1:2', '100:3:4');
  });

  it('getVisitedCellsByIdsは空配列ならDBへ問い合わせない', async () => {
    await expect(getVisitedCellsByIds([])).resolves.toEqual([]);

    expect(db.getAllAsync).not.toHaveBeenCalled();
  });
});
