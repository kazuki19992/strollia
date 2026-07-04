import type { GridOverlayConfig } from './config/gridOverlayConfig';
import { GRID_OVERLAY_CONFIG } from './config/gridOverlayConfig';
import { cellToPolygonCoordinates } from '../location/grid/gridCell';
import type { GridCellPolygonSource } from '../location/grid/gridCell';
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
  /** 境界線幅。内側罫線を出さないため通常は0。 */
  strokeWidth: number;
  /** この表示セル範囲に含まれる最古の訪問日時。 */
  firstVisitedAt?: string;
  /** この表示セル範囲に含まれる最新の訪問日時。 */
  lastVisitedAt?: string;
  /** この表示セル範囲に含まれる訪問回数。 */
  visitCount?: number;
};

/** 表示セルごとの追加opacityを返す関数。0から1の値を想定し、範囲外は描画時にclampする。 */
export type VisitedGridCellOpacityResolver = (cell: GridCellPolygonSource) => number;

/**
 * 表示範囲に応じてFog opacityを線形補間する。
 *
 * @param region - MapView表示範囲に相当する値。
 * @param config - Grid Overlay設定。
 * @returns Fog opacity。
 */
export function getFogOpacity(region: RegionOpacityLike | null, config: GridOverlayConfig = GRID_OVERLAY_CONFIG): number {
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

  const progress = (latitudeDelta - config.opacityStartLatitudeDelta) / (config.opacityEndLatitudeDelta - config.opacityStartLatitudeDelta);

  return config.minimumFogOpacity + (config.maximumFogOpacity - config.minimumFogOpacity) * progress;
}

/**
 * visited cellをMapView Polygon用の表示データへ変換する。
 *
 * @param cells - 表示対象のvisited cell。
 * @param opacity - Fogに合わせた表示opacity。
 * @param themePrimaryColor - 現在テーマのprimary色。
 * @param config - Grid Overlay設定。
 * @param cellOpacityResolver - 新規セルのフェードなど、セルごとの追加opacity。0から1の値を想定し、範囲外はclampする。
 * @returns Polygon描画用データ。
 */
export function toVisitedGridOverlayCells(
  cells: GridCellPolygonSource[],
  opacity: number,
  themePrimaryColor: string,
  config: GridOverlayConfig = GRID_OVERLAY_CONFIG,
  cellOpacityResolver: VisitedGridCellOpacityResolver = () => 1,
): VisitedGridOverlayCell[] {
  const visitedCellColor = resolveVisitedGridCellColor(themePrimaryColor, config);

  return cells.map((cell) => {
    const cellOpacity = Math.min(1, Math.max(0, cellOpacityResolver(cell)));

    return {
      id: cell.cellId,
      coordinates: cellToPolygonCoordinates(cell),
      fillColor: colorWithOpacity(visitedCellColor, opacity * cellOpacity),
      strokeColor: colorWithOpacity(visitedCellColor, 0),
      strokeWidth: 0,
      firstVisitedAt: cell.firstVisitedAt,
      lastVisitedAt: cell.lastVisitedAt,
      visitCount: cell.visitCount,
    };
  });
}

/**
 * visited cellの表示色を解決する。
 *
 * @param themePrimaryColor - 現在テーマのprimary色。
 * @param config - Grid Overlay設定。
 * @returns visited cellとして使うHEX色。
 */
export function resolveVisitedGridCellColor(themePrimaryColor: string, config: GridOverlayConfig = GRID_OVERLAY_CONFIG): string {
  return config.visitedCellColorOverride ?? themePrimaryColor;
}

function colorWithOpacity(hexColor: string, opacity: number): string {
  const clampedOpacity = Math.min(1, Math.max(0, opacity));
  const match = hexColor.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);

  if (!match) {
    return `rgba(0, 0, 0, ${clampedOpacity})`;
  }

  const rawHex = match[1];
  const hex =
    rawHex.length === 3
      ? rawHex
          .split('')
          .map((character) => `${character}${character}`)
          .join('')
      : rawHex;
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${clampedOpacity})`;
}
