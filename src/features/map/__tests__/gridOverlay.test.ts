import { GRID_OVERLAY_CONFIG } from '../config/gridOverlayConfig';
import { toVisitedGridOverlayCells, getFogOpacity, resolveVisitedGridCellColor } from '../gridOverlay';
import { coordinateToGridCell } from '../../location/grid/gridCell';

describe('Visited Grid Overlay表示計算 gridOverlay', () => {
  it('latitudeDeltaに応じてFog opacityを線形補間する', () => {
    expect(getFogOpacity({ latitudeDelta: 0.001 }, GRID_OVERLAY_CONFIG)).toBe(0.2);
    expect(getFogOpacity({ latitudeDelta: 0.2 }, GRID_OVERLAY_CONFIG)).toBe(0.6);
    expect(getFogOpacity({ latitudeDelta: 0.105 }, GRID_OVERLAY_CONFIG)).toBeCloseTo(0.4);
  });

  it('visited cellをMapView Polygon用データへ変換する', () => {
    const cell = coordinateToGridCell({ latitude: 35.681236, longitude: 139.767125 });
    const [overlayCell] = toVisitedGridOverlayCells([cell], 0.4, '#009688', GRID_OVERLAY_CONFIG);

    expect(overlayCell.id).toBe(cell.cellId);
    expect(overlayCell.coordinates).toHaveLength(4);
    expect(overlayCell.fillColor).toBe('rgba(0, 150, 136, 0.4)');
    expect(overlayCell.strokeWidth).toBe(0);
  });

  it('visited cell色は設定値がなければテーマprimaryを使う', () => {
    expect(resolveVisitedGridCellColor('#009688', GRID_OVERLAY_CONFIG)).toBe('#009688');
    expect(resolveVisitedGridCellColor('#009688', { ...GRID_OVERLAY_CONFIG, visitedCellColorOverride: '#123456' })).toBe('#123456');
  });
});
