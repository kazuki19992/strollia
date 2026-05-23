import { GRID_OVERLAY_CONFIG } from '../config/gridOverlayConfig';
import { toVisitedGridOverlayCells, getFogOpacity } from '../gridOverlay';
import { coordinateToGridCell } from '../../location/grid/gridCell';

describe('Visited Grid Overlay表示計算 gridOverlay', () => {
  it('latitudeDeltaに応じてFog opacityを線形補間する', () => {
    expect(getFogOpacity({ latitudeDelta: 0.001 }, GRID_OVERLAY_CONFIG)).toBe(0.2);
    expect(getFogOpacity({ latitudeDelta: 0.2 }, GRID_OVERLAY_CONFIG)).toBe(0.6);
    expect(getFogOpacity({ latitudeDelta: 0.105 }, GRID_OVERLAY_CONFIG)).toBeCloseTo(0.4);
  });

  it('visited cellをMapView Polygon用データへ変換する', () => {
    const cell = coordinateToGridCell({ latitude: 35.681236, longitude: 139.767125 });
    const [overlayCell] = toVisitedGridOverlayCells([cell], 0.4, GRID_OVERLAY_CONFIG);

    expect(overlayCell.id).toBe(cell.cellId);
    expect(overlayCell.coordinates).toHaveLength(4);
    expect(overlayCell.fillColor).toContain('0.4');
  });
});
