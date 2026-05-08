import { db } from '../../../db/database';
import { upsertVisitedAdminArea } from '../adminAreaRepository';

jest.mock('../../../db/database', () => ({
  db: {
    runAsync: jest.fn(),
  },
}));

describe('訪問行政区域リポジトリ upsertVisitedAdminArea', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('訪問行政区域をUPSERT用SQLへ渡す', async () => {
    await upsertVisitedAdminArea({
      areaType: 'municipality',
      areaCode: null,
      prefectureName: '東京都',
      municipalityName: '渋谷区',
      normalizedName: '東京都:渋谷区',
      visitedAt: '2026-05-08T00:00:00.000Z',
      firstLocationPointId: 123,
    });

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT(area_type, normalized_name) DO UPDATE SET'),
      'municipality',
      null,
      '東京都',
      '渋谷区',
      '東京都:渋谷区',
      '2026-05-08T00:00:00.000Z',
      '2026-05-08T00:00:00.000Z',
      123,
      expect.any(String),
      expect.any(String),
    );
  });

  it('位置情報ポイントIDがない場合はnullを保存する', async () => {
    await upsertVisitedAdminArea({
      areaType: 'prefecture',
      areaCode: null,
      prefectureName: '東京都',
      municipalityName: null,
      normalizedName: '東京都',
      visitedAt: '2026-05-08T00:00:00.000Z',
    });

    expect((db.runAsync as jest.Mock).mock.calls[0][8]).toBeNull();
  });

  it('last_visited_atは新しい訪問日時の場合だけ更新するSQLを使う', async () => {
    await upsertVisitedAdminArea({
      areaType: 'prefecture',
      areaCode: null,
      prefectureName: '東京都',
      municipalityName: null,
      normalizedName: '東京都',
      visitedAt: '2026-05-08T00:00:00.000Z',
    });

    expect((db.runAsync as jest.Mock).mock.calls[0][0]).toEqual(expect.stringContaining('WHEN excluded.last_visited_at > visited_admin_areas.last_visited_at'));
    expect((db.runAsync as jest.Mock).mock.calls[0][0]).toEqual(expect.stringContaining('updated_at = excluded.updated_at'));
  });
});
