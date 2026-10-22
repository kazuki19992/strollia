import { createAltitudeProfile, formatAltitudeProfileTime } from '@/features/reports/altitudeProfile';
import type { LocationPoint } from '@/types/gps';

/** 指定したローカル時刻と高度を持つテスト用GPSポイントを作る。 */
function point(id: number, hour: number, minute: number, altitude: number | null): LocationPoint {
  return {
    id,
    recordedAt: new Date(2026, 8, 21, hour, minute).toISOString(),
    localDate: '2026-09-21',
    latitude: 35,
    longitude: 139,
    altitude,
    speed: null,
    heading: null,
    accuracy: 5,
    altitudeAccuracy: null,
  };
}

describe('日別高度プロファイル', () => {
  test('有効な高度から時刻範囲と最低・最高高度を作る', () => {
    const profile = createAltitudeProfile(
      [point(1, 9, 0, 10), point(2, 10, 0, 10), point(3, 11, 0, 15), point(4, 12, 0, 20), point(5, 13, 0, 20)],
      100,
    );

    expect(profile).toMatchObject({
      minAltitudeMeters: 10,
      maxAltitudeMeters: 20,
      isFlat: false,
    });
    expect(formatAltitudeProfileTime(profile!.startTimestampMs)).toBe('9:00');
    expect(formatAltitudeProfileTime(profile!.middleTimestampMs)).toBe('11:00');
    expect(formatAltitudeProfileTime(profile!.endTimestampMs)).toBe('13:00');
  });

  test('有効高度が2点未満なら表示データを作らない', () => {
    expect(createAltitudeProfile([point(1, 9, 0, null), point(2, 10, 0, 10)], 100)).toBeNull();
  });

  test('非有限高度と無効日時を欠測として扱う', () => {
    const invalidDatePoint = { ...point(3, 11, 0, 20), recordedAt: 'invalid' };

    expect(createAltitudeProfile([point(1, 9, 0, 10), { ...point(2, 10, 0, 20), altitude: Number.NaN }, invalidDatePoint], 100)).toBeNull();
  });

  test('5点移動中央値で単発の高度ノイズを抑える', () => {
    const profile = createAltitudeProfile(
      [point(1, 9, 0, 10), point(2, 9, 1, 11), point(3, 9, 2, 200), point(4, 9, 3, 12), point(5, 9, 4, 13)],
      100,
    );

    expect(profile!.segments[0][2].altitudeMeters).toBe(12);
  });

  test('3点の短い連続区間にも移動中央値を適用する', () => {
    const altitudes = [10, 200, 12];
    const profile = createAltitudeProfile(
      altitudes.map((altitude, index) => point(index + 1, 9, index, altitude)),
      100,
    );

    expect(profile!.segments[0][1].altitudeMeters).toBe(12);
  });

  test('4点の短い連続区間にも移動中央値を適用する', () => {
    const altitudes = [10, 200, 12, 14];
    const profile = createAltitudeProfile(
      altitudes.map((altitude, index) => point(index + 1, 9, index, altitude)),
      100,
    );

    expect(profile!.segments[0][1].altitudeMeters).toBe(13);
  });

  test('欠測で線を分割し前後の実測点を残す', () => {
    const profile = createAltitudeProfile(
      [point(1, 9, 0, 10), point(2, 9, 1, 11), point(3, 9, 2, null), point(4, 9, 3, 20), point(5, 9, 4, 21)],
      100,
    );

    expect(profile!.segments).toHaveLength(2);
    expect(profile!.segments[0].at(-1)?.timestampMs).toBe(Date.parse('2026-09-21T09:01:00'));
    expect(profile!.segments[1][0].timestampMs).toBe(Date.parse('2026-09-21T09:03:00'));
  });

  test('表示点数を制限しても時刻バケット内の山を残す', () => {
    const points = Array.from({ length: 100 }, (_, index) => point(index + 1, 9, index, index >= 48 && index <= 52 ? 500 : index % 20));

    const profile = createAltitudeProfile(points, 20);
    const renderedPoints = profile!.segments.flat();

    expect(renderedPoints).toHaveLength(20);
    expect(renderedPoints.some((sample) => sample.altitudeMeters === 500)).toBe(true);
  });

  test('奇数の表示上限でも連続区間の先頭と末尾を残す', () => {
    const points = [10, 30, 5, 40, 20, 15].map((altitude, index) => point(index + 1, 9, index, altitude));

    const profile = createAltitudeProfile(points, 3);

    expect(profile!.segments[0]).toHaveLength(3);
    expect(profile!.segments[0][0].timestampMs).toBe(Date.parse(points[0].recordedAt));
    expect(profile!.segments[0].at(-1)?.timestampMs).toBe(Date.parse(points.at(-1)!.recordedAt));
  });

  test('短い欠測区間が多数あっても全区間の合計を表示上限以下にする', () => {
    const points = Array.from({ length: 12 }, (_, segmentIndex) => [
      point(segmentIndex * 3 + 1, 9, segmentIndex * 3, segmentIndex),
      point(segmentIndex * 3 + 2, 9, segmentIndex * 3 + 1, segmentIndex + 1),
      point(segmentIndex * 3 + 3, 9, segmentIndex * 3 + 2, null),
    ]).flat();

    const profile = createAltitudeProfile(points, 8);
    const renderedPoints = profile!.segments.flat();

    expect(renderedPoints.length).toBeLessThanOrEqual(8);
    expect(profile!.segments.every((segment) => segment.length === 2)).toBe(true);
    expect(renderedPoints[0].timestampMs).toBe(Date.parse(points[0].recordedAt));
    expect(renderedPoints.at(-1)?.timestampMs).toBe(Date.parse(points.at(-2)!.recordedAt));
  });
});
