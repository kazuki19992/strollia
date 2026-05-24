import type { GridOverlayConfig } from '../../map/config/gridOverlayConfig';
import { GRID_OVERLAY_CONFIG } from '../../map/config/gridOverlayConfig';
import type { GridCell } from './gridCell';

type RegionZoomLike = {
  latitudeDelta: number;
};

/** 隣接セルをまとめた表示用矩形。 */
export type GridCellRectangle = GridCell & {
  /** 横方向に含む表示セル数。 */
  widthCells: number;
  /** 縦方向に含む表示セル数。 */
  heightCells: number;
};

type HorizontalRun = {
  cellSizeMeters: number;
  x: number;
  y: number;
  widthCells: number;
};

/**
 * 表示範囲の広さからGrid Overlayの表示セルサイズを選ぶ。
 *
 * @param region - MapView表示範囲に相当する値。
 * @param config - Grid Overlay設定。
 * @returns 表示に使うセルサイズ。単位はm。
 */
export function getDisplayCellSizeMeters(
  region: RegionZoomLike,
  config: GridOverlayConfig = GRID_OVERLAY_CONFIG,
): number {
  const latitudeDelta = Math.abs(region.latitudeDelta);
  const fallbackSize = getLastDisplayCellSize(config);

  if (latitudeDelta < 0.06) {
    return config.displayCellSizesMeters[0] ?? GRID_OVERLAY_CONFIG.baseCellSizeMeters;
  }

  if (latitudeDelta < 0.15) {
    return config.displayCellSizesMeters[1] ?? config.displayCellSizesMeters[0] ?? GRID_OVERLAY_CONFIG.baseCellSizeMeters;
  }

  if (latitudeDelta < 0.35) {
    return config.displayCellSizesMeters[2] ?? fallbackSize;
  }

  if (latitudeDelta < 0.8) {
    return config.displayCellSizesMeters[3] ?? fallbackSize;
  }

  if (latitudeDelta < 2) {
    return config.displayCellSizesMeters[4] ?? fallbackSize;
  }

  if (latitudeDelta < 4) {
    return config.displayCellSizesMeters[5] ?? fallbackSize;
  }

  return config.displayCellSizesMeters[6] ?? fallbackSize;
}

/**
 * 保存済み100mセルを表示用の大セルへ集約する。
 *
 * @param cells - 保存済みvisited cell。
 * @param displayCellSizeMeters - 表示セルサイズ。
 * @returns 表示用に重複排除したvisited cell。
 */
export function aggregateVisitedCells(cells: GridCell[], displayCellSizeMeters: number): GridCell[] {
  const baseCellSizeMeters = GRID_OVERLAY_CONFIG.baseCellSizeMeters;

  if (displayCellSizeMeters % baseCellSizeMeters !== 0) {
    throw new Error(`displayCellSizeMeters must be a multiple of base cell size (${baseCellSizeMeters}).`);
  }

  const ratio = Math.max(1, displayCellSizeMeters / baseCellSizeMeters);
  const aggregated = new Map<string, GridCell>();

  for (const cell of cells) {
    const x = Math.floor(cell.x / ratio);
    const y = Math.floor(cell.y / ratio);
    const cellId = `${displayCellSizeMeters}:${x}:${y}`;

    if (!aggregated.has(cellId)) {
      aggregated.set(cellId, {
        cellId,
        cellSizeMeters: displayCellSizeMeters,
        x,
        y,
      });
    }
  }

  return [...aggregated.values()];
}

/**
 * 隣接する表示セルを矩形へまとめ、MapView Polygon数を抑える。
 *
 * 完全なポリゴン和演算ではなく、横方向の連続セルを作ってから同じ幅の行を
 * 縦方向へ結合する。L字などは複数矩形に分割される。
 *
 * @param cells - 集約済み表示セル。
 * @returns 表示用にマージした矩形。
 */
export function mergeAdjacentGridCells(cells: GridCell[]): GridCellRectangle[] {
  const runs = createHorizontalRuns(cells);
  const rectangles: GridCellRectangle[] = [];
  const activeRectangles = new Map<string, GridCellRectangle>();

  for (const run of runs) {
    const key = `${run.cellSizeMeters}:${run.x}:${run.widthCells}`;
    const active = activeRectangles.get(key);

    if (active && active.y + active.heightCells === run.y) {
      active.heightCells += 1;
      active.cellId = toRectangleCellId(active);
      continue;
    }

    const rectangle: GridCellRectangle = {
      cellId: '',
      cellSizeMeters: run.cellSizeMeters,
      x: run.x,
      y: run.y,
      widthCells: run.widthCells,
      heightCells: 1,
    };
    rectangle.cellId = toRectangleCellId(rectangle);
    activeRectangles.set(key, rectangle);
    rectangles.push(rectangle);
  }

  return rectangles;
}

function createHorizontalRuns(cells: GridCell[]): HorizontalRun[] {
  const rows = new Map<string, GridCell[]>();

  for (const cell of cells) {
    const key = `${cell.cellSizeMeters}:${cell.y}`;
    rows.set(key, [...(rows.get(key) ?? []), cell]);
  }

  return [...rows.values()]
    .flatMap((rowCells) => {
      const sortedCells = [...rowCells].sort((a, b) => a.x - b.x);
      const runs: HorizontalRun[] = [];
      let currentRun: HorizontalRun | null = null;

      for (const cell of sortedCells) {
        if (currentRun && currentRun.x + currentRun.widthCells === cell.x) {
          currentRun.widthCells += 1;
          continue;
        }

        currentRun = {
          cellSizeMeters: cell.cellSizeMeters,
          x: cell.x,
          y: cell.y,
          widthCells: 1,
        };
        runs.push(currentRun);
      }

      return runs;
    })
    .sort((a, b) => a.cellSizeMeters - b.cellSizeMeters || a.y - b.y || a.x - b.x);
}

function toRectangleCellId(rectangle: GridCellRectangle): string {
  return `${rectangle.cellSizeMeters}:${rectangle.x}:${rectangle.y}:${rectangle.widthCells}x${rectangle.heightCells}`;
}

function getLastDisplayCellSize(config: GridOverlayConfig): number {
  return config.displayCellSizesMeters[config.displayCellSizesMeters.length - 1] ?? GRID_OVERLAY_CONFIG.baseCellSizeMeters;
}
