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

  it('対象月に訪問済みの市区町村から都道府県ランキングと代表市区町村を取得する', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValueOnce([
      { name: '千葉県', count: 3 },
      { name: '東京都', count: 1 },
    ]);
    (db.getFirstAsync as jest.Mock).mockResolvedValueOnce({ prefectureName: '千葉県', municipalityName: '船橋市' });

    await expect(getMonthlyAreaReport({ year: 2026, month: 4 })).resolves.toEqual({
      prefectureRanking: [
        { name: '千葉県', count: 3 },
        { name: '東京都', count: 1 },
      ],
      topMunicipalityName: '千葉県船橋市',
    });
  });

  it('市区町村がない場合は都道府県の訪問記録へフォールバックする', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValueOnce([]).mockResolvedValueOnce([{ name: '福島県', count: 1 }]);
    (db.getFirstAsync as jest.Mock).mockResolvedValueOnce(null);

    await expect(getMonthlyAreaReport({ year: 2026, month: 4 })).resolves.toEqual({
      prefectureRanking: [{ name: '福島県', count: 1 }],
      topMunicipalityName: null,
    });
  });
});
