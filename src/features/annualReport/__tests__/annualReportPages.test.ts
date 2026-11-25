import { isMapPage, resolveAnnualReportPages, resolveMonthExtremes } from '@/features/annualReport/annualReportPages';
import type { AnnualReportPayloadV1 } from '@/features/annualReport/annualReportTypes';

/** 全ページが表示される基準のpayload。 */
function payload(overrides: Partial<AnnualReportPayloadV1> = {}): AnnualReportPayloadV1 {
  return {
    version: 1,
    year: 2026,
    periodStart: '2026-01-01',
    periodEnd: '2026-12-15',
    activeDays: 30,
    activeDates: [],
    totalDistanceMeters: 1000,
    monthlyDistanceMeters: new Array(12).fill(100),
    yearRouteSegments: [],
    farthestDay: { localDate: '2026-05-01', distanceMeters: 500, route: [] },
    visitedPrefectures: ['東京都'],
    newPrefectures: ['東京都'],
    newMunicipalityCount: 2,
    newCellCount: 5,
    previousCellCount: 10,
    achievements: { count: 1, highlights: [] },
    spots: { count: 1, highlights: [] },
    ...overrides,
  };
}

describe('年次レポートの表示ページ決定 resolveAnnualReportPages', () => {
  it('すべての値がある場合は10ページを仕様の順で返す', () => {
    expect(resolveAnnualReportPages(payload())).toEqual([
      'opening',
      'activeDays',
      'distance',
      'yearMap',
      'monthly',
      'farthestDay',
      'firstVisits',
      'newAreas',
      'achievements',
      'summary',
    ]);
  });

  it('新しい都道府県と市区町村が0なら firstVisits を除く', () => {
    const pages = resolveAnnualReportPages(payload({ newPrefectures: [], newMunicipalityCount: 0 }));
    expect(pages).not.toContain('firstVisits');
  });

  it('市区町村だけ新しい場合は firstVisits を残す', () => {
    const pages = resolveAnnualReportPages(payload({ newPrefectures: [], newMunicipalityCount: 1 }));
    expect(pages).toContain('firstVisits');
  });

  it('newCellCount が0なら newAreas を除く', () => {
    expect(resolveAnnualReportPages(payload({ newCellCount: 0 }))).not.toContain('newAreas');
  });

  it('最遠日が無ければ farthestDay を除く', () => {
    expect(resolveAnnualReportPages(payload({ farthestDay: null }))).not.toContain('farthestDay');
  });

  it('3ページが0なら7ページになる', () => {
    const pages = resolveAnnualReportPages(
      payload({
        newPrefectures: [],
        newMunicipalityCount: 0,
        newCellCount: 0,
        achievements: { count: 0, highlights: [] },
        spots: { count: 0, highlights: [] },
      }),
    );
    expect(pages).toEqual(['opening', 'activeDays', 'distance', 'yearMap', 'monthly', 'farthestDay', 'summary']);
  });

  it('スポットだけ0なら achievements は残る', () => {
    expect(resolveAnnualReportPages(payload({ spots: { count: 0, highlights: [] } }))).toContain('achievements');
  });

  it('実績が0でもスポットがあれば achievements は残り、両方0なら除く', () => {
    expect(resolveAnnualReportPages(payload({ achievements: { count: 0, highlights: [] } }))).toContain('achievements');
    expect(
      resolveAnnualReportPages(payload({ achievements: { count: 0, highlights: [] }, spots: { count: 0, highlights: [] } })),
    ).not.toContain('achievements');
  });
});

describe('地図ページ判定 isMapPage', () => {
  it('yearMap / farthestDay / newAreas / summary だけが地図ページになる', () => {
    expect(isMapPage('yearMap')).toBe(true);
    expect(isMapPage('farthestDay')).toBe(true);
    expect(isMapPage('newAreas')).toBe(true);
    expect(isMapPage('summary')).toBe(true);
    expect(isMapPage('opening')).toBe(false);
    expect(isMapPage('monthly')).toBe(false);
  });
});

describe('月別距離の最多・最少月 resolveMonthExtremes', () => {
  it('最多月と最少月を1始まりで返す', () => {
    const monthly = [10, 50, 5, 20, 20, 20, 20, 20, 20, 20, 20, 20];
    expect(resolveMonthExtremes(monthly, '2026-12-15')).toEqual({ maxMonth: 2, minMonth: 3 });
  });

  it('同じ値なら早い月を返す', () => {
    expect(resolveMonthExtremes(new Array(12).fill(100), '2026-12-15')).toEqual({ maxMonth: 1, minMonth: 1 });
  });

  it('6月終了の期間では7〜12月の0を最少扱いしない', () => {
    const monthly = [30, 20, 10, 40, 25, 15, 0, 0, 0, 0, 0, 0];
    expect(resolveMonthExtremes(monthly, '2026-06-30')).toEqual({ maxMonth: 4, minMonth: 3 });
  });
});
