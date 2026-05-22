import { LocationPoint } from '../../../types/gps';
import { calculateReliableCurrentSpeedKmh } from '../useReliableCurrentSpeed';

/** 信頼済み速度テスト用の保存済みGPS点を作る。 */
function point(latitude: number, longitude: number, recordedAt: string): LocationPoint {
  return {
    id: 1,
    recordedAt,
    localDate: '2026-05-23',
    latitude,
    longitude,
    altitude: null,
    speed: null,
    heading: null,
    accuracy: null,
    altitudeAccuracy: null,
  };
}

describe('信頼済み点の現在速度 useReliableCurrentSpeed', () => {
  it('最後のaccepted区間速度をkm/hで返す', () => {
    const speed = calculateReliableCurrentSpeedKmh([
      point(35, 139, '2026-05-23T00:00:00.000Z'),
      point(35.001, 139, '2026-05-23T00:01:00.000Z'),
    ]);

    expect(speed).toBeGreaterThan(4);
    expect(speed).toBeLessThan(8);
  });

  it('点が足りない場合は停止表示にする', () => {
    expect(calculateReliableCurrentSpeedKmh([])).toBe(0);
  });
});
