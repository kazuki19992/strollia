import { fetchAreaNamesByPointIds } from '@/features/logs/dailyLogsService';

jest.mock('@/features/achievements/adminAreaRepository', () => ({
  getLocationPointAdminAreaNames: jest.fn(),
}));

import { getLocationPointAdminAreaNames } from '@/features/achievements/adminAreaRepository';

describe('dailyLogsService fetchAreaNamesByPointIds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getLocationPointAdminAreaNames に渡されたIDのマップを返す', async () => {
    const expected = new Map([
      [10, '船橋市'],
      [20, '千代田区'],
    ]);
    (getLocationPointAdminAreaNames as jest.Mock).mockResolvedValue(expected);

    const result = await fetchAreaNamesByPointIds([10, 20]);

    expect(result).toBe(expected);
    expect(getLocationPointAdminAreaNames).toHaveBeenCalledWith([10, 20]);
  });

  it('空の配列を渡すと空のマップを返す', async () => {
    (getLocationPointAdminAreaNames as jest.Mock).mockResolvedValue(new Map());

    const result = await fetchAreaNamesByPointIds([]);

    expect(result.size).toBe(0);
    expect(getLocationPointAdminAreaNames).toHaveBeenCalledWith([]);
  });

  it('getLocationPointAdminAreaNames がエラーを投げると Promise が reject される', async () => {
    (getLocationPointAdminAreaNames as jest.Mock).mockRejectedValue(new Error('DB エラー'));

    await expect(fetchAreaNamesByPointIds([1])).rejects.toThrow('DB エラー');
  });
});
