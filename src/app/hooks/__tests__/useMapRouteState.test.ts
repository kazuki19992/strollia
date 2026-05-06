import { DailyLogSummary, LocationPoint } from '../../../types/gps';
import { calculateDisplayDistance } from '../useMapRouteState';

function point(latitude: number, longitude: number): LocationPoint {
  return {
    id: 1,
    recordedAt: '2026-05-06T00:00:00.000Z',
    localDate: '2026-05-06',
    latitude,
    longitude,
    altitude: null,
    speed: null,
    heading: null,
    accuracy: null,
    altitudeAccuracy: null,
  };
}

function dailyLog(distanceMeters: number | null): DailyLogSummary {
  return {
    localDate: '2026-05-06',
    pointCount: 2,
    startedAt: null,
    endedAt: null,
    distanceMeters,
  };
}

describe('表示距離計算 calculateDisplayDistance', () => {
  it('全日付に累積距離がある場合は日別サマリーを合計する', () => {
    expect(calculateDisplayDistance([dailyLog(10), dailyLog(20)], [point(35, 139), point(36, 139)])).toBe(30);
  });

  it('累積距離がない日付を含む場合はGPSポイントから再計算する', () => {
    const distance = calculateDisplayDistance([dailyLog(null)], [point(35, 139), point(35.001, 139)]);

    expect(distance).toBeGreaterThan(100);
    expect(distance).toBeLessThan(120);
  });
});
