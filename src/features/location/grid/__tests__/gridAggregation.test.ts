import { GRID_OVERLAY_CONFIG } from '../../../map/config/gridOverlayConfig';
import { aggregateVisitedCells, getDisplayCellSizeMeters, getStableDisplayCellSizeMeters, mergeAdjacentGridCells } from '../gridAggregation';
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

  it('セルサイズ切替境界付近では直前の表示セルサイズを維持する', () => {
    expect(getStableDisplayCellSizeMeters({ latitudeDelta: 0.061 }, 100, GRID_OVERLAY_CONFIG)).toBe(100);
    expect(getStableDisplayCellSizeMeters({ latitudeDelta: 0.05 }, 200, GRID_OVERLAY_CONFIG)).toBe(200);
  });

  it('セルサイズ切替境界から十分離れた場合は次の表示セルサイズへ切り替える', () => {
    expect(getStableDisplayCellSizeMeters({ latitudeDelta: 0.073 }, 100, GRID_OVERLAY_CONFIG)).toBe(200);
    expect(getStableDisplayCellSizeMeters({ latitudeDelta: 0.04 }, 200, GRID_OVERLAY_CONFIG)).toBe(100);
  });

  it('visitedな100mセルが1つでもあれば大セルをvisitedにする', () => {
    const cell = {
      ...coordinateToGridCell({ latitude: 35.681236, longitude: 139.767125 }),
      firstVisitedAt: '2026-05-24T00:00:00.000Z',
      lastVisitedAt: '2026-05-24T00:10:00.000Z',
      visitCount: 2,
    };
    const aggregated = aggregateVisitedCells([cell], 200);

    expect(aggregated).toHaveLength(1);
    expect(aggregated[0].cellSizeMeters).toBe(200);
    expect(aggregated[0].cellId.startsWith('200:')).toBe(true);
    expect(aggregated[0]).toEqual(expect.objectContaining({
      firstVisitedAt: '2026-05-24T00:00:00.000Z',
      lastVisitedAt: '2026-05-24T00:10:00.000Z',
      visitCount: 2,
    }));
  });

  it('集約セルの訪問日時と訪問回数をまとめる', () => {
    const base = coordinateToGridCell({ latitude: 35.681236, longitude: 139.767125 });
    const aggregated = aggregateVisitedCells([
      { ...base, firstVisitedAt: '2026-05-24T00:10:00.000Z', lastVisitedAt: '2026-05-24T00:20:00.000Z', visitCount: 2 },
      { ...base, firstVisitedAt: '2026-05-24T00:00:00.000Z', lastVisitedAt: '2026-05-24T00:30:00.000Z', visitCount: 3 },
    ], 200);

    expect(aggregated[0]).toEqual(expect.objectContaining({
      firstVisitedAt: '2026-05-24T00:00:00.000Z',
      lastVisitedAt: '2026-05-24T00:30:00.000Z',
      visitCount: 5,
    }));
  });

  it('表示セルサイズが基本セルの整数倍でない場合は失敗させる', () => {
    const cell = coordinateToGridCell({ latitude: 35.681236, longitude: 139.767125 });

    expect(() => aggregateVisitedCells([cell], 250)).toThrow('displayCellSizeMeters must be a multiple');
  });

  it('横に連続するvisited cellを1つの矩形にまとめる', () => {
    const rectangles = mergeAdjacentGridCells([
      {
        cellId: '100:10:20',
        cellSizeMeters: 100,
        x: 10,
        y: 20,
        firstVisitedAt: '2026-05-24T00:10:00.000Z',
        lastVisitedAt: '2026-05-24T00:20:00.000Z',
        visitCount: 1,
      },
      {
        cellId: '100:11:20',
        cellSizeMeters: 100,
        x: 11,
        y: 20,
        firstVisitedAt: '2026-05-24T00:00:00.000Z',
        lastVisitedAt: '2026-05-24T00:30:00.000Z',
        visitCount: 2,
      },
      {
        cellId: '100:12:20',
        cellSizeMeters: 100,
        x: 12,
        y: 20,
        firstVisitedAt: '2026-05-24T00:05:00.000Z',
        lastVisitedAt: '2026-05-24T00:25:00.000Z',
        visitCount: 3,
      },
    ]);

    expect(rectangles).toEqual([
      expect.objectContaining({
        cellId: 'rect:100:10:20',
        x: 10,
        y: 20,
        widthCells: 3,
        heightCells: 1,
        firstVisitedAt: '2026-05-24T00:00:00.000Z',
        lastVisitedAt: '2026-05-24T00:30:00.000Z',
        visitCount: 6,
      }),
    ]);
  });

  it('同じ幅で上下に連続するvisited cellを大きな矩形にまとめる', () => {
    const rectangles = mergeAdjacentGridCells([
      {
        cellId: '100:10:20',
        cellSizeMeters: 100,
        x: 10,
        y: 20,
        firstVisitedAt: '2026-05-24T00:20:00.000Z',
        lastVisitedAt: '2026-05-24T00:30:00.000Z',
        visitCount: 1,
      },
      {
        cellId: '100:11:20',
        cellSizeMeters: 100,
        x: 11,
        y: 20,
        firstVisitedAt: '2026-05-24T00:10:00.000Z',
        lastVisitedAt: '2026-05-24T00:40:00.000Z',
        visitCount: 2,
      },
      {
        cellId: '100:10:21',
        cellSizeMeters: 100,
        x: 10,
        y: 21,
        firstVisitedAt: '2026-05-24T00:00:00.000Z',
        lastVisitedAt: '2026-05-24T00:50:00.000Z',
        visitCount: 3,
      },
      {
        cellId: '100:11:21',
        cellSizeMeters: 100,
        x: 11,
        y: 21,
        firstVisitedAt: '2026-05-24T00:15:00.000Z',
        lastVisitedAt: '2026-05-24T00:35:00.000Z',
        visitCount: 4,
      },
    ]);

    expect(rectangles).toHaveLength(1);
    expect(rectangles[0]).toEqual(expect.objectContaining({
      cellId: 'rect:100:10:20',
      x: 10,
      y: 20,
      widthCells: 2,
      heightCells: 2,
      firstVisitedAt: '2026-05-24T00:00:00.000Z',
      lastVisitedAt: '2026-05-24T00:50:00.000Z',
      visitCount: 10,
    }));
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
