import { NewLocationPoint } from '../../../types/gps';
import { classifyMovement, estimateSpeedMps, shouldSaveLocationPoint } from '../locationSaveFilter';

function point(
  latitude: number,
  longitude: number,
  accuracy: number | null = 10,
  overrides: Partial<NewLocationPoint> = {},
): NewLocationPoint {
  return {
    recordedAt: '2026-05-05T00:00:10.000Z',
    localDate: '2026-05-05',
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

  it('最初のポイントでも標準精度を超える場合は破棄する', () => {
    expect(shouldSaveLocationPoint(point(35, 139, 51), null)).toBe(false);
  });

  it('停止中のGPS揺れは破棄する', () => {
    const previous = point(35, 139, 10, { recordedAt: '2026-05-05T00:00:00.000Z' });
    const next = point(35.0001, 139, 10, { speed: 0.1 });

    expect(shouldSaveLocationPoint(next, previous)).toBe(false);
  });

  it('徒歩中は精度円に対して小さすぎる移動を破棄する', () => {
    const previous = point(35, 139, 10, { recordedAt: '2026-05-05T00:00:00.000Z' });
    const next = point(35.0002, 139, 30, { speed: 1.2 });

    expect(shouldSaveLocationPoint(next, previous)).toBe(false);
  });

  it('徒歩中に十分な精度と距離があるポイントは保存対象にする', () => {
    const previous = point(35, 139, 10, { recordedAt: '2026-05-05T00:00:00.000Z' });
    const next = point(35.0003, 139, 20, { speed: 1.2 });

    expect(shouldSaveLocationPoint(next, previous)).toBe(true);
  });

  it('車両移動中は多少精度が悪くても十分な移動があれば保存対象にする', () => {
    const previous = point(35, 139, 10, { recordedAt: '2026-05-05T00:00:00.000Z' });
    const next = point(35.0005, 139, 45, { speed: 8 });

    expect(shouldSaveLocationPoint(next, previous)).toBe(true);
  });

  it('高速移動中は80m以内の精度で大きく移動していれば保存対象にする', () => {
    const previous = point(35, 139, 10, { recordedAt: '2026-05-05T00:00:00.000Z' });
    const next = point(35.001, 139, 75, { speed: 20 });

    expect(shouldSaveLocationPoint(next, previous)).toBe(true);
  });
});

describe('GPS速度推定 estimateSpeedMps', () => {
  it('GPS速度が取得できている場合はその値を優先する', () => {
    const previous = point(35, 139, 10, { recordedAt: '2026-05-05T00:00:00.000Z' });
    const next = point(35.001, 139, 10, { speed: 3 });

    expect(estimateSpeedMps(next, previous)).toBe(3);
  });

  it('GPS速度がない場合は距離と時刻差から推定する', () => {
    const previous = point(35, 139, 10, { recordedAt: '2026-05-05T00:00:00.000Z' });
    const next = point(35.001, 139, 10, { recordedAt: '2026-05-05T00:01:00.000Z' });

    expect(estimateSpeedMps(next, previous)).toBeGreaterThan(1);
    expect(estimateSpeedMps(next, previous)).toBeLessThan(2);
  });
});

describe('移動モード分類 classifyMovement', () => {
  it('速度から停止・徒歩・車両・高速を分類する', () => {
    expect(classifyMovement(0.1)).toBe('stationary');
    expect(classifyMovement(1.2)).toBe('walk');
    expect(classifyMovement(8)).toBe('vehicle');
    expect(classifyMovement(20)).toBe('fast');
  });
});
