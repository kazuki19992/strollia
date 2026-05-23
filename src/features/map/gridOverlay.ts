import type { GridOverlayConfig } from './config/gridOverlayConfig';
import { GRID_OVERLAY_CONFIG } from './config/gridOverlayConfig';
import { cellToPolygonCoordinates, GridCell } from '../location/grid/gridCell';
import type { LatLng } from 'react-native-maps';

type RegionOpacityLike = {
  latitudeDelta: number;
};

/** MapView Polygonへ渡すvisited grid cell。 */
export type VisitedGridOverlayCell = {
  /** React key兼デバッグ用ID。 */
  id: string;
  /** Polygon頂点。 */
  coordinates: LatLng[];
  /** 塗り色。 */
  fillColor: string;
  /** 境界線色。 */
  strokeColor: string;
};

/**
 * 表示範囲に応じてFog opacityを線形補間する。
 *
 * @param region - MapView表示範囲に相当する値。
 * @param config - Grid Overlay設定。
 * @returns Fog opacity。
 */
export function getFogOpacity(
  region: RegionOpacityLike | null,
  config: GridOverlayConfig = GRID_OVERLAY_CONFIG,
): number {
  if (!region) {
    return config.minimumFogOpacity;
  }

  const latitudeDelta = Math.abs(region.latitudeDelta);

  if (latitudeDelta <= config.opacityStartLatitudeDelta) {
    return config.minimumFogOpacity;
  }

  if (latitudeDelta >= config.opacityEndLatitudeDelta) {
    return config.maximumFogOpacity;
  }

  const progress =
    (latitudeDelta - config.opacityStartLatitudeDelta) /
    (config.opacityEndLatitudeDelta - config.opacityStartLatitudeDelta);

  return config.minimumFogOpacity + (config.maximumFogOpacity - config.minimumFogOpacity) * progress;
}

/**
 * visited cellをMapView Polygon用の表示データへ変換する。
 *
 * @param cells - 表示対象のvisited cell。
 * @param opacity - Fogに合わせた表示opacity。
 * @param config - Grid Overlay設定。
 * @returns Polygon描画用データ。
 */
export function toVisitedGridOverlayCells(
  cells: GridCell[],
  opacity: number,
  config: GridOverlayConfig = GRID_OVERLAY_CONFIG,
): VisitedGridOverlayCell[] {
  return cells.map((cell) => ({
    id: cell.cellId,
    coordinates: cellToPolygonCoordinates(cell),
    fillColor: colorWithOpacity(config.visitedCellColor, opacity),
    strokeColor: colorWithOpacity(config.visitedCellColor, Math.min(opacity + 0.2, 0.9)),
  }));
}

function colorWithOpacity(hexColor: string, opacity: number): string {
  const red = parseInt(hexColor.slice(1, 3), 16);
  const green = parseInt(hexColor.slice(3, 5), 16);
  const blue = parseInt(hexColor.slice(5, 7), 16);

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}
