import { NewLocationPoint } from '@/types/gps';
import { estimateSaveSegmentSpeedMps, shouldSaveLocationPoint } from '@/features/location/locationSaveFilter';

/** GPS保存判定テスト用のポイントを作る。 */
function point(
  latitude: number,
  longitude: number,
  accuracy: number | null = 10,
  overrides: Partial<NewLocationPoint> = {},
): NewLocationPoint {
  return {
    recordedAt: '2026-05-24T00:00:10.000Z',
    localDate: '2026-05-24',
    latitude,
    longitude,
    altitude: null,
    speed: null,
    heading: null,
    accuracy,
    altitudeAccuracy: null,
    ...overrides,
  };
}

describe('GPSポイント保存判定 shouldSaveLocationPoint', () => {
  it('水平方向の精度が絶対上限を超えるポイントは破棄する', () => {
    expect(shouldSaveLocationPoint(point(35, 139, 81), null)).toBe(false);
  });

  it('精度が十分な最初のポイントは保存対象にする', () => {
    expect(shouldSaveLocationPoint(point(35, 139, 50), null)).toBe(true);
  });

  it('5m未満の細かな揺れは保存しない', () => {
    const previous = point(35, 139, 10, { recordedAt: '2026-05-24T00:00:00.000Z' });
    const next = point(35.00002, 139, 10);

    expect(shouldSaveLocationPoint(next, previous)).toBe(false);
  });

  it('徒歩の実移動は点列の確定を待たずに保存対象にする', () => {
    const previous = point(35, 139, 10, { recordedAt: '2026-05-24T00:00:00.000Z' });
    const next = point(35.0001, 139, 15, { recordedAt: '2026-05-24T00:00:12.000Z' });

    expect(shouldSaveLocationPoint(next, previous)).toBe(true);
  });

  it('鉄道相当の速度でも150km/h未満なら車両モードとして保存対象にする', () => {
    const previous = point(35, 139, 20, { recordedAt: '2026-05-24T00:00:00.000Z' });
    const next = point(35.002, 139, 40, { recordedAt: '2026-05-24T00:00:10.000Z' });

    expect(shouldSaveLocationPoint(next, previous)).toBe(true);
  });

  it('150km/h以上の高速移動は精度上限内なら保存対象にする', () => {
    const previous = point(35, 139, 20, { recordedAt: '2026-05-24T00:00:00.000Z' });
    const next = point(35.005, 139, 75, { recordedAt: '2026-05-24T00:00:10.000Z' });

    expect(shouldSaveLocationPoint(next, previous)).toBe(true);
  });

  it('候補点のraw speedではなく点間距離と時刻差から保存判定用速度を計算する', () => {
    const previous = point(35, 139, 10, { recordedAt: '2026-05-24T00:00:00.000Z' });
    const next = point(35.001, 139, 10, {
      recordedAt: '2026-05-24T00:01:00.000Z',
      speed: 50,
    });

    expect(estimateSaveSegmentSpeedMps(next, previous)).toBeGreaterThan(1);
    expect(estimateSaveSegmentSpeedMps(next, previous)).toBeLessThan(2);
  });
});
