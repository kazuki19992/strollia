import type { LatLng, Region } from 'react-native-maps';

import { GRID_OVERLAY_CONFIG } from '../../map/config/gridOverlayConfig';

/** Web Mercatorで使う地球半径。単位はm。 */
const WEB_MERCATOR_RADIUS_METERS = 6_378_137;
/** Web Mercator変換で発散しないよう緯度を制限する。 */
const WEB_MERCATOR_MAX_LATITUDE = 85.05112878;

/** Visited Gridのセル。 */
export type GridCell = {
  /** セルID。形式は `${cellSizeMeters}:${x}:${y}`。 */
  cellId: string;
  /** セルサイズ。単位はm。 */
  cellSizeMeters: number;
  /** Web Mercatorメートル座標をセルサイズで割ったX番号。 */
  x: number;
  /** Web Mercatorメートル座標をセルサイズで割ったY番号。 */
  y: number;
};

/** Polygon化できるセルまたはセル矩形。 */
export type GridCellPolygonSource = GridCell & {
  /** 横方向に含むセル数。省略時は1。 */
  widthCells?: number;
  /** 縦方向に含むセル数。省略時は1。 */
  heightCells?: number;
};

/** Grid取得に使うセル番号範囲。 */
export type GridBounds = {
  /** 最小X番号。 */
  minX: number;
  /** 最大X番号。 */
  maxX: number;
  /** 最小Y番号。 */
  minY: number;
  /** 最大Y番号。 */
  maxY: number;
};

type MercatorCoordinate = {
  x: number;
  y: number;
};

/**
 * 緯度経度をWeb Mercatorのメートル座標へ変換する。
 *
 * @param coordinate - 変換対象の緯度経度。
 * @returns Web Mercatorメートル座標。
 */
function toMercatorMeters(coordinate: LatLng): MercatorCoordinate {
  const latitude = Math.min(Math.max(coordinate.latitude, -WEB_MERCATOR_MAX_LATITUDE), WEB_MERCATOR_MAX_LATITUDE);
  const longitudeRadians = (coordinate.longitude * Math.PI) / 180;
  const latitudeRadians = (latitude * Math.PI) / 180;

  return {
    x: WEB_MERCATOR_RADIUS_METERS * longitudeRadians,
    y: WEB_MERCATOR_RADIUS_METERS * Math.log(Math.tan(Math.PI / 4 + latitudeRadians / 2)),
  };
}

/**
 * Web Mercatorのメートル座標を緯度経度へ戻す。
 *
 * @param coordinate - Web Mercatorメートル座標。
 * @returns MapViewへ渡す緯度経度。
 */
function fromMercatorMeters(coordinate: MercatorCoordinate): LatLng {
  const longitude = (coordinate.x / WEB_MERCATOR_RADIUS_METERS) * (180 / Math.PI);
  const latitude = (2 * Math.atan(Math.exp(coordinate.y / WEB_MERCATOR_RADIUS_METERS)) - Math.PI / 2) * (180 / Math.PI);

  return { latitude, longitude };
}

/**
 * 緯度経度をVisited Gridセルへ変換する。
 *
 * @param coordinate - GPS点の緯度経度。
 * @param cellSizeMeters - セルサイズ。省略時は基本100m。
 * @returns Web Mercator基準のセル。
 */
export function coordinateToGridCell(
  coordinate: LatLng,
  cellSizeMeters = GRID_OVERLAY_CONFIG.baseCellSizeMeters,
): GridCell {
  const mercator = toMercatorMeters(coordinate);
  const x = Math.floor(mercator.x / cellSizeMeters);
  const y = Math.floor(mercator.y / cellSizeMeters);

  return {
    cellId: `${cellSizeMeters}:${x}:${y}`,
    cellSizeMeters,
    x,
    y,
  };
}

/**
 * セルをMapView Polygon用の4頂点へ変換する。
 *
 * @param cell - 変換対象セル。
 * @returns 左下から時計回りに並べた緯度経度。
 */
export function cellToPolygonCoordinates(cell: GridCellPolygonSource): LatLng[] {
  const minX = cell.x * cell.cellSizeMeters;
  const minY = cell.y * cell.cellSizeMeters;
  const maxX = minX + cell.cellSizeMeters * (cell.widthCells ?? 1);
  const maxY = minY + cell.cellSizeMeters * (cell.heightCells ?? 1);

  return [
    fromMercatorMeters({ x: minX, y: minY }),
    fromMercatorMeters({ x: maxX, y: minY }),
    fromMercatorMeters({ x: maxX, y: maxY }),
    fromMercatorMeters({ x: minX, y: maxY }),
  ];
}

/**
 * 表示範囲を基本100mセル番号範囲へ変換する。
 *
 * @param region - MapViewの表示範囲。
 * @returns SQLite検索に使うセル番号範囲。
 */
export function getGridBoundsForRegion(region: Region): GridBounds {
  const northWest = coordinateToGridCell({
    latitude: region.latitude + region.latitudeDelta / 2,
    longitude: region.longitude - region.longitudeDelta / 2,
  });
  const southEast = coordinateToGridCell({
    latitude: region.latitude - region.latitudeDelta / 2,
    longitude: region.longitude + region.longitudeDelta / 2,
  });

  return {
    minX: Math.min(northWest.x, southEast.x),
    maxX: Math.max(northWest.x, southEast.x),
    minY: Math.min(northWest.y, southEast.y),
    maxY: Math.max(northWest.y, southEast.y),
  };
}
