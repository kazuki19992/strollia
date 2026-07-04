import type { GridOverlayConfig } from '../../map/config/gridOverlayConfig';
import { GRID_OVERLAY_CONFIG } from '../../map/config/gridOverlayConfig';
import type { GridCell } from './gridCell';

type RegionZoomLike = {
  latitudeDelta: number;
};

type DisplayCellSizeStage = {
  cellSizeMeters: number;
  maxLatitudeDelta: number;
};

const DISPLAY_CELL_SIZE_STAGES: DisplayCellSizeStage[] = [
  { cellSizeMeters: 100, maxLatitudeDelta: 0.06 },
  { cellSizeMeters: 200, maxLatitudeDelta: 0.15 },
  { cellSizeMeters: 500, maxLatitudeDelta: 0.35 },
  { cellSizeMeters: 1000, maxLatitudeDelta: 0.8 },
  { cellSizeMeters: 2000, maxLatitudeDelta: 2 },
  { cellSizeMeters: 5000, maxLatitudeDelta: 4 },
];

/**
 * 表示範囲の広さからGrid Overlayの表示セルサイズを選ぶ。
 *
 * @param region - MapView表示範囲に相当する値。
 * @param config - Grid Overlay設定。
 * @returns 表示に使うセルサイズ。単位はm。
 */
export function getDisplayCellSizeMeters(region: RegionZoomLike, config: GridOverlayConfig = GRID_OVERLAY_CONFIG): number {
  const stageIndex = getDisplayCellSizeStageIndex(region);

  if (stageIndex < DISPLAY_CELL_SIZE_STAGES.length) {
    return config.displayCellSizesMeters[stageIndex] ?? getLastDisplayCellSize(config);
  }

  return getLastDisplayCellSize(config);
}

/**
 * 表示セルサイズの切替境界付近で直前サイズを維持し、ズーム操作中のちらつきを抑える。
 *
 * @param region - MapView表示範囲に相当する値。
 * @param previousCellSizeMeters - 直前に使った表示セルサイズ。
 * @param config - Grid Overlay設定。
 * @returns ヒステリシスを加味した表示セルサイズ。単位はm。
 */
export function getStableDisplayCellSizeMeters(
  region: RegionZoomLike,
  previousCellSizeMeters: number | null,
  config: GridOverlayConfig = GRID_OVERLAY_CONFIG,
): number {
  const nextCellSizeMeters = getDisplayCellSizeMeters(region, config);

  if (!previousCellSizeMeters || previousCellSizeMeters === nextCellSizeMeters) {
    return nextCellSizeMeters;
  }

  const previousIndex = config.displayCellSizesMeters.indexOf(previousCellSizeMeters);
  const nextIndex = config.displayCellSizesMeters.indexOf(nextCellSizeMeters);

  if (previousIndex < 0 || nextIndex < 0 || Math.abs(previousIndex - nextIndex) > 1) {
    return nextCellSizeMeters;
  }

  const boundary = DISPLAY_CELL_SIZE_STAGES[Math.min(previousIndex, nextIndex)]?.maxLatitudeDelta;

  if (!boundary) {
    return nextCellSizeMeters;
  }

  const latitudeDelta = Math.abs(region.latitudeDelta);
  const hysteresisRatio = Math.max(0, config.displayCellSizeHysteresisRatio);

  if (nextIndex > previousIndex && latitudeDelta < boundary * (1 + hysteresisRatio)) {
    return previousCellSizeMeters;
  }

  if (nextIndex < previousIndex && latitudeDelta >= boundary * (1 - hysteresisRatio)) {
    return previousCellSizeMeters;
  }

  return nextCellSizeMeters;
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
        firstVisitedAt: cell.firstVisitedAt,
        lastVisitedAt: cell.lastVisitedAt,
        visitCount: cell.visitCount,
      });
      continue;
    }

    const existing = aggregated.get(cellId)!;
    existing.firstVisitedAt = getEarlierIsoString(existing.firstVisitedAt, cell.firstVisitedAt);
    existing.lastVisitedAt = getLaterIsoString(existing.lastVisitedAt, cell.lastVisitedAt);
    existing.visitCount = (existing.visitCount ?? 0) + (cell.visitCount ?? 0);
  }

  return [...aggregated.values()].sort(
    (a, b) => a.cellSizeMeters - b.cellSizeMeters || a.y - b.y || a.x - b.x || a.cellId.localeCompare(b.cellId),
  );
}

function getLastDisplayCellSize(config: GridOverlayConfig): number {
  return config.displayCellSizesMeters[config.displayCellSizesMeters.length - 1] ?? GRID_OVERLAY_CONFIG.baseCellSizeMeters;
}

/**
 * 表示範囲の緯度差からセルサイズ段階を返す。
 *
 * @param region - MapView表示範囲に相当する値。
 * @returns 0始まりのセルサイズ段階。定義済み範囲より広い場合は最後の次の段階。
 */
function getDisplayCellSizeStageIndex(region: RegionZoomLike): number {
  const latitudeDelta = Math.abs(region.latitudeDelta);
  const stageIndex = DISPLAY_CELL_SIZE_STAGES.findIndex((stage) => latitudeDelta < stage.maxLatitudeDelta);

  return stageIndex >= 0 ? stageIndex : DISPLAY_CELL_SIZE_STAGES.length;
}

/**
 * ISO 8601文字列のうち早い時刻を返す。
 *
 * @param previous - 既存のISO 8601日時。未定義ならnextを採用する。
 * @param next - 比較するISO 8601日時。未定義ならpreviousを採用する。
 * @returns 文字列の辞書順で早い日時。ISO 8601以外の文字列順は呼び出し側の責務。
 */
function getEarlierIsoString(previous: string | undefined, next: string | undefined): string | undefined {
  if (!previous) {
    return next;
  }

  if (!next) {
    return previous;
  }

  return next < previous ? next : previous;
}

/**
 * ISO 8601文字列のうち遅い時刻を返す。
 *
 * @param previous - 既存のISO 8601日時。未定義ならnextを採用する。
 * @param next - 比較するISO 8601日時。未定義ならpreviousを採用する。
 * @returns 文字列の辞書順で遅い日時。ISO 8601以外の文字列順は呼び出し側の責務。
 */
function getLaterIsoString(previous: string | undefined, next: string | undefined): string | undefined {
  if (!previous) {
    return next;
  }

  if (!next) {
    return previous;
  }

  return next > previous ? next : previous;
}
