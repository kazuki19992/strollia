import { cellToPolygonCoordinates, coordinateToGridCell, getGridBoundsForRegion } from '../gridCell';

describe('Visited Gridセル変換 gridCell', () => {
  it('同じ100mセル内の近い座標を同じcellIdにする', () => {
    const base = coordinateToGridCell({ latitude: 35.681236, longitude: 139.767125 });
    const nearby = coordinateToGridCell({ latitude: 35.681237, longitude: 139.767126 });

    expect(base.cellSizeMeters).toBe(100);
    expect(nearby.cellId).toBe(base.cellId);
  });

  it('セルからMapView Polygon用の4頂点を作る', () => {
    const cell = coordinateToGridCell({ latitude: 35.681236, longitude: 139.767125 });
    const polygon = cellToPolygonCoordinates(cell);

    expect(polygon).toHaveLength(4);
    expect(polygon.every((coordinate) => Number.isFinite(coordinate.latitude))).toBe(true);
    expect(polygon.every((coordinate) => Number.isFinite(coordinate.longitude))).toBe(true);
  });

  it('通常の表示範囲を含むセル番号範囲を返す', () => {
    const region = { latitude: 35.681236, longitude: 139.767125, latitudeDelta: 0.02, longitudeDelta: 0.02 };
    const northWest = coordinateToGridCell({ latitude: 35.691236, longitude: 139.757125 });
    const southEast = coordinateToGridCell({ latitude: 35.671236, longitude: 139.777125 });

    const bounds = getGridBoundsForRegion(region);

    expect(bounds.minX).toBeLessThanOrEqual(northWest.x);
    expect(bounds.maxX).toBeGreaterThanOrEqual(southEast.x);
    expect(bounds.minY).toBeLessThanOrEqual(southEast.y);
    expect(bounds.maxY).toBeGreaterThanOrEqual(northWest.y);
  });

  it('日付変更線を跨ぐ表示範囲では両側のセルを含む', () => {
    const bounds = getGridBoundsForRegion({ latitude: 0, longitude: 179, latitudeDelta: 1, longitudeDelta: 4 });
    const eastSide = coordinateToGridCell({ latitude: 0, longitude: 179.5 });
    const westSide = coordinateToGridCell({ latitude: 0, longitude: -179.5 });

    expect(bounds.minX).toBeLessThanOrEqual(westSide.x);
    expect(bounds.maxX).toBeGreaterThanOrEqual(eastSide.x);
    expect(Number.isFinite(bounds.minY)).toBe(true);
    expect(Number.isFinite(bounds.maxY)).toBe(true);
  });
});
