import { toDisplaySpeedKmh } from '../useRawLocationSpeed';

describe('raw GPS speed表示 useRawLocationSpeed', () => {
  it('GPS speedのm/sをkm/hへ変換する', () => {
    expect(toDisplaySpeedKmh(1.5)).toBeCloseTo(5.4);
  });

  it('nullや負値や不正値は表示更新なしにする', () => {
    expect(toDisplaySpeedKmh(null)).toBeNull();
    expect(toDisplaySpeedKmh(-1)).toBeNull();
    expect(toDisplaySpeedKmh(Number.NaN)).toBeNull();
  });
});
