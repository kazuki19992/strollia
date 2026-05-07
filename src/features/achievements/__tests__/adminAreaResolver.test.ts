import { NewLocationPoint } from '../../../types/gps';

jest.mock('../adminAreaRepository', () => ({
  upsertVisitedAdminArea: jest.fn(),
}));

import { normalizeAdminAreaName, toVisitedAdminAreas } from '../adminAreaResolver';

const point: NewLocationPoint = {
  recordedAt: '2026-05-07T00:00:00.000Z',
  localDate: '2026-05-07',
  latitude: 35,
  longitude: 139,
  altitude: null,
  speed: null,
  heading: null,
  accuracy: 10,
  altitudeAccuracy: null,
};

describe('行政区域解決 adminAreaResolver', () => {
  it('都道府県と市区町村の訪問エリアへ変換する', () => {
    expect(
      toVisitedAdminAreas(point, {
        region: '東京都',
        city: '渋谷区',
      } as any),
    ).toEqual([
      expect.objectContaining({ areaType: 'prefecture', prefectureName: '東京都', municipalityName: null }),
      expect.objectContaining({ areaType: 'municipality', prefectureName: '東京都', municipalityName: '渋谷区' }),
    ]);
  });

  it('都道府県がない場合は訪問エリアを作らない', () => {
    expect(toVisitedAdminAreas(point, { city: '渋谷区' } as any)).toEqual([]);
  });

  it('行政区域名を重複判定用に正規化する', () => {
    expect(normalizeAdminAreaName(' 東京都 : 渋谷区 ')).toBe('東京都:渋谷区');
  });
});
