import type { GridOverlayConfig } from '../../map/config/gridOverlayConfig';
import { GRID_OVERLAY_CONFIG } from '../../map/config/gridOverlayConfig';
import type { GridCell } from './gridCell';

type RegionZoomLike = {
  latitudeDelta: number;
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

  if (latitudeDelta < 0.02) {
    return config.displayCellSizesMeters[0];
  }

  if (latitudeDelta < 0.06) {
    return config.displayCellSizesMeters[1];
  }

  if (latitudeDelta < 0.15) {
    return config.displayCellSizesMeters[2];
  }

  if (latitudeDelta < 0.35) {
    return config.displayCellSizesMeters[3];
  }

  return config.displayCellSizesMeters[4];
}

/**
 * 保存済み50mセルを表示用の大セルへ集約する。
 *
 * @param cells - 保存済みvisited cell。
 * @param displayCellSizeMeters - 表示セルサイズ。
 * @returns 表示用に重複排除したvisited cell。
 */
export function aggregateVisitedCells(cells: GridCell[], displayCellSizeMeters: number): GridCell[] {
  const ratio = Math.max(1, Math.round(displayCellSizeMeters / GRID_OVERLAY_CONFIG.baseCellSizeMeters));
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
