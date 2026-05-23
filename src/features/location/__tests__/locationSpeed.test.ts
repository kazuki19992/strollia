import { NewLocationPoint } from '../../../types/gps';
import { classifyMovementSpeed, estimateAcceptedSegmentSpeedMps } from '../locationSpeed';

/** 速度計算テスト用のGPSポイントを作る。 */
function point(latitude: number, longitude: number, recordedAt: string): NewLocationPoint {
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
  };
}

describe('GPS移動速度 locationSpeed', () => {
  it('30km/hと150km/hの境界で低速・車両・高速を分類する', () => {
    expect(classifyMovementSpeed(29.9)).toBe('low-speed');
    expect(classifyMovementSpeed(30)).toBe('vehicle');
    expect(classifyMovementSpeed(149.9)).toBe('vehicle');
    expect(classifyMovementSpeed(150)).toBe('fast');
  });

  it('保存済み点の距離と時刻差から区間速度を計算する', () => {
    const previous = point(35, 139, '2026-05-23T00:00:00.000Z');
    const next = point(35.001, 139, '2026-05-23T00:01:00.000Z');

    expect(estimateAcceptedSegmentSpeedMps(previous, next)).toBeGreaterThan(1);
    expect(estimateAcceptedSegmentSpeedMps(previous, next)).toBeLessThan(2);
  });

  it('時刻差が不正な場合は区間速度を0にする', () => {
    const previous = point(35, 139, '2026-05-23T00:00:00.000Z');
    const sameTime = point(35.001, 139, '2026-05-23T00:00:00.000Z');
    const earlier = point(35.001, 139, '2026-05-22T23:59:59.000Z');
    const invalid = point(35.001, 139, 'invalid-date');

    expect(estimateAcceptedSegmentSpeedMps(previous, sameTime)).toBe(0);
    expect(estimateAcceptedSegmentSpeedMps(previous, earlier)).toBe(0);
    expect(estimateAcceptedSegmentSpeedMps(previous, invalid)).toBe(0);
  });
});
