import { getAreaNameFromAddress } from '../areaName';

describe('現在地地域名 getAreaNameFromAddress', () => {
  it('cityがあればcityを優先する', () => {
    expect(getAreaNameFromAddress({ city: '渋谷区', region: '東京都' } as never)).toBe('渋谷区');
  });

  it('cityがない場合はdistrictやregionへフォールバックする', () => {
    expect(getAreaNameFromAddress({ district: '中村区', region: '愛知県' } as never)).toBe('中村区');
    expect(getAreaNameFromAddress({ region: '北海道' } as never)).toBe('北海道');
  });

  it('住所情報が空の場合は現在地付近を返す', () => {
    expect(getAreaNameFromAddress(null)).toBe('現在地付近');
  });
});
