import { GRID_OVERLAY_CONFIG } from '../../../map/config/gridOverlayConfig';
import { aggregateVisitedCells, getDisplayCellSizeMeters } from '../gridAggregation';
import { coordinateToGridCell } from '../gridCell';

describe('Visited Grid表示集約 gridAggregation', () => {
  it('ズームに応じて表示セルサイズを選ぶ', () => {
    expect(getDisplayCellSizeMeters({ latitudeDelta: 0.005 }, GRID_OVERLAY_CONFIG)).toBe(50);
    expect(getDisplayCellSizeMeters({ latitudeDelta: 0.08 }, GRID_OVERLAY_CONFIG)).toBe(200);
    expect(getDisplayCellSizeMeters({ latitudeDelta: 0.5 }, GRID_OVERLAY_CONFIG)).toBe(1000);
  });

  it('visitedな50mセルが1つでもあれば大セルをvisitedにする', () => {
    const cell = coordinateToGridCell({ latitude: 35.681236, longitude: 139.767125 });
    const aggregated = aggregateVisitedCells([cell], 200);

    expect(aggregated).toHaveLength(1);
    expect(aggregated[0].cellSizeMeters).toBe(200);
    expect(aggregated[0].cellId.startsWith('200:')).toBe(true);
  });
});
