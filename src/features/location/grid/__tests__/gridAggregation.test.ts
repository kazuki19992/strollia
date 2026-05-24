import { GRID_OVERLAY_CONFIG } from '../../../map/config/gridOverlayConfig';
import { aggregateVisitedCells, getDisplayCellSizeMeters, mergeAdjacentGridCells } from '../gridAggregation';
import { coordinateToGridCell } from '../gridCell';

describe('Visited Grid表示集約 gridAggregation', () => {
  it('ズームに応じて表示セルサイズを選ぶ', () => {
    expect(getDisplayCellSizeMeters({ latitudeDelta: 0.005 }, GRID_OVERLAY_CONFIG)).toBe(100);
    expect(getDisplayCellSizeMeters({ latitudeDelta: 0.03 }, GRID_OVERLAY_CONFIG)).toBe(100);
    expect(getDisplayCellSizeMeters({ latitudeDelta: 0.08 }, GRID_OVERLAY_CONFIG)).toBe(200);
    expect(getDisplayCellSizeMeters({ latitudeDelta: 0.5 }, GRID_OVERLAY_CONFIG)).toBe(1000);
    expect(getDisplayCellSizeMeters({ latitudeDelta: 2.5 }, GRID_OVERLAY_CONFIG)).toBe(5000);
    expect(getDisplayCellSizeMeters({ latitudeDelta: 4.5 }, GRID_OVERLAY_CONFIG)).toBe(10000);
  });

  it('visitedな100mセルが1つでもあれば大セルをvisitedにする', () => {
    const cell = coordinateToGridCell({ latitude: 35.681236, longitude: 139.767125 });
    const aggregated = aggregateVisitedCells([cell], 200);

    expect(aggregated).toHaveLength(1);
    expect(aggregated[0].cellSizeMeters).toBe(200);
    expect(aggregated[0].cellId.startsWith('200:')).toBe(true);
  });

  it('表示セルサイズが基本セルの整数倍でない場合は失敗させる', () => {
    const cell = coordinateToGridCell({ latitude: 35.681236, longitude: 139.767125 });

    expect(() => aggregateVisitedCells([cell], 250)).toThrow('displayCellSizeMeters must be a multiple');
  });

  it('横に連続するvisited cellを1つの矩形にまとめる', () => {
    const rectangles = mergeAdjacentGridCells([
      { cellId: '100:10:20', cellSizeMeters: 100, x: 10, y: 20 },
      { cellId: '100:11:20', cellSizeMeters: 100, x: 11, y: 20 },
      { cellId: '100:12:20', cellSizeMeters: 100, x: 12, y: 20 },
    ]);

    expect(rectangles).toEqual([
      expect.objectContaining({
        cellId: '100:10:20:3x1',
        x: 10,
        y: 20,
        widthCells: 3,
        heightCells: 1,
      }),
    ]);
  });

  it('同じ幅で上下に連続するvisited cellを大きな矩形にまとめる', () => {
    const rectangles = mergeAdjacentGridCells([
      { cellId: '100:10:20', cellSizeMeters: 100, x: 10, y: 20 },
      { cellId: '100:11:20', cellSizeMeters: 100, x: 11, y: 20 },
      { cellId: '100:10:21', cellSizeMeters: 100, x: 10, y: 21 },
      { cellId: '100:11:21', cellSizeMeters: 100, x: 11, y: 21 },
    ]);

    expect(rectangles).toHaveLength(1);
    expect(rectangles[0]).toEqual(expect.objectContaining({ x: 10, y: 20, widthCells: 2, heightCells: 2 }));
  });

  it('L字のvisited cell集合は複数矩形として扱う', () => {
    const rectangles = mergeAdjacentGridCells([
      { cellId: '100:10:20', cellSizeMeters: 100, x: 10, y: 20 },
      { cellId: '100:11:20', cellSizeMeters: 100, x: 11, y: 20 },
      { cellId: '100:10:21', cellSizeMeters: 100, x: 10, y: 21 },
    ]);

    expect(rectangles.length).toBeGreaterThan(1);
  });
});
