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
  /** visitedセル色をテーマprimaryから差し替える場合に使う値。 */
  visitedCellColorOverride: string | null;
  /** 表示範囲外も先読みする余白比率。 */
  boundsPaddingRatio: number;
  /** 表示セルサイズ切替境界に持たせる遊びの比率。 */
  displayCellSizeHysteresisRatio: number;
};

/** Visited Grid Overlayの既定設定。 */
export const GRID_OVERLAY_CONFIG: GridOverlayConfig = {
  baseCellSizeMeters: 100,
  displayCellSizesMeters: [100, 200, 500, 1000, 2000, 5000, 10000],
  minimumFogOpacity: 0.2,
  maximumFogOpacity: 0.6,
  opacityStartLatitudeDelta: 0.01,
  opacityEndLatitudeDelta: 0.2,
  fogColor: '#111111',
  visitedCellColorOverride: null,
  boundsPaddingRatio: 0.5,
  displayCellSizeHysteresisRatio: 0.2,
};
