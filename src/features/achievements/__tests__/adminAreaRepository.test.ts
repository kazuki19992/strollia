import { db } from '@/db/database';
import {
  getLocationPointAdminAreaName,
  getLocationPointAdminAreaNames,
  upsertLocationPointAdminArea,
  upsertVisitedAdminArea,
} from '@/features/achievements/adminAreaRepository';

type VisitedAdminAreaRow = {
  area_type: string;
  area_code: string | null;
  prefecture_name: string;
  municipality_name: string | null;
  normalized_name: string;
  first_visited_at: string;
  last_visited_at: string;
  first_location_point_id: number | null;
  created_at: string;
  updated_at: string;
};

type LocationPointAdminAreaRow = {
  location_point_id: number;
  recorded_at: string;
  local_date: string;
  prefecture_name: string;
  municipality_name: string | null;
  normalized_prefecture_name: string;
  normalized_municipality_name: string | null;
  created_at: string;
};

const mockVisitedAdminAreas = new Map<string, VisitedAdminAreaRow>();
const mockLocationPointAdminAreas = new Map<number, LocationPointAdminAreaRow>();

jest.mock('@/db/database', () => ({
  db: {
    runAsync: jest.fn(async (sql: string, ...params: (string | number | null)[]) => {
      if (sql.includes('location_point_admin_areas')) {
        const [
          locationPointId,
          recordedAt,
          localDate,
          prefectureName,
          municipalityName,
          normalizedPrefectureName,
          normalizedMunicipalityName,
          createdAt,
        ] = params as [number, string, string, string, string | null, string, string | null, string];
        mockLocationPointAdminAreas.set(locationPointId, {
          location_point_id: locationPointId,
          recorded_at: recordedAt,
          local_date: localDate,
          prefecture_name: prefectureName,
          municipality_name: municipalityName,
          normalized_prefecture_name: normalizedPrefectureName,
          normalized_municipality_name: normalizedMunicipalityName,
          created_at: createdAt,
        });
        return;
      }

      const [
        areaType,
        areaCode,
        prefectureName,
        municipalityName,
        normalizedName,
        firstVisitedAt,
        lastVisitedAt,
        firstLocationPointId,
        createdAt,
        updatedAt,
      ] = params as [string, string | null, string, string | null, string, string, string, number | null, string, string];
      const key = `${areaType}:${normalizedName}`;
      const current = mockVisitedAdminAreas.get(key);

      if (!current) {
        mockVisitedAdminAreas.set(key, {
          area_type: areaType,
          area_code: areaCode,
          prefecture_name: prefectureName,
          municipality_name: municipalityName,
          normalized_name: normalizedName,
          first_visited_at: firstVisitedAt,
          last_visited_at: lastVisitedAt,
          first_location_point_id: firstLocationPointId,
          created_at: createdAt,
          updated_at: updatedAt,
        });
        return;
      }

      mockVisitedAdminAreas.set(key, {
        ...current,
        last_visited_at: lastVisitedAt > current.last_visited_at ? lastVisitedAt : current.last_visited_at,
        updated_at: updatedAt,
      });
    }),
    getFirstAsync: jest.fn(async (sql: string, ...params: (string | number)[]) => {
      if (sql.includes('location_point_admin_areas')) {
        const row = mockLocationPointAdminAreas.get(params[0] as number) ?? null;
        if (row && sql.includes('locationPointId')) {
          return {
            locationPointId: row.location_point_id,
            prefectureName: row.prefecture_name,
            municipalityName: row.municipality_name,
          };
        }
        return row;
      }

      return mockVisitedAdminAreas.get(`${params[0]}:${params[1]}`) ?? null;
    }),
    getAllAsync: jest.fn(async (_sql: string, ...params: number[]) =>
      params.flatMap((locationPointId) => {
        const row = mockLocationPointAdminAreas.get(locationPointId);
        return row
          ? [
              {
                locationPointId: row.location_point_id,
                prefectureName: row.prefecture_name,
                municipalityName: row.municipality_name,
              },
            ]
          : [];
      }),
    ),
  },
}));

/** 訪問行政区域のテスト用DB行を取得する。 */
async function findVisitedAdminArea(areaType: string, normalizedName: string): Promise<VisitedAdminAreaRow | null> {
  return db.getFirstAsync<VisitedAdminAreaRow>(
    'SELECT * FROM visited_admin_areas WHERE area_type = ? AND normalized_name = ?',
    areaType,
    normalizedName,
  );
}

/** GPSポイント単位の行政区域履歴テスト用DB行を取得する。 */
async function findLocationPointAdminArea(locationPointId: number): Promise<LocationPointAdminAreaRow | null> {
  return db.getFirstAsync<LocationPointAdminAreaRow>(
    'SELECT * FROM location_point_admin_areas WHERE location_point_id = ?',
    locationPointId,
  );
}

describe('訪問行政区域リポジトリ upsertVisitedAdminArea', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockVisitedAdminAreas.clear();
    mockLocationPointAdminAreas.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('新しい訪問行政区域の行を正しいフィールドで作成する', async () => {
    jest.setSystemTime(new Date('2026-05-08T00:01:00.000Z'));

    await upsertVisitedAdminArea({
      areaType: 'municipality',
      areaCode: '13113',
      prefectureName: '東京都',
      municipalityName: '渋谷区',
      normalizedName: '東京都:渋谷区',
      visitedAt: '2026-05-08T00:00:00.000Z',
      firstLocationPointId: 123,
    });

    const row = await findVisitedAdminArea('municipality', '東京都:渋谷区');

    expect(row).toMatchObject({
      area_type: 'municipality',
      area_code: '13113',
      prefecture_name: '東京都',
      municipality_name: '渋谷区',
      normalized_name: '東京都:渋谷区',
      first_visited_at: '2026-05-08T00:00:00.000Z',
      last_visited_at: '2026-05-08T00:00:00.000Z',
      first_location_point_id: 123,
    });
    expect(row?.created_at).toEqual(expect.any(String));
    expect(row?.updated_at).toEqual(expect.any(String));
  });

  it('同じ行政区域の再訪問では新しい日時の場合だけ最終訪問日時を更新する', async () => {
    jest.setSystemTime(new Date('2026-05-08T00:01:00.000Z'));
    await upsertVisitedAdminArea({
      areaType: 'prefecture',
      areaCode: null,
      prefectureName: '東京都',
      municipalityName: null,
      normalizedName: '東京都',
      visitedAt: '2026-05-08T00:00:00.000Z',
      firstLocationPointId: 123,
    });
    const inserted = await findVisitedAdminArea('prefecture', '東京都');

    jest.setSystemTime(new Date('2026-05-08T00:02:00.000Z'));
    await upsertVisitedAdminArea({
      areaType: 'prefecture',
      areaCode: null,
      prefectureName: '東京都',
      municipalityName: null,
      normalizedName: '東京都',
      visitedAt: '2026-05-07T00:00:00.000Z',
      firstLocationPointId: 456,
    });
    const olderVisit = await findVisitedAdminArea('prefecture', '東京都');

    jest.setSystemTime(new Date('2026-05-08T00:03:00.000Z'));
    await upsertVisitedAdminArea({
      areaType: 'prefecture',
      areaCode: null,
      prefectureName: '東京都',
      municipalityName: null,
      normalizedName: '東京都',
      visitedAt: '2026-05-09T00:00:00.000Z',
      firstLocationPointId: 789,
    });
    const newerVisit = await findVisitedAdminArea('prefecture', '東京都');

    expect(olderVisit?.first_visited_at).toBe('2026-05-08T00:00:00.000Z');
    expect(olderVisit?.last_visited_at).toBe('2026-05-08T00:00:00.000Z');
    expect(olderVisit?.first_location_point_id).toBe(123);
    expect(olderVisit?.updated_at).not.toBe(inserted?.updated_at);
    expect(newerVisit?.last_visited_at).toBe('2026-05-09T00:00:00.000Z');
    expect(newerVisit?.updated_at).not.toBe(olderVisit?.updated_at);
  });

  it('位置情報ポイントIDがない場合はnullを保存する', async () => {
    jest.setSystemTime(new Date('2026-05-08T00:01:00.000Z'));

    await upsertVisitedAdminArea({
      areaType: 'prefecture',
      areaCode: null,
      prefectureName: '東京都',
      municipalityName: null,
      normalizedName: '東京都',
      visitedAt: '2026-05-08T00:00:00.000Z',
    });

    const row = await findVisitedAdminArea('prefecture', '東京都');

    expect(row?.first_location_point_id).toBeNull();
  });
});

describe('GPSポイント行政区域履歴 upsertLocationPointAdminArea', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockVisitedAdminAreas.clear();
    mockLocationPointAdminAreas.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('GPSポイントごとの都道府県と市区町村を保存する', async () => {
    jest.setSystemTime(new Date('2026-05-08T00:01:00.000Z'));

    await upsertLocationPointAdminArea({
      locationPointId: 123,
      recordedAt: '2026-05-08T00:00:00.000Z',
      localDate: '2026-05-08',
      prefectureName: '東京都',
      municipalityName: '渋谷区',
      normalizedPrefectureName: '東京都',
      normalizedMunicipalityName: '東京都:渋谷区',
    });

    await expect(findLocationPointAdminArea(123)).resolves.toMatchObject({
      location_point_id: 123,
      recorded_at: '2026-05-08T00:00:00.000Z',
      local_date: '2026-05-08',
      prefecture_name: '東京都',
      municipality_name: '渋谷区',
      normalized_prefecture_name: '東京都',
      normalized_municipality_name: '東京都:渋谷区',
      created_at: expect.any(String),
    });
  });

  it('市区町村が取得できない場合はnullで保存する', async () => {
    await upsertLocationPointAdminArea({
      locationPointId: 456,
      recordedAt: '2026-05-08T00:00:00.000Z',
      localDate: '2026-05-08',
      prefectureName: '東京都',
      municipalityName: null,
      normalizedPrefectureName: '東京都',
      normalizedMunicipalityName: null,
    });

    const row = await findLocationPointAdminArea(456);

    expect(row?.municipality_name).toBeNull();
    expect(row?.normalized_municipality_name).toBeNull();
  });

  it('GPSポイントに紐づく表示用エリア名を取得する', async () => {
    await upsertLocationPointAdminArea({
      locationPointId: 789,
      recordedAt: '2026-05-08T00:00:00.000Z',
      localDate: '2026-05-08',
      prefectureName: '千葉県',
      municipalityName: '船橋市',
      normalizedPrefectureName: '千葉県',
      normalizedMunicipalityName: '千葉県:船橋市',
    });

    await expect(getLocationPointAdminAreaName(789)).resolves.toEqual({
      locationPointId: 789,
      areaName: '船橋市',
    });
  });

  it('市区町村がない場合は都道府県名を表示用エリア名にする', async () => {
    await upsertLocationPointAdminArea({
      locationPointId: 987,
      recordedAt: '2026-05-08T00:00:00.000Z',
      localDate: '2026-05-08',
      prefectureName: '千葉県',
      municipalityName: null,
      normalizedPrefectureName: '千葉県',
      normalizedMunicipalityName: null,
    });

    await expect(getLocationPointAdminAreaName(987)).resolves.toEqual({
      locationPointId: 987,
      areaName: '千葉県',
    });
  });

  it('複数GPSポイントに紐づく表示用エリア名をまとめて取得する', async () => {
    await upsertLocationPointAdminArea({
      locationPointId: 111,
      recordedAt: '2026-05-08T00:00:00.000Z',
      localDate: '2026-05-08',
      prefectureName: '千葉県',
      municipalityName: '船橋市',
      normalizedPrefectureName: '千葉県',
      normalizedMunicipalityName: '千葉県:船橋市',
    });
    await upsertLocationPointAdminArea({
      locationPointId: 222,
      recordedAt: '2026-05-08T01:00:00.000Z',
      localDate: '2026-05-08',
      prefectureName: '東京都',
      municipalityName: '千代田区',
      normalizedPrefectureName: '東京都',
      normalizedMunicipalityName: '東京都:千代田区',
    });

    await expect(getLocationPointAdminAreaNames([111, 222, 111])).resolves.toEqual(
      new Map([
        [111, '船橋市'],
        [222, '千代田区'],
      ]),
    );
    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('location_point_id IN (?, ?)'), 111, 222);
  });
});
