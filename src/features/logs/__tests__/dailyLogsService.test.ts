import { calculateTotalDistanceMeters, fetchAreaNamesByPointIds } from '@/features/logs/dailyLogsService';
import { LocationPoint } from '@/types/gps';

jest.mock('@/features/achievements/adminAreaRepository', () => ({
  getLocationPointAdminAreaNames: jest.fn(),
}));

import { getLocationPointAdminAreaNames } from '@/features/achievements/adminAreaRepository';

jest.mock('@/features/logs/logRepository', () => ({
  getLocationPointsByDate: jest.fn(),
}));

import { getLocationPointsByDate } from '@/features/logs/logRepository';

function dailyDistanceEntry(localDate: string, distanceMeters: number | null): { localDate: string; distanceMeters: number | null } {
  return { localDate, distanceMeters };
}

function point(latitude: number, longitude: number, localDate: string): LocationPoint {
  return {
    id: 1,
    recordedAt: `${localDate}T00:00:00.000Z`,
    localDate,
    latitude,
    longitude,
    altitude: null,
    speed: null,
    heading: null,
    accuracy: null,
    altitudeAccuracy: null,
  };
}

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

describe('総移動距離計算 calculateTotalDistanceMeters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('全日付に距離が保存済みの場合は合計するだけでDBへ問い合わせない', async () => {
    const result = await calculateTotalDistanceMeters([dailyDistanceEntry('2026-05-04', 100), dailyDistanceEntry('2026-05-05', 200)]);

    expect(result).toBe(300);
    expect(getLocationPointsByDate).not.toHaveBeenCalled();
  });

  it('距離が欠落した日だけGPSポイントから再計算して合算する', async () => {
    (getLocationPointsByDate as jest.Mock).mockResolvedValue([point(35, 139, '2026-05-05'), point(35.001, 139, '2026-05-05')]);

    const result = await calculateTotalDistanceMeters([dailyDistanceEntry('2026-05-04', 100), dailyDistanceEntry('2026-05-05', null)]);

    expect(getLocationPointsByDate).toHaveBeenCalledWith('2026-05-05');
    // 固定距離100(2026-05-04)に、GPSポイントから再計算した2026-05-05分(2点間 約111m)を加算した値になる
    expect(result).toBeGreaterThan(200);
    expect(result).toBeLessThan(220);
  });

  it('全日付が欠落している場合は0から再計算する', async () => {
    (getLocationPointsByDate as jest.Mock).mockResolvedValue([]);

    const result = await calculateTotalDistanceMeters([dailyDistanceEntry('2026-05-04', null)]);

    expect(result).toBe(0);
  });

  it('欠落した日が複数ある場合は日ごとに個別取得し、両日の距離を合算する', async () => {
    (getLocationPointsByDate as jest.Mock).mockImplementation((localDate: string) => {
      if (localDate === '2026-05-04') {
        return Promise.resolve([point(35, 139, '2026-05-04'), point(35.001, 139, '2026-05-04')]);
      }
      if (localDate === '2026-05-05') {
        return Promise.resolve([point(36, 140, '2026-05-05'), point(36.001, 140, '2026-05-05')]);
      }
      return Promise.resolve([]);
    });

    const result = await calculateTotalDistanceMeters([dailyDistanceEntry('2026-05-04', null), dailyDistanceEntry('2026-05-05', null)]);

    expect(getLocationPointsByDate).toHaveBeenCalledTimes(2);
    expect(getLocationPointsByDate).toHaveBeenNthCalledWith(1, '2026-05-04');
    expect(getLocationPointsByDate).toHaveBeenNthCalledWith(2, '2026-05-05');
    // 2日分(各約111m)を合算した値になる
    expect(result).toBeGreaterThan(200);
    expect(result).toBeLessThan(240);
  });
});
