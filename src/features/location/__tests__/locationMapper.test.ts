import { toLocationPoint } from '@/features/location/locationMapper';

/** テスト用の最小 LocationObject を生成する。 */
function makeLocationObject(
  overrides: Partial<{
    timestamp: number;
    latitude: number;
    longitude: number;
    altitude: number | null;
    speed: number | null;
    heading: number | null;
    accuracy: number | null;
    altitudeAccuracy: number | null;
  }> = {},
) {
  const base = {
    timestamp: new Date('2026-05-06T12:30:00.000Z').getTime(),
    latitude: 35.6895,
    longitude: 139.6917,
    altitude: 10.5,
    speed: 1.2,
    heading: 90.0,
    accuracy: 5.0,
    altitudeAccuracy: 3.0,
    ...overrides,
  };

  return {
    timestamp: base.timestamp,
    coords: {
      latitude: base.latitude,
      longitude: base.longitude,
      altitude: base.altitude,
      speed: base.speed,
      heading: base.heading,
      accuracy: base.accuracy,
      altitudeAccuracy: base.altitudeAccuracy,
    },
    mocked: false,
  };
}

describe('locationMapper GPS位置情報変換', () => {
  describe('toLocationPoint', () => {
    it('timestamp が ISO 8601 文字列に変換される', () => {
      const location = makeLocationObject({ timestamp: new Date('2026-05-06T12:30:00.000Z').getTime() });

      const result = toLocationPoint(location);

      expect(result.recordedAt).toBe('2026-05-06T12:30:00.000Z');
    });

    it('latitude / longitude がそのまま保持される', () => {
      const location = makeLocationObject({ latitude: 35.6895, longitude: 139.6917 });

      const result = toLocationPoint(location);

      expect(result.latitude).toBe(35.6895);
      expect(result.longitude).toBe(139.6917);
    });

    it('altitude / speed / heading / accuracy / altitudeAccuracy がそのまま保持される', () => {
      const location = makeLocationObject({
        altitude: 42.0,
        speed: 2.5,
        heading: 180.0,
        accuracy: 8.0,
        altitudeAccuracy: 4.5,
      });

      const result = toLocationPoint(location);

      expect(result.altitude).toBe(42.0);
      expect(result.speed).toBe(2.5);
      expect(result.heading).toBe(180.0);
      expect(result.accuracy).toBe(8.0);
      expect(result.altitudeAccuracy).toBe(4.5);
    });

    it('nullable フィールドに null が渡された場合は null が保持される', () => {
      const location = makeLocationObject({
        altitude: null,
        speed: null,
        heading: null,
        accuracy: null,
        altitudeAccuracy: null,
      });

      const result = toLocationPoint(location);

      expect(result.altitude).toBeNull();
      expect(result.speed).toBeNull();
      expect(result.heading).toBeNull();
      expect(result.accuracy).toBeNull();
      expect(result.altitudeAccuracy).toBeNull();
    });

    it('localDate が YYYY-MM-DD 形式の文字列として生成される', () => {
      // ローカルタイムゾーンに依存するため、生成結果が正規表現に一致することを検証する
      const location = makeLocationObject({ timestamp: new Date('2026-05-06T12:30:00.000Z').getTime() });

      const result = toLocationPoint(location);

      expect(result.localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('戻り値の型フィールドが揃っている（id フィールドを持たない）', () => {
      const location = makeLocationObject();

      const result = toLocationPoint(location);

      expect(Object.keys(result)).not.toContain('id');
      expect(Object.keys(result)).toEqual(
        expect.arrayContaining([
          'recordedAt',
          'localDate',
          'latitude',
          'longitude',
          'altitude',
          'speed',
          'heading',
          'accuracy',
          'altitudeAccuracy',
        ]),
      );
    });
  });
});
