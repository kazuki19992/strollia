import { getAreaLabelFromAddress, getAreaNameFromAddress } from '@/ui/areaName';

describe('現在地地域名 getAreaNameFromAddress', () => {
  it('cityがあればcityを優先する', () => {
    expect(getAreaNameFromAddress({ city: '渋谷区', region: '東京都' } as never)).toBe('渋谷区');
  });

  it('cityがない場合はdistrictやregionへフォールバックする', () => {
    expect(getAreaNameFromAddress({ district: '中村区', region: '愛知県' } as never)).toBe('中村区');
    expect(getAreaNameFromAddress({ region: '北海道' } as never)).toBe('北海道');
  });

  it('住所情報が空の場合はnullを返す', () => {
    expect(getAreaNameFromAddress(null)).toBeNull();
  });
});

describe('現在地パネル地域名 getAreaLabelFromAddress', () => {
  it('市区町村名と町名を分けて返す', () => {
    expect(getAreaLabelFromAddress({ city: '千代田区', district: '神田' } as never)).toEqual({
      primary: '千代田区',
      secondary: '神田',
    });
  });

  it('副表示が主表示と同じ場合は表示しない', () => {
    expect(getAreaLabelFromAddress({ city: '船橋市', district: '船橋市' } as never)).toEqual({
      primary: '船橋市',
      secondary: null,
    });
  });

  it('住所情報がない場合はnullを返す', () => {
    expect(getAreaLabelFromAddress(null)).toBeNull();
    expect(getAreaLabelFromAddress(undefined)).toBeNull();
  });

  it('districtがない場合はnameから副表示を選ぶ', () => {
    expect(getAreaLabelFromAddress({ city: '千代田区', name: '神田錦町' } as never)).toEqual({
      primary: '千代田区',
      secondary: '神田錦町',
    });
  });

  it('districtとnameがない場合はstreetから副表示を選ぶ', () => {
    expect(getAreaLabelFromAddress({ city: '千代田区', street: '一ツ橋' } as never)).toEqual({
      primary: '千代田区',
      secondary: '一ツ橋',
    });
  });

  it('districtとnameとstreetがない場合はsubregionから副表示を選ぶ', () => {
    expect(getAreaLabelFromAddress({ city: '千代田区', subregion: '東京都心' } as never)).toEqual({
      primary: '千代田区',
      secondary: '東京都心',
    });
  });
});
