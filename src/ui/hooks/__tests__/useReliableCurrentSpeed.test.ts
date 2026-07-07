import { LocationPoint } from '@/types/gps';
import { calculateReliableCurrentSpeedKmh } from '@/ui/hooks/useReliableCurrentSpeed';

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

describe('保存済み点の現在速度 useReliableCurrentSpeed', () => {
  it('最後の保存区間速度をkm/hで返す', () => {
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

  it('点が1件だけの場合も停止表示にする', () => {
    expect(calculateReliableCurrentSpeedKmh([point(35, 139, '2026-05-23T00:00:00.000Z')])).toBe(0);
  });

  it('停止中の狭い範囲のドリフトは停止表示にする', () => {
    const speed = calculateReliableCurrentSpeedKmh([
      point(35, 139, '2026-05-23T00:00:00.000Z'),
      point(35.00005, 139, '2026-05-23T00:00:10.000Z'),
      point(35, 139, '2026-05-23T00:00:20.000Z'),
      point(35.0001, 139, '2026-05-23T00:00:30.000Z'),
    ]);

    expect(speed).toBe(0);
  });

  it('狭い範囲に留まらない低速移動は速度表示に残す', () => {
    const speed = calculateReliableCurrentSpeedKmh([
      point(35, 139, '2026-05-23T00:00:00.000Z'),
      point(35.0001, 139, '2026-05-23T00:00:10.000Z'),
      point(35.0002, 139, '2026-05-23T00:00:20.000Z'),
      point(35.0003, 139, '2026-05-23T00:00:30.000Z'),
    ]);

    expect(speed).toBeGreaterThan(3);
  });
});
