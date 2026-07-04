import { GRID_OVERLAY_CONFIG } from '@/features/map/config/gridOverlayConfig';
import { aggregateVisitedCells, getDisplayCellSizeMeters, getStableDisplayCellSizeMeters } from '@/features/location/grid/gridAggregation';
import { coordinateToGridCell } from '@/features/location/grid/gridCell';

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
    expect(aggregated[0]).toEqual(
      expect.objectContaining({
        firstVisitedAt: '2026-05-24T00:00:00.000Z',
        lastVisitedAt: '2026-05-24T00:10:00.000Z',
        visitCount: 2,
      }),
    );
  });

  it('集約セルの訪問日時と訪問回数をまとめる', () => {
    const base = coordinateToGridCell({ latitude: 35.681236, longitude: 139.767125 });
    const aggregated = aggregateVisitedCells(
      [
        { ...base, firstVisitedAt: '2026-05-24T00:10:00.000Z', lastVisitedAt: '2026-05-24T00:20:00.000Z', visitCount: 2 },
        { ...base, firstVisitedAt: '2026-05-24T00:00:00.000Z', lastVisitedAt: '2026-05-24T00:30:00.000Z', visitCount: 3 },
      ],
      200,
    );

    expect(aggregated[0]).toEqual(
      expect.objectContaining({
        firstVisitedAt: '2026-05-24T00:00:00.000Z',
        lastVisitedAt: '2026-05-24T00:30:00.000Z',
        visitCount: 5,
      }),
    );
  });

  it('表示セルサイズが基本セルの整数倍でない場合は失敗させる', () => {
    const cell = coordinateToGridCell({ latitude: 35.681236, longitude: 139.767125 });

    expect(() => aggregateVisitedCells([cell], 250)).toThrow('displayCellSizeMeters must be a multiple');
  });

  it('同じ表示セルサイズの隣接セルを矩形結合せず別々に返す', () => {
    const cells = aggregateVisitedCells(
      [
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
      ],
      100,
    );

    expect(cells).toHaveLength(3);
    expect(cells.map((cell) => cell.cellId)).toEqual(['100:10:20', '100:11:20', '100:12:20']);
  });

  it('集約結果は入力順に依存しない安定順で返す', () => {
    const cells = aggregateVisitedCells(
      [
        { cellId: '100:12:21', cellSizeMeters: 100, x: 12, y: 21 },
        { cellId: '100:10:20', cellSizeMeters: 100, x: 10, y: 20 },
        { cellId: '100:11:20', cellSizeMeters: 100, x: 11, y: 20 },
      ],
      100,
    );

    expect(cells.map((cell) => cell.cellId)).toEqual(['100:10:20', '100:11:20', '100:12:21']);
  });
});
