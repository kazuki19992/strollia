import { db } from '../../db/database';
import type { GridBounds, GridCell } from './grid/gridCell';

/** SQLiteから取得するvisited cell行。 */
export type VisitedCellRow = GridCell & {
  /** 最初に訪問した日時。 */
  firstVisitedAt: string;
  /** 最後に訪問した日時。 */
  lastVisitedAt: string;
  /** 訪問回数。 */
  visitCount: number;
};

/** DB列名をアプリ内のcamelCaseプロパティへ揃えるSELECT句。 */
const visitedCellColumns = `
  cell_id as cellId,
  cell_size_meters as cellSizeMeters,
  x,
  y,
  first_visited_at as firstVisitedAt,
  last_visited_at as lastVisitedAt,
  visit_count as visitCount
`;

/**
 * visited cellをSQLiteへ保存する。
 *
 * @param cells - 保存対象セル。
 * @param visitedAt - 訪問日時。
 * @returns なし。
 */
export async function upsertVisitedCells(cells: GridCell[], visitedAt: string): Promise<void> {
  if (cells.length === 0) {
    return;
  }

  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    for (const cell of dedupeCells(cells)) {
      await db.runAsync(
        `INSERT INTO visited_cells (
          cell_id,
          cell_size_meters,
          x,
          y,
          first_visited_at,
          last_visited_at,
          visit_count,
          source,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 1, 'gps', ?, ?)
        ON CONFLICT(cell_id) DO UPDATE SET
          last_visited_at = CASE
            WHEN excluded.last_visited_at > visited_cells.last_visited_at THEN excluded.last_visited_at
            ELSE visited_cells.last_visited_at
          END,
          visit_count = visited_cells.visit_count + 1,
          updated_at = excluded.updated_at`,
        cell.cellId,
        cell.cellSizeMeters,
        cell.x,
        cell.y,
        visitedAt,
        visitedAt,
        now,
        now,
      );
    }
  });
}

/**
 * 表示範囲に含まれるvisited cellを取得する。
 *
 * @param bounds - 基本100mセル番号範囲。
 * @returns 範囲内のvisited cell。
 */
export async function getVisitedCellsInBounds(bounds: GridBounds): Promise<VisitedCellRow[]> {
  return db.getAllAsync<VisitedCellRow>(
    `SELECT ${visitedCellColumns}
     FROM visited_cells
     WHERE x BETWEEN ? AND ?
       AND y BETWEEN ? AND ?
     ORDER BY last_visited_at ASC`,
    bounds.minX,
    bounds.maxX,
    bounds.minY,
    bounds.maxY,
  );
}

/** すべてのvisited cellを削除する。 */
export async function deleteAllVisitedCells(): Promise<void> {
  await db.runAsync('DELETE FROM visited_cells');
}

function dedupeCells(cells: GridCell[]): GridCell[] {
  return [...new Map(cells.map((cell) => [cell.cellId, cell])).values()];
}
