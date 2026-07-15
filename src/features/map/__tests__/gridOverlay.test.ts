import { GRID_OVERLAY_CONFIG } from '@/features/map/config/gridOverlayConfig';
import { toVisitedGridOverlayCells, getFogOpacity, resolveVisitedGridCellColor } from '@/features/map/gridOverlay';
import { coordinateToGridCell } from '@/features/location/grid/gridCell';

describe('Visited Grid Overlay表示計算 gridOverlay', () => {
  it('latitudeDeltaに応じてFog opacityを線形補間する', () => {
    expect(getFogOpacity({ latitudeDelta: 0.001 }, GRID_OVERLAY_CONFIG)).toBe(0.2);
    expect(getFogOpacity({ latitudeDelta: 0.2 }, GRID_OVERLAY_CONFIG)).toBe(0.6);
    expect(getFogOpacity({ latitudeDelta: 0.105 }, GRID_OVERLAY_CONFIG)).toBeCloseTo(0.4);
  });

  it('visited cellをMapView Polygon用データへ変換する', () => {
    const cell = {
      ...coordinateToGridCell({ latitude: 35.681236, longitude: 139.767125 }),
      firstVisitedAt: '2026-05-24T00:00:00.000Z',
      lastVisitedAt: '2026-05-24T00:10:00.000Z',
      visitCount: 2,
    };
    const [overlayCell] = toVisitedGridOverlayCells([cell], 0.4, '#009688', GRID_OVERLAY_CONFIG);

    expect(overlayCell.id).toBe(cell.cellId);
    expect(overlayCell.coordinates).toHaveLength(4);
    expect(overlayCell.fillColor).toBe('rgba(0, 150, 136, 0.4)');
    expect(overlayCell.strokeWidth).toBe(0);
    expect(overlayCell).toEqual(
      expect.objectContaining({
        firstVisitedAt: '2026-05-24T00:00:00.000Z',
        lastVisitedAt: '2026-05-24T00:10:00.000Z',
        visitCount: 2,
      }),
    );
  });

  it('セルごとのopacityで新規セルをフェード表示できる', () => {
    const cell = coordinateToGridCell({ latitude: 35.681236, longitude: 139.767125 });
    const [overlayCell] = toVisitedGridOverlayCells([cell], 0.4, '#009688', GRID_OVERLAY_CONFIG, () => 0.5);

    expect(overlayCell.fillColor).toBe('rgba(0, 150, 136, 0.2)');
  });

  it('visited cell色は3桁HEXでもrgbaへ変換する', () => {
    const cell = coordinateToGridCell({ latitude: 35.681236, longitude: 139.767125 });
    const [overlayCell] = toVisitedGridOverlayCells([cell], 1.2, '#096', GRID_OVERLAY_CONFIG);

    expect(overlayCell.fillColor).toBe('rgba(0, 153, 102, 1)');
  });

  it('visited cell色が不正な場合は安全なfallback色を使う', () => {
    const cell = coordinateToGridCell({ latitude: 35.681236, longitude: 139.767125 });
    const [overlayCell] = toVisitedGridOverlayCells([cell], -1, 'not-a-color', GRID_OVERLAY_CONFIG);

    expect(overlayCell.fillColor).toBe('rgba(0, 0, 0, 0)');
  });

  it('visited cell色は設定値がなければテーマprimaryを使う', () => {
    expect(resolveVisitedGridCellColor('#009688', GRID_OVERLAY_CONFIG)).toBe('#009688');
    expect(resolveVisitedGridCellColor('#009688', { ...GRID_OVERLAY_CONFIG, visitedCellColorOverride: '#123456' })).toBe('#123456');
  });
});
