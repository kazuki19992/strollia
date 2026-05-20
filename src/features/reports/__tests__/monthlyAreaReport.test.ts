import { db } from '../../../db/database';
import { getMonthlyAreaReport } from '../monthlyAreaReport';

jest.mock('../../../db/database', () => ({
  db: {
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
  },
}));

describe('月次行政区域レポート monthlyAreaReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('対象月のGPSポイント履歴から都道府県ランキングと代表市区町村を取得する', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValueOnce([
      { name: '千葉県', count: 120 },
      { name: '東京都', count: 30 },
    ]);
    (db.getFirstAsync as jest.Mock).mockResolvedValueOnce({ prefectureName: '千葉県', municipalityName: '船橋市', count: 80 });

    await expect(getMonthlyAreaReport({ year: 2026, month: 4 })).resolves.toEqual({
      prefectureRanking: [
        { name: '千葉県', count: 120 },
        { name: '東京都', count: 30 },
      ],
      topMunicipalityName: '千葉県船橋市',
    });
    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('location_point_admin_areas'), '2026-04-01', '2026-05-01');
  });

  it('対象月のGPSポイント履歴がない場合は空のサマリーを返す', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValueOnce([]);
    (db.getFirstAsync as jest.Mock).mockResolvedValueOnce(null);

    await expect(getMonthlyAreaReport({ year: 2026, month: 4 })).resolves.toEqual({
      prefectureRanking: [],
      topMunicipalityName: null,
    });
  });
});
