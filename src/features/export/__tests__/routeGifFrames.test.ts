import { computeGifFrameMinutes } from '../routeGifFrames';
import type { LocationPoint } from '../../../types/gps';

function pointAt(minuteOfDay: number, id: number): LocationPoint {
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  return {
    id,
    recordedAt: new Date(2026, 4, 31, hours, minutes).toISOString(),
    localDate: '2026-05-31',
    latitude: 35,
    longitude: 139,
    altitude: null,
    speed: null,
    heading: null,
    accuracy: null,
    altitudeAccuracy: null,
  };
}

describe('computeGifFrameMinutes', () => {
  it('最初〜最後を10分刻みにし最後を必ず含める', () => {
    const points = [pointAt(0, 1), pointAt(30, 2), pointAt(60, 3)];
    expect(computeGifFrameMinutes(points, 10)).toEqual([0, 10, 20, 30, 40, 50, 60]);
  });

  it('10分未満の記録は最初と最後の2コマ', () => {
    const points = [pointAt(0, 1), pointAt(5, 2)];
    expect(computeGifFrameMinutes(points, 10)).toEqual([0, 5]);
  });

  it('同一分に収まる記録は1コマ', () => {
    const points = [pointAt(10, 1), pointAt(10, 2)];
    expect(computeGifFrameMinutes(points, 10)).toEqual([10]);
  });

  it('点が1つ以下なら空配列', () => {
    expect(computeGifFrameMinutes([pointAt(0, 1)], 10)).toEqual([]);
    expect(computeGifFrameMinutes([], 10)).toEqual([]);
  });
});
