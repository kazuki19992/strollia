import type { LatLng, Region } from 'react-native-maps';

import { GRID_OVERLAY_CONFIG } from '../../map/config/gridOverlayConfig';

/** Web Mercatorで使う地球半径。単位はm。 */
const WEB_MERCATOR_RADIUS_METERS = 6_378_137;
/** Web Mercator変換で発散しないよう緯度を制限する。 */
const WEB_MERCATOR_MAX_LATITUDE = 85.05112878;
/** Web Mercatorの世界半周幅。単位はm。 */
const WEB_MERCATOR_HALF_WORLD_WIDTH_METERS = WEB_MERCATOR_RADIUS_METERS * Math.PI;

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
  /** このセル範囲に含まれる最古の訪問日時。 */
  firstVisitedAt?: string;
  /** このセル範囲に含まれる最新の訪問日時。 */
  lastVisitedAt?: string;
  /** このセル範囲に含まれる訪問回数。 */
  visitCount?: number;
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

/** 表示範囲からセル検索範囲を作るときのオプション。 */
export type GridBoundsOptions = {
  /** 表示範囲の半径に対して外側へ追加する比率。 */
  paddingRatio?: number;
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
 * @param options - 端セルのちらつきを抑えるための検索余白。
 * @returns SQLite検索に使うセル番号範囲。
 */
export function getGridBoundsForRegion(region: Region, options: GridBoundsOptions = {}): GridBounds {
  const paddingRatio = Math.max(0, options.paddingRatio ?? 0);
  const latitudeRadius = (region.latitudeDelta / 2) * (1 + paddingRatio);
  const longitudeRadius = (region.longitudeDelta / 2) * (1 + paddingRatio);
  const northLatitude = region.latitude + latitudeRadius;
  const southLatitude = region.latitude - latitudeRadius;
  const westLongitude = region.longitude - longitudeRadius;
  const eastLongitude = region.longitude + longitudeRadius;
  const northWest = coordinateToGridCell({
    latitude: northLatitude,
    longitude: westLongitude,
  });
  const southEast = coordinateToGridCell({
    latitude: southLatitude,
    longitude: eastLongitude,
  });
  const crossesAntimeridian = westLongitude < -180 || eastLongitude > 180;
  const worldMinX = Math.floor(-WEB_MERCATOR_HALF_WORLD_WIDTH_METERS / GRID_OVERLAY_CONFIG.baseCellSizeMeters);
  const worldMaxX = Math.floor(WEB_MERCATOR_HALF_WORLD_WIDTH_METERS / GRID_OVERLAY_CONFIG.baseCellSizeMeters);

  return {
    minX: crossesAntimeridian ? worldMinX : Math.min(northWest.x, southEast.x),
    maxX: crossesAntimeridian ? worldMaxX : Math.max(northWest.x, southEast.x),
    minY: Math.min(northWest.y, southEast.y),
    maxY: Math.max(northWest.y, southEast.y),
  };
}
