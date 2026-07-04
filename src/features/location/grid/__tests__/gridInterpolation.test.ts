import { NewLocationPoint } from '@/types/gps';
import { getVisitedCellsForLocationPoint } from '@/features/location/grid/gridInterpolation';

function point(latitude: number, longitude: number, recordedAt: string, options: Partial<NewLocationPoint> = {}): NewLocationPoint {
  return {
    recordedAt,
    localDate: '2026-05-23',
    latitude,
    longitude,
    altitude: null,
    speed: null,
    heading: null,
    accuracy: 10,
    altitudeAccuracy: null,
    ...options,
  };
}

describe('Visited Grid高速補間 gridInterpolation', () => {
  it('低速移動では現在点のセルだけを返す', () => {
    const previous = point(35, 139, '2026-05-23T00:00:00.000Z');
    const next = point(35.0001, 139, '2026-05-23T00:00:30.000Z');

    const cells = getVisitedCellsForLocationPoint(previous, next);

    expect(cells).toHaveLength(1);
  });

  it('150km/h以上の高速移動では点間セルを補間する', () => {
    const previous = point(35, 139, '2026-05-23T00:00:00.000Z');
    const next = point(35.05, 139, '2026-05-23T00:01:00.000Z');

    const cells = getVisitedCellsForLocationPoint(previous, next);

    expect(cells.length).toBeGreaterThan(2);
    expect(new Set(cells.map((cell) => cell.cellId)).size).toBe(cells.length);
  });

  it('距離が大きくても速度条件を満たさない場合は補間しない', () => {
    const previous = point(35, 139, '2026-05-23T00:00:00.000Z');
    const next = point(35.05, 139, '2026-05-23T01:00:00.000Z');

    expect(getVisitedCellsForLocationPoint(previous, next)).toHaveLength(1);
  });

  it('accuracyが悪い点はセル開放しない', () => {
    const next = point(35, 139, '2026-05-23T00:00:00.000Z', { accuracy: 200 });

    expect(getVisitedCellsForLocationPoint(null, next)).toEqual([]);
  });

  it('accuracyが100の場合はセルを開放する', () => {
    const next = point(35, 139, '2026-05-23T00:00:00.000Z', { accuracy: 100 });

    expect(getVisitedCellsForLocationPoint(null, next)).toHaveLength(1);
  });

  it('accuracyが100.1の場合はセルを開放しない', () => {
    const next = point(35, 139, '2026-05-23T00:00:00.000Z', { accuracy: 100.1 });

    expect(getVisitedCellsForLocationPoint(null, next)).toEqual([]);
  });
});
