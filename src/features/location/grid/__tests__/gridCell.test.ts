import { cellToPolygonCoordinates, coordinateToGridCell } from '../gridCell';

describe('Visited Gridセル変換 gridCell', () => {
  it('同じ50mセル内の近い座標を同じcellIdにする', () => {
    const base = coordinateToGridCell({ latitude: 35.681236, longitude: 139.767125 });
    const nearby = coordinateToGridCell({ latitude: 35.681237, longitude: 139.767126 });

    expect(base.cellSizeMeters).toBe(50);
    expect(nearby.cellId).toBe(base.cellId);
  });

  it('セルからMapView Polygon用の4頂点を作る', () => {
    const cell = coordinateToGridCell({ latitude: 35.681236, longitude: 139.767125 });
    const polygon = cellToPolygonCoordinates(cell);

    expect(polygon).toHaveLength(4);
    expect(polygon.every((coordinate) => Number.isFinite(coordinate.latitude))).toBe(true);
    expect(polygon.every((coordinate) => Number.isFinite(coordinate.longitude))).toBe(true);
  });
});
