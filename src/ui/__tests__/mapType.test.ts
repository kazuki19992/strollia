import { getNextMapType } from '@/ui/mapType';

describe('地図種別切り替え getNextMapType', () => {
  it('標準地図からラベル付き航空写真へ切り替える', () => {
    expect(getNextMapType('standard')).toBe('hybrid');
  });

  it('航空写真側から標準地図へ戻す', () => {
    expect(getNextMapType('hybrid')).toBe('standard');
  });
});
