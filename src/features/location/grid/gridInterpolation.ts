import { FAST_SPEED_MIN_KMH, estimateAcceptedSegmentSpeedMps } from '../locationSpeed';
import type { NewLocationPoint } from '../../../types/gps';
import { coordinateToGridCell, GridCell } from './gridCell';

/** visited cell開放を許可する最大GPS誤差。単位はm。 */
const VISITED_CELL_MAX_ACCURACY_METERS = 100;
/** 高速補間の仮想点間隔。単位は割合。 */
const HIGH_SPEED_INTERPOLATION_STEP_RATIO = 0.02;

/**
 * GPS点からvisited cellを生成する。
 *
 * 低速では現在点のセルだけを返し、高速移動時だけ点間を補間する。
 *
 * @param previous - 直前のセル開放対象点。
 * @param next - 現在のGPS点。
 * @returns 開放対象のvisited cell。
 */
export function getVisitedCellsForLocationPoint(previous: NewLocationPoint | null, next: NewLocationPoint): GridCell[] {
  if (!canOpenVisitedCell(next)) {
    return [];
  }

  const nextCell = coordinateToGridCell(next);

  if (!previous || !canOpenVisitedCell(previous)) {
    return [nextCell];
  }

  const speedKmh = estimateAcceptedSegmentSpeedMps(previous, next) * 3.6;

  if (speedKmh < FAST_SPEED_MIN_KMH) {
    return [nextCell];
  }

  return dedupeCells([
    coordinateToGridCell(previous),
    ...interpolateCoordinates(previous, next).map((coordinate) => coordinateToGridCell(coordinate)),
    nextCell,
  ]);
}

function canOpenVisitedCell(point: NewLocationPoint): boolean {
  return point.accuracy == null || point.accuracy <= VISITED_CELL_MAX_ACCURACY_METERS;
}

function interpolateCoordinates(previous: NewLocationPoint, next: NewLocationPoint): NewLocationPoint[] {
  const coordinates: NewLocationPoint[] = [];

  for (let ratio = HIGH_SPEED_INTERPOLATION_STEP_RATIO; ratio < 1; ratio += HIGH_SPEED_INTERPOLATION_STEP_RATIO) {
    coordinates.push({
      ...next,
      latitude: previous.latitude + (next.latitude - previous.latitude) * ratio,
      longitude: previous.longitude + (next.longitude - previous.longitude) * ratio,
    });
  }

  return coordinates;
}

function dedupeCells(cells: GridCell[]): GridCell[] {
  return [...new Map(cells.map((cell) => [cell.cellId, cell])).values()];
}
