import * as SQLite from 'expo-sqlite';

import { db, withExclusiveTransaction } from '@/db/database';
import { GRID_OVERLAY_CONFIG } from '@/features/map/config/gridOverlayConfig';
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
 * SQL側のブロック集約(GROUP BY)で返る行。
 *
 * `blockX` / `blockY` は基本100mセル番号を表示セルサイズ単位のブロック番号へ畳んだ値。
 * `x` / `y` という列名と同名のエイリアスにすると `GROUP BY` の対象列解決が曖昧になりうるため、
 * 意図的に `blockX` / `blockY` という別名にしている。
 */
type AggregatedVisitedCellRow = {
  /** ブロックX番号(表示セルサイズ単位)。 */
  blockX: number;
  /** ブロックY番号(表示セルサイズ単位)。 */
  blockY: number;
  /** ブロックに含まれる最古の訪問日時。 */
  firstVisitedAt: string;
  /** ブロックに含まれる最新の訪問日時。 */
  lastVisitedAt: string;
  /** ブロックに含まれる訪問回数の合計。 */
  visitCount: number;
};

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

  await withExclusiveTransaction(async (txn) => {
    await upsertVisitedCellsInCurrentTransaction(cells, visitedAt, txn);
  });
}

/**
 * 呼び出し元のtransaction内でvisited cellを保存する。
 *
 * `db.withExclusiveTransactionAsync` のネストを避けるため、複数テーブル更新をまとめる処理から使う。
 * `withExclusiveTransactionAsync` 内から呼ぶ場合は `runner` に `txn` を渡すこと。
 */
export async function upsertVisitedCellsInCurrentTransaction(
  cells: GridCell[],
  visitedAt: string,
  runner: SQLite.SQLiteDatabase = db,
): Promise<void> {
  if (cells.length === 0) {
    return;
  }

  const now = new Date().toISOString();

  for (const cell of dedupeCells(cells)) {
    await runner.runAsync(
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
}

/**
 * 表示範囲に含まれるvisited cellを取得する。
 *
 * `displayCellSizeMeters` が基本セルサイズ(100m)と同じ(ratio === 1)場合は、保存済み100mセル行を
 * そのまま返す従来クエリを使う。それより大きい場合は、SQL側で `GROUP BY` してブロック単位へ
 * 集約してから返す。JS側へ渡る行数を表示セルサイズに応じて削減し、広域表示時の転送・変換コストを抑える。
 *
 * @param bounds - 基本100mセル番号範囲。
 * @param displayCellSizeMeters - 呼び出し側の表示セルサイズ。必須引数(既定値を持たせると、
 *   呼び出し忘れで意図せず100m集約のまま動いてしまう経路が残るため)。基本セルサイズの倍数でなければ
 *   `Error` を投げる。
 * @returns 範囲内のvisited cell。集約時は `cellId` / `cellSizeMeters` / `x` / `y` を表示セルサイズへ変換して返す。
 */
export async function getVisitedCellsInBounds(bounds: GridBounds, displayCellSizeMeters: number): Promise<VisitedCellRow[]> {
  const baseCellSizeMeters = GRID_OVERLAY_CONFIG.baseCellSizeMeters;

  if (displayCellSizeMeters % baseCellSizeMeters !== 0) {
    throw new Error(`displayCellSizeMeters must be a multiple of base cell size (${baseCellSizeMeters}).`);
  }

  const ratio = displayCellSizeMeters / baseCellSizeMeters;

  if (ratio === 1) {
    return db.getAllAsync<VisitedCellRow>(
      `SELECT ${visitedCellColumns}
       FROM visited_cells
       WHERE x BETWEEN ? AND ?
         AND y BETWEEN ? AND ?
       ORDER BY cell_size_meters ASC, y ASC, x ASC, cell_id ASC`,
      bounds.minX,
      bounds.maxX,
      bounds.minY,
      bounds.maxY,
    );
  }

  // SQLiteの `/` と `%` は0方向への切り捨てのため、`x % ratio` は負のxで負の余りを返し、
  // 単純な `x / ratio` は `Math.floor(x / ratio)` とずれる(Web Mercatorのセル番号は西半球・南半球で
  // 負になるため無視できない)。`(x - ((x % ratio) + ratio) % ratio) / ratio` は
  // 余りを常に非負へ補正してから引くことで、真のfloor除算と同じ結果にする。
  // `floor()` 組み込み関数はSQLiteのビルドオプション(SQLITE_ENABLE_MATH_FUNCTIONS)依存のため使わない。
  const rows = await db.getAllAsync<AggregatedVisitedCellRow>(
    `SELECT
       (x - ((x % ?) + ?) % ?) / ? as blockX,
       (y - ((y % ?) + ?) % ?) / ? as blockY,
       MIN(first_visited_at) as firstVisitedAt,
       MAX(last_visited_at) as lastVisitedAt,
       SUM(visit_count) as visitCount
     FROM visited_cells
     WHERE x BETWEEN ? AND ? AND y BETWEEN ? AND ?
     GROUP BY blockX, blockY
     ORDER BY blockY ASC, blockX ASC`,
    ratio,
    ratio,
    ratio,
    ratio,
    ratio,
    ratio,
    ratio,
    ratio,
    bounds.minX,
    bounds.maxX,
    bounds.minY,
    bounds.maxY,
  );

  return rows.map((row) => ({
    cellId: `${displayCellSizeMeters}:${row.blockX}:${row.blockY}`,
    cellSizeMeters: displayCellSizeMeters,
    x: row.blockX,
    y: row.blockY,
    firstVisitedAt: row.firstVisitedAt,
    lastVisitedAt: row.lastVisitedAt,
    visitCount: row.visitCount,
  }));
}

/** 指定したcellIdのvisited cellを取得する。 */
export async function getVisitedCellsByIds(cellIds: string[]): Promise<VisitedCellRow[]> {
  if (cellIds.length === 0) {
    return [];
  }

  const uniqueCellIds = [...new Set(cellIds)];
  const placeholders = uniqueCellIds.map(() => '?').join(', ');

  return db.getAllAsync<VisitedCellRow>(
    `SELECT ${visitedCellColumns}
     FROM visited_cells
     WHERE cell_id IN (${placeholders})
     ORDER BY cell_id ASC`,
    ...uniqueCellIds,
  );
}

/** すべてのvisited cellを削除する。 */
export async function deleteAllVisitedCells(): Promise<void> {
  await db.runAsync('DELETE FROM visited_cells');
}

function dedupeCells(cells: GridCell[]): GridCell[] {
  return [...new Map(cells.map((cell) => [cell.cellId, cell])).values()];
}
