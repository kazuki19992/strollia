import { db } from '../../../db/database';
import { coordinateToGridCell } from '../grid/gridCell';
import { deleteAllVisitedCells, getVisitedCellsByIds, getVisitedCellsInBounds, upsertVisitedCells } from '../visitedCellRepository';

jest.mock('../../../db/database', () => ({
  db: {
    getAllAsync: jest.fn(),
    runAsync: jest.fn().mockResolvedValue({}),
    withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => callback()),
  },
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

    const cells = await getVisitedCellsInBounds({
      minX: cell.x - 1,
      maxX: cell.x + 1,
      minY: cell.y - 1,
      maxY: cell.y + 1,
    });

    expect(cells).toHaveLength(1);
    expect(db.runAsync).toHaveBeenCalledTimes(2);
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('WHEN excluded.last_visited_at > visited_cells.last_visited_at'),
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

    await getVisitedCellsInBounds({ minX: 1, maxX: 3, minY: 5, maxY: 8 });

    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('WHERE x BETWEEN ? AND ?'), 1, 3, 5, 8);
  });

  it('範囲内のvisited cellは再訪問時刻に影響されない安定順で取得する', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValue([]);

    await getVisitedCellsInBounds({ minX: 1, maxX: 3, minY: 5, maxY: 8 });

    expect(db.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY cell_size_meters ASC, y ASC, x ASC, cell_id ASC'),
      1,
      3,
      5,
      8,
    );
  });

  it('upsertVisitedCellsは空配列入力時にDBへ書き込まない', async () => {
    await upsertVisitedCells([], '2026-05-23T00:00:00.000Z');

    expect(db.withTransactionAsync).not.toHaveBeenCalled();
    expect(db.runAsync).not.toHaveBeenCalled();
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

  it('getVisitedCellsByIdsは空配列ならDBへ問い合わせない', async () => {
    await expect(getVisitedCellsByIds([])).resolves.toEqual([]);

    expect(db.getAllAsync).not.toHaveBeenCalled();
  });
});
