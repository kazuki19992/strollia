import { createInitialProgress, runAnnualReportStep } from '@/features/annualReport/annualReportAggregator';
import type { AnnualReportWindow } from '@/features/annualReport/annualReportPeriod';
import {
  getAchievementUnlockSummary,
  getAnnualReportRoutePoints,
  getDailyDistanceRows,
  getLandmarkSpotVisitSummary,
  getNewAdminAreaSummary,
  getNewCellCountsByRow,
  getVisitedCellCounts,
  getVisitedPrefectureNames,
} from '@/features/annualReport/annualReportQueries';
import type { AnnualReportProgress } from '@/features/annualReport/annualReportTypes';
import { getLocationPointsByDate } from '@/features/logs/logRepository';
import type { LocationPoint } from '@/types/gps';

// 共通セットアップ(jest/setupAnnualReportPeriodMock.js)の期間判定モックを外し、実装を使う
jest.unmock('@/features/annualReport/annualReportPeriod');

// requireActual で toLocalDayStartIso を使うため、クエリモジュールが読む実DB接続を差し替える
jest.mock('@/db/database', () => ({ db: {} }));

jest.mock('@/features/annualReport/annualReportQueries', () => ({
  ...jest.requireActual('@/features/annualReport/annualReportQueries'),
  getDailyDistanceRows: jest.fn(),
  getAnnualReportRoutePoints: jest.fn(),
  getVisitedPrefectureNames: jest.fn(),
  getNewAdminAreaSummary: jest.fn(),
  getVisitedCellCounts: jest.fn(),
  getNewCellCountsByRow: jest.fn(),
  getAchievementUnlockSummary: jest.fn(),
  getLandmarkSpotVisitSummary: jest.fn(),
}));

jest.mock('@/features/logs/logRepository', () => ({
  getLocationPointsByDate: jest.fn(),
}));

const mockDailyRows = getDailyDistanceRows as jest.Mock;
const mockRoutePoints = getAnnualReportRoutePoints as jest.Mock;
const mockPointsByDate = getLocationPointsByDate as jest.Mock;

/** 通常時の集計対象(2026年1月1日〜12月15日)。 */
const window2026: AnnualReportWindow = {
  year: 2026,
  periodStart: '2026-01-01',
  periodEnd: '2026-12-15',
  publishEnd: new Date(2027, 0, 15, 23, 59, 59, 999),
};

let nextPointId = 1;

/** 指定日・時刻・座標のGPSポイントを作る。時刻は区間分割されないよう数分おきにする。 */
function point(localDate: string, minute: number, latitude: number, longitude: number): LocationPoint {
  const recordedAt = new Date(`${localDate}T09:${String(minute).padStart(2, '0')}:00+09:00`).toISOString();
  return {
    id: nextPointId++,
    recordedAt,
    localDate,
    latitude,
    longitude,
    altitude: null,
    speed: null,
    heading: null,
    accuracy: 5,
    altitudeAccuracy: null,
  };
}

/** 指定日に北へ少しずつ進む連続ポイントを作る。 */
function walk(localDate: string, count: number): LocationPoint[] {
  return Array.from({ length: count }, (_, index) => point(localDate, index, 35 + index * 0.001, 139));
}

/** 指定月まで終えた進捗を作る(最終ステップのテスト用)。 */
function progressWith(overrides: Partial<AnnualReportProgress>): AnnualReportProgress {
  return { ...createInitialProgress(), ...overrides };
}

describe('年次レポートのステップ集計', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    nextPointId = 1;
    (getVisitedPrefectureNames as jest.Mock).mockResolvedValue(['東京都', '神奈川県']);
    (getNewAdminAreaSummary as jest.Mock).mockResolvedValue({ newPrefectures: ['神奈川県'], newMunicipalityCount: 4 });
    (getVisitedCellCounts as jest.Mock).mockResolvedValue({ newCellCount: 120, previousCellCount: 300 });
    // 赤道付近(y=0)の100mセルは1件10,000m²として数える
    (getNewCellCountsByRow as jest.Mock).mockResolvedValue([{ cellSizeMeters: 100, y: 0, count: 120 }]);
    (getAchievementUnlockSummary as jest.Mock).mockResolvedValue({ count: 5, highlights: [{ id: 'a1', unlockedLocalDate: '2026-11-01' }] });
    (getLandmarkSpotVisitSummary as jest.Mock).mockResolvedValue({ count: 2, highlights: [{ id: 's1', visitedLocalDate: '2026-10-01' }] });
  });

  test('初期進捗は1月から始まり月別距離は0が12個', () => {
    const progress = createInitialProgress();

    expect(progress).toEqual({
      nextMonth: 1,
      nextHalf: 1,
      activeDates: [],
      monthlyDistanceMeters: Array(12).fill(0),
      yearRouteSegments: [],
      farthestCandidate: null,
    });
  });

  test('1月前半のステップで1〜15日を読み、月別距離[0]と activeDates を更新して1月後半へ進む', async () => {
    mockDailyRows.mockResolvedValue([
      { localDate: '2026-01-03', pointCount: 5, distanceMeters: 1000 },
      { localDate: '2026-01-10', pointCount: 5, distanceMeters: 2500 },
    ]);
    mockRoutePoints.mockResolvedValue([...walk('2026-01-03', 5), ...walk('2026-01-10', 5)]);

    const result = await runAnnualReportStep(window2026, createInitialProgress(), false);

    expect(mockDailyRows).toHaveBeenCalledWith('2026-01-01', '2026-01-15');
    expect(mockRoutePoints).toHaveBeenCalledWith('2026-01-01', '2026-01-15');
    expect(result.kind).toBe('progressed');
    if (result.kind !== 'progressed') return;
    expect(result.progress.nextMonth).toBe(1);
    expect(result.progress.nextHalf).toBe(2);
    expect(result.progress.monthlyDistanceMeters[0]).toBe(3500);
    expect(result.progress.activeDates).toEqual(['2026-01-03', '2026-01-10']);
    // 日ごとに区間を分け、日をまたいでつながない
    expect(result.progress.yearRouteSegments).toHaveLength(2);
  });

  test('distance_meters が NULL の日はポイントから計算した距離を足す', async () => {
    const points = walk('2026-02-05', 3);
    mockDailyRows.mockResolvedValue([
      { localDate: '2026-02-01', pointCount: 2, distanceMeters: 100 },
      { localDate: '2026-02-05', pointCount: 3, distanceMeters: null },
    ]);
    mockRoutePoints.mockResolvedValue(points);

    const result = await runAnnualReportStep(window2026, progressWith({ nextMonth: 2 }), false);

    if (result.kind !== 'progressed') throw new Error('progressed を期待');
    // 緯度0.001度×2区間 ≒ 222m
    expect(result.progress.monthlyDistanceMeters[1]).toBeGreaterThan(100 + 220);
    expect(result.progress.monthlyDistanceMeters[1]).toBeLessThan(100 + 225);
  });

  test('1月後半のステップで16日〜月末を読み、前半の距離に足して2月前半へ進む', async () => {
    mockDailyRows.mockResolvedValue([{ localDate: '2026-01-20', pointCount: 5, distanceMeters: 500 }]);
    mockRoutePoints.mockResolvedValue(walk('2026-01-20', 5));
    const input = progressWith({
      nextMonth: 1,
      nextHalf: 2,
      activeDates: ['2026-01-03'],
      monthlyDistanceMeters: [3500, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    });

    const result = await runAnnualReportStep(window2026, input, false);

    expect(mockDailyRows).toHaveBeenCalledWith('2026-01-16', '2026-01-31');
    expect(mockRoutePoints).toHaveBeenCalledWith('2026-01-16', '2026-01-31');
    if (result.kind !== 'progressed') throw new Error('progressed を期待');
    expect(result.progress.nextMonth).toBe(2);
    expect(result.progress.nextHalf).toBe(1);
    expect(result.progress.monthlyDistanceMeters[0]).toBe(4000);
    expect(result.progress.activeDates).toEqual(['2026-01-03', '2026-01-20']);
  });

  test('同じ後半の progress で2回実行しても、前半の距離に二重に足さない', async () => {
    mockDailyRows.mockResolvedValue([{ localDate: '2026-01-20', pointCount: 5, distanceMeters: 500 }]);
    mockRoutePoints.mockResolvedValue(walk('2026-01-20', 5));
    const input = progressWith({ nextMonth: 1, nextHalf: 2, monthlyDistanceMeters: [3500, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
    const snapshot = JSON.parse(JSON.stringify(input));

    const first = await runAnnualReportStep(window2026, input, false);
    const second = await runAnnualReportStep(window2026, input, false);

    expect(input).toEqual(snapshot);
    expect(second).toEqual(first);
    if (second.kind !== 'progressed') throw new Error('progressed を期待');
    expect(second.progress.monthlyDistanceMeters[0]).toBe(4000);
  });

  test('前半のステップは、その月の距離に古い値が残っていても加算せず置き換える', async () => {
    mockDailyRows.mockResolvedValue([{ localDate: '2026-01-03', pointCount: 5, distanceMeters: 1000 }]);
    mockRoutePoints.mockResolvedValue(walk('2026-01-03', 5));
    const input = progressWith({ nextMonth: 1, nextHalf: 1, monthlyDistanceMeters: [999, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] });

    const result = await runAnnualReportStep(window2026, input, false);

    if (result.kind !== 'progressed') throw new Error('progressed を期待');
    expect(result.progress.monthlyDistanceMeters[0]).toBe(1000);
  });

  test('前半・後半の区別がない旧形式の進捗は、その月の前半から再開する', async () => {
    mockDailyRows.mockResolvedValue([]);
    mockRoutePoints.mockResolvedValue([]);
    const legacy = { ...createInitialProgress(), nextMonth: 5 } as Partial<AnnualReportProgress>;
    delete legacy.nextHalf;

    const result = await runAnnualReportStep(window2026, legacy as AnnualReportProgress, false);

    expect(mockDailyRows).toHaveBeenCalledWith('2026-05-01', '2026-05-15');
    if (result.kind !== 'progressed') throw new Error('progressed を期待');
    expect(result.progress.nextMonth).toBe(5);
    expect(result.progress.nextHalf).toBe(2);
  });

  test('形式を解釈できない進捗は捨てて1月前半から集計し直す', async () => {
    mockDailyRows.mockResolvedValue([]);
    mockRoutePoints.mockResolvedValue([]);
    const broken = { nextMonth: 4, nextHalf: 3, activeDates: [] } as unknown as AnnualReportProgress;

    const result = await runAnnualReportStep(window2026, broken, false);

    expect(mockDailyRows).toHaveBeenCalledWith('2026-01-01', '2026-01-15');
    if (result.kind !== 'progressed') throw new Error('progressed を期待');
    expect(result.progress).toEqual({ ...createInitialProgress(), nextHalf: 2 });
  });

  test('同じ progress で同じステップを2回実行しても月別距離が二重に加算されない', async () => {
    mockDailyRows.mockResolvedValue([{ localDate: '2026-01-03', pointCount: 5, distanceMeters: 1000 }]);
    mockRoutePoints.mockResolvedValue(walk('2026-01-03', 5));
    const input = createInitialProgress();
    const snapshot = JSON.parse(JSON.stringify(input));

    const first = await runAnnualReportStep(window2026, input, false);
    const second = await runAnnualReportStep(window2026, input, false);

    expect(input).toEqual(snapshot);
    expect(second).toEqual(first);
    if (second.kind !== 'progressed') throw new Error('progressed を期待');
    expect(second.progress.monthlyDistanceMeters[0]).toBe(1000);
    expect(second.progress.activeDates).toEqual(['2026-01-03']);
  });

  test('periodEnd より後の月は読み込まずにスキップする', async () => {
    const devWindow: AnnualReportWindow = { ...window2026, periodEnd: '2026-06-10' };
    const input = progressWith({ nextMonth: 7, monthlyDistanceMeters: [1, 2, 3, 4, 5, 6, 0, 0, 0, 0, 0, 0] });

    const result = await runAnnualReportStep(devWindow, input, true);

    expect(mockDailyRows).not.toHaveBeenCalled();
    expect(mockRoutePoints).not.toHaveBeenCalled();
    if (result.kind !== 'progressed') throw new Error('progressed を期待');
    expect(result.progress.nextMonth).toBe(7);
    expect(result.progress.nextHalf).toBe(2);
    expect(result.progress.monthlyDistanceMeters).toEqual(input.monthlyDistanceMeters);

    const secondHalf = await runAnnualReportStep(devWindow, result.progress, true);
    expect(mockDailyRows).not.toHaveBeenCalled();
    if (secondHalf.kind !== 'progressed') throw new Error('progressed を期待');
    expect(secondHalf.progress.nextMonth).toBe(8);
    expect(secondHalf.progress.nextHalf).toBe(1);
  });

  test('periodEnd を含む月は periodEnd までの日だけを対象にする', async () => {
    const devWindow: AnnualReportWindow = { ...window2026, periodEnd: '2026-06-10' };
    mockDailyRows.mockResolvedValue([]);
    mockRoutePoints.mockResolvedValue([]);

    await runAnnualReportStep(devWindow, progressWith({ nextMonth: 6 }), true);

    expect(mockDailyRows).toHaveBeenCalledWith('2026-06-01', '2026-06-10');
    expect(mockRoutePoints).toHaveBeenCalledWith('2026-06-01', '2026-06-10');
  });

  test('12月は15日までだけを読み、後半(16日以降)は読まずに最終ステップへ進む', async () => {
    mockDailyRows.mockResolvedValue([{ localDate: '2026-12-15', pointCount: 3, distanceMeters: null }]);
    mockRoutePoints.mockResolvedValue(walk('2026-12-15', 3));

    const firstHalf = await runAnnualReportStep(window2026, progressWith({ nextMonth: 12 }), false);

    expect(mockDailyRows).toHaveBeenCalledWith('2026-12-01', '2026-12-15');
    expect(mockRoutePoints).toHaveBeenCalledWith('2026-12-01', '2026-12-15');
    if (firstHalf.kind !== 'progressed') throw new Error('progressed を期待');
    expect(firstHalf.progress.monthlyDistanceMeters[11]).toBeGreaterThan(220);
    expect(firstHalf.progress.yearRouteSegments).toHaveLength(1);

    jest.clearAllMocks();
    const secondHalf = await runAnnualReportStep(window2026, firstHalf.progress, false);

    expect(mockDailyRows).not.toHaveBeenCalled();
    expect(mockRoutePoints).not.toHaveBeenCalled();
    if (secondHalf.kind !== 'progressed') throw new Error('progressed を期待');
    expect(secondHalf.progress.nextMonth).toBe(13);
    expect(secondHalf.progress.monthlyDistanceMeters).toEqual(firstHalf.progress.monthlyDistanceMeters);
  });

  test('最長日は移動距離が最大の日で、同距離なら早い日付', async () => {
    mockDailyRows.mockResolvedValue([
      { localDate: '2026-03-02', pointCount: 2, distanceMeters: 5000 },
      { localDate: '2026-03-09', pointCount: 2, distanceMeters: 8000 },
      { localDate: '2026-03-20', pointCount: 2, distanceMeters: 8000 },
    ]);
    mockRoutePoints.mockResolvedValue([]);
    const march = await runAnnualReportStep(window2026, progressWith({ nextMonth: 3 }), false);
    if (march.kind !== 'progressed') throw new Error('progressed を期待');
    expect(march.progress.farthestCandidate).toEqual({ localDate: '2026-03-09', distanceMeters: 8000 });

    // 後の月で同距離が出ても早い日付を保つ
    mockDailyRows.mockResolvedValue([{ localDate: '2026-04-01', pointCount: 2, distanceMeters: 8000 }]);
    const april = await runAnnualReportStep(window2026, march.progress, false);
    if (april.kind !== 'progressed') throw new Error('progressed を期待');
    expect(april.progress.farthestCandidate).toEqual({ localDate: '2026-03-09', distanceMeters: 8000 });

    // より長い日が出れば入れ替わる
    mockDailyRows.mockResolvedValue([{ localDate: '2026-05-01', pointCount: 2, distanceMeters: 9000 }]);
    const may = await runAnnualReportStep(window2026, april.progress, false);
    if (may.kind !== 'progressed') throw new Error('progressed を期待');
    expect(may.progress.farthestCandidate).toEqual({ localDate: '2026-05-01', distanceMeters: 9000 });
  });

  test('記録6日で最終ステップを迎えると insufficient を返す', async () => {
    const progress = progressWith({
      nextMonth: 13,
      activeDates: ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01'],
    });

    const result = await runAnnualReportStep(window2026, progress, false);

    expect(result).toEqual({ kind: 'insufficient' });
    expect(mockPointsByDate).not.toHaveBeenCalled();
  });

  test('開発用フラグ時は記録6日でも最終ステップで payload を返す', async () => {
    const progress = progressWith({
      nextMonth: 13,
      activeDates: ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01'],
    });

    const result = await runAnnualReportStep(window2026, progress, true);

    expect(result.kind).toBe('completed');
  });

  test('最終ステップで payload の各値が揃い version が1', async () => {
    const activeDates = ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01'];
    const progress = progressWith({
      nextMonth: 13,
      activeDates,
      monthlyDistanceMeters: [100, 200, 300, 0, 0, 0, 400, 0, 0, 0, 0, 0],
      yearRouteSegments: [
        [
          { latitude: 35, longitude: 139 },
          { latitude: 35.01, longitude: 139 },
        ],
      ],
      farthestCandidate: { localDate: '2026-07-01', distanceMeters: 400 },
    });
    const farthestPoints = walk('2026-07-01', 3);
    farthestPoints[1] = { ...farthestPoints[1], effectiveLatitude: 36, effectiveLongitude: 140 };
    mockPointsByDate.mockResolvedValue(farthestPoints);

    const result = await runAnnualReportStep(window2026, progress, false);

    expect(mockPointsByDate).toHaveBeenCalledWith('2026-07-01');
    expect(getVisitedPrefectureNames).toHaveBeenCalledWith('2026-01-01', '2026-12-15');
    expect(getNewAdminAreaSummary).toHaveBeenCalledWith(new Date(2026, 0, 1).toISOString(), new Date(2026, 11, 16).toISOString());
    expect(getVisitedCellCounts).toHaveBeenCalledWith(new Date(2026, 0, 1).toISOString(), new Date(2026, 11, 16).toISOString());
    expect(getNewCellCountsByRow).toHaveBeenCalledWith(new Date(2026, 0, 1).toISOString(), new Date(2026, 11, 16).toISOString());
    expect(getAchievementUnlockSummary).toHaveBeenCalledWith('2026-01-01', '2026-12-15');
    expect(getLandmarkSpotVisitSummary).toHaveBeenCalledWith('2026-01-01', '2026-12-15');
    expect(result).toEqual({
      kind: 'completed',
      payload: {
        version: 1,
        year: 2026,
        periodStart: '2026-01-01',
        periodEnd: '2026-12-15',
        activeDays: 7,
        activeDates,
        totalDistanceMeters: 1000,
        monthlyDistanceMeters: [100, 200, 300, 0, 0, 0, 400, 0, 0, 0, 0, 0],
        yearRouteSegments: progress.yearRouteSegments,
        farthestDay: {
          localDate: '2026-07-01',
          distanceMeters: 400,
          route: [
            { latitude: 35, longitude: 139, recordedAt: farthestPoints[0].recordedAt },
            // 有効座標(吸着後)があればそちらを使う
            { latitude: 36, longitude: 140, recordedAt: farthestPoints[1].recordedAt },
            { latitude: 35.002, longitude: 139, recordedAt: farthestPoints[2].recordedAt },
          ],
        },
        visitedPrefectures: ['東京都', '神奈川県'],
        newPrefectures: ['神奈川県'],
        newMunicipalityCount: 4,
        newCellCount: 120,
        newAreaSquareMeters: expect.closeTo(1_200_000, 0),
        previousCellCount: 300,
        achievements: { count: 5, highlights: [{ id: 'a1', unlockedLocalDate: '2026-11-01' }] },
        spots: { count: 2, highlights: [{ id: 's1', visitedLocalDate: '2026-10-01' }] },
      },
    });
  });

  test('最遠日の候補がない場合は farthestDay を null にする', async () => {
    const progress = progressWith({ nextMonth: 13 });

    const result = await runAnnualReportStep(window2026, progress, true);

    if (result.kind !== 'completed') throw new Error('completed を期待');
    expect(result.payload.farthestDay).toBeNull();
    expect(mockPointsByDate).not.toHaveBeenCalled();
  });
});
