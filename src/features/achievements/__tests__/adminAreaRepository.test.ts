import { db } from '../../../db/database';
import { upsertVisitedAdminArea } from '../adminAreaRepository';

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

const mockVisitedAdminAreas = new Map<string, VisitedAdminAreaRow>();

jest.mock('../../../db/database', () => ({
  db: {
    runAsync: jest.fn(
      async (
        _sql: string,
        areaType: string,
        areaCode: string | null,
        prefectureName: string,
        municipalityName: string | null,
        normalizedName: string,
        firstVisitedAt: string,
        lastVisitedAt: string,
        firstLocationPointId: number | null,
        createdAt: string,
        updatedAt: string,
      ) => {
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
      },
    ),
    getFirstAsync: jest.fn(async (_sql: string, areaType: string, normalizedName: string) => mockVisitedAdminAreas.get(`${areaType}:${normalizedName}`) ?? null),
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

describe('訪問行政区域リポジトリ upsertVisitedAdminArea', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockVisitedAdminAreas.clear();
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
