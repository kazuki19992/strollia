import * as Location from 'expo-location';

import { NewLocationPoint } from '@/types/gps';

import {
  normalizeAdminAreaName,
  recordVisitedAdminAreasForPoint,
  resetGeocodeThrottleForTest,
  toLocationPointAdminArea,
  toVisitedAdminAreas,
} from '@/features/achievements/adminAreaResolver';
import { upsertLocationPointAdminArea, upsertVisitedAdminArea } from '@/features/achievements/adminAreaRepository';

jest.mock('expo-location', () => ({
  reverseGeocodeAsync: jest.fn(),
}));

jest.mock('@/features/achievements/adminAreaRepository', () => ({
  upsertLocationPointAdminArea: jest.fn(),
  upsertVisitedAdminArea: jest.fn(),
}));

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

  it('GPSポイント単位の行政区域履歴へ変換する', () => {
    expect(toLocationPointAdminArea(point, { region: '東京都', city: '渋谷区' } as any, 123)).toEqual({
      locationPointId: 123,
      recordedAt: '2026-05-07T00:00:00.000Z',
      localDate: '2026-05-07',
      prefectureName: '東京都',
      municipalityName: '渋谷区',
      normalizedPrefectureName: '東京都',
      normalizedMunicipalityName: '東京都:渋谷区',
    });
  });

  it('行政区域名を重複判定用に正規化する', () => {
    expect(normalizeAdminAreaName(' 東京都 : 渋谷区 ')).toBe('東京都:渋谷区');
  });
});

describe('逆ジオコーディングのスロットリング recordVisitedAdminAreasForPoint', () => {
  /** Date.now を差し替えるための現在時刻(ミリ秒)。 */
  let nowMs: number;

  /** テスト用のGPSポイントを作る。 */
  function makePoint(overrides: Partial<NewLocationPoint> = {}): NewLocationPoint {
    return { ...point, ...overrides };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    resetGeocodeThrottleForTest();
    nowMs = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => nowMs);
    (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([{ region: '東京都', city: '千代田区' }]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetGeocodeThrottleForTest();
  });

  it('初回はAPIを呼び、行政区域を保存する', async () => {
    await recordVisitedAdminAreasForPoint(makePoint(), 1);

    expect(Location.reverseGeocodeAsync).toHaveBeenCalledTimes(1);
    expect(upsertVisitedAdminArea).toHaveBeenCalled();
    expect(upsertLocationPointAdminArea).toHaveBeenCalled();
  });

  it('直近の結果から300m以内のポイントはAPIを呼ばず結果を再利用する', async () => {
    await recordVisitedAdminAreasForPoint(makePoint(), 1);
    nowMs += 1_000;

    // 緯度0.001度 ≒ 111m。300m以内なので再利用される
    await recordVisitedAdminAreasForPoint(makePoint({ latitude: 35.001 }), 2);

    expect(Location.reverseGeocodeAsync).toHaveBeenCalledTimes(1);
    // 再利用時も行政区域の保存は行われる
    expect(upsertLocationPointAdminArea).toHaveBeenCalledTimes(2);
  });

  it('300mを超えて移動しても最短間隔(10秒)未満ならAPIを呼ばずスキップする', async () => {
    await recordVisitedAdminAreasForPoint(makePoint(), 1);
    nowMs += 5_000;

    // 緯度0.1度 ≒ 11km。ただし間隔が短いのでスキップ(誤った行政区域を記録しない)
    await recordVisitedAdminAreasForPoint(makePoint({ latitude: 35.1 }), 2);

    expect(Location.reverseGeocodeAsync).toHaveBeenCalledTimes(1);
    expect(upsertLocationPointAdminArea).toHaveBeenCalledTimes(1);
  });

  it('最短間隔を過ぎて300mを超えたポイントはAPIを再度呼ぶ', async () => {
    await recordVisitedAdminAreasForPoint(makePoint(), 1);
    nowMs += 11_000;

    await recordVisitedAdminAreasForPoint(makePoint({ latitude: 35.1 }), 2);

    expect(Location.reverseGeocodeAsync).toHaveBeenCalledTimes(2);
  });

  it('レート制限エラーを受けたら60秒間はAPIを呼ばず、エラーも伝播しない', async () => {
    (Location.reverseGeocodeAsync as jest.Mock).mockRejectedValueOnce(new Error('Geocoding rate limit exceeded - too many requests'));

    // レート制限エラーはthrowされず正常終了する
    await expect(recordVisitedAdminAreasForPoint(makePoint(), 1)).resolves.toBeUndefined();
    expect(upsertVisitedAdminArea).not.toHaveBeenCalled();

    // クールダウン中はAPIを呼ばない
    nowMs += 30_000;
    await recordVisitedAdminAreasForPoint(makePoint({ latitude: 35.1 }), 2);
    expect(Location.reverseGeocodeAsync).toHaveBeenCalledTimes(1);

    // クールダウンが明けたら再度呼ぶ
    nowMs += 31_000;
    await recordVisitedAdminAreasForPoint(makePoint({ latitude: 35.2 }), 3);
    expect(Location.reverseGeocodeAsync).toHaveBeenCalledTimes(2);
  });

  it('レート制限以外のエラーは呼び出し元へ伝播する', async () => {
    (Location.reverseGeocodeAsync as jest.Mock).mockRejectedValueOnce(new Error('network unavailable'));

    await expect(recordVisitedAdminAreasForPoint(makePoint(), 1)).rejects.toThrow('network unavailable');
  });

  it('エラーコードにスロットリング系の文言がある場合もレート制限として扱う', async () => {
    const codedError = Object.assign(new Error('request failed'), { code: 'ERR_LOCATION_GEOCODING_RATE_LIMIT' });
    (Location.reverseGeocodeAsync as jest.Mock).mockRejectedValueOnce(codedError);

    await expect(recordVisitedAdminAreasForPoint(makePoint(), 1)).resolves.toBeUndefined();

    // クールダウンに入っているため、直後の呼び出しではAPIを呼ばない
    nowMs += 15_000;
    await recordVisitedAdminAreasForPoint(makePoint({ latitude: 35.1 }), 2);
    expect(Location.reverseGeocodeAsync).toHaveBeenCalledTimes(1);
  });

  it('空結果が続いても最短間隔(10秒)を守り連続呼び出しにならない', async () => {
    (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([]);

    await recordVisitedAdminAreasForPoint(makePoint(), 1);
    nowMs += 5_000;
    await recordVisitedAdminAreasForPoint(makePoint({ latitude: 35.1 }), 2);

    // 空結果でも直近の呼び出しから10秒未満なら再呼び出ししない
    expect(Location.reverseGeocodeAsync).toHaveBeenCalledTimes(1);

    nowMs += 6_000;
    await recordVisitedAdminAreasForPoint(makePoint({ latitude: 35.2 }), 3);
    expect(Location.reverseGeocodeAsync).toHaveBeenCalledTimes(2);
  });
});
