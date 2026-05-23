/** Visited Grid Overlayの調整値。 */
export type GridOverlayConfig = {
  /** SQLiteに保存する基本セルサイズ。 */
  baseCellSizeMeters: number;
  /** 表示時に使う集約セルサイズ候補。 */
  displayCellSizesMeters: number[];
  /** 通常表示時のFog opacity。 */
  minimumFogOpacity: number;
  /** 広域表示時の最大Fog opacity。 */
  maximumFogOpacity: number;
  /** opacity変化を始めるlatitudeDelta。 */
  opacityStartLatitudeDelta: number;
  /** opacity変化が最大になるlatitudeDelta。 */
  opacityEndLatitudeDelta: number;
  /** Fogセルの色。 */
  fogColor: string;
  /** visitedセルの色。 */
  visitedCellColor: string;
};

/** Visited Grid Overlayの既定設定。 */
export const GRID_OVERLAY_CONFIG: GridOverlayConfig = {
  baseCellSizeMeters: 50,
  displayCellSizesMeters: [50, 100, 200, 500, 1000],
  minimumFogOpacity: 0.2,
  maximumFogOpacity: 0.6,
  opacityStartLatitudeDelta: 0.01,
  opacityEndLatitudeDelta: 0.2,
  fogColor: '#111111',
  visitedCellColor: '#88f0c2',
};
