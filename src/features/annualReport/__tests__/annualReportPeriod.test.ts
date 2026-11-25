import {
  daysUntilPublishEnd,
  isPublishPeriod,
  meetsMinimumActiveDays,
  resolveAggregationWindow,
  resolveNotificationTime,
} from '@/features/annualReport/annualReportPeriod';

// 共通セットアップ(jest/setupAnnualReportPeriodMock.js)の期間判定モックを外し、実装を使う
jest.unmock('@/features/annualReport/annualReportPeriod');

describe('年次レポートの期間判定 annualReportPeriod', () => {
  it('12月15日は集計を起動しない', () => expect(resolveAggregationWindow(new Date(2026, 11, 15, 23, 59), false)).toBeNull());
  it('12月16日は当年を集計期間1/1〜12/15で起動する', () =>
    expect(resolveAggregationWindow(new Date(2026, 11, 16), false)).toMatchObject({
      year: 2026,
      periodStart: '2026-01-01',
      periodEnd: '2026-12-15',
    }));
  it('1月15日は前年を対象にする', () => expect(resolveAggregationWindow(new Date(2027, 0, 15, 23, 0), false)?.year).toBe(2026));
  it('1月16日は起動しない', () => expect(resolveAggregationWindow(new Date(2027, 0, 16), false)).toBeNull());
  it('通常時の公開終了は翌年1月15日の23:59:59.999', () =>
    expect(resolveAggregationWindow(new Date(2026, 11, 16), false)?.publishEnd).toEqual(new Date(2027, 0, 15, 23, 59, 59, 999)));
  it('開発用フラグ時は6月でも当年を今日までで集計する', () =>
    expect(resolveAggregationWindow(new Date(2026, 5, 10), true)).toMatchObject({ year: 2026, periodEnd: '2026-06-10' }));
  it('開発用フラグ時は12月16日以降でも集計期間の終わりを12月15日にする', () =>
    expect(resolveAggregationWindow(new Date(2026, 11, 28), true)).toMatchObject({ year: 2026, periodEnd: '2026-12-15' }));
  it('開発用フラグ時の公開終了は次の1月15日', () =>
    expect(resolveAggregationWindow(new Date(2026, 5, 10), true)?.publishEnd).toEqual(new Date(2027, 0, 15, 23, 59, 59, 999)));
  it('公開期間は12/20 0:00から1/15 23:59まで', () => {
    expect(isPublishPeriod(new Date(2026, 11, 19, 23, 59), 2026, false)).toBe(false);
    expect(isPublishPeriod(new Date(2026, 11, 20, 0, 0), 2026, false)).toBe(true);
    expect(isPublishPeriod(new Date(2027, 0, 15, 23, 59), 2026, false)).toBe(true);
    expect(isPublishPeriod(new Date(2027, 0, 16, 0, 0), 2026, false)).toBe(false);
  });
  it('開発用フラグ時は常に公開期間として扱う', () => expect(isPublishPeriod(new Date(2026, 5, 1), 2026, true)).toBe(true));
  it('残り日数は終了日当日が1', () => {
    const end = new Date(2027, 0, 15, 23, 59, 59, 999);
    expect(daysUntilPublishEnd(new Date(2027, 0, 15, 8), end)).toBe(1);
    expect(daysUntilPublishEnd(new Date(2027, 0, 14, 8), end)).toBe(2);
    expect(daysUntilPublishEnd(new Date(2026, 11, 20, 8), end)).toBe(27);
  });
  it('12/19に完了したら12/20 9:00に通知する', () =>
    expect(resolveNotificationTime(new Date(2026, 11, 19, 22), 2026, false)).toEqual(new Date(2026, 11, 20, 9, 0)));
  it('12/20以降に完了したら通知しない', () => expect(resolveNotificationTime(new Date(2026, 11, 20, 0, 1), 2026, false)).toBeNull());
  it('開発用フラグ時は10秒後に通知する', () =>
    expect(resolveNotificationTime(new Date(2026, 5, 1, 12), 2026, true)).toEqual(new Date(2026, 5, 1, 12, 0, 10)));
  it('記録6日では作らず、フラグ時は作る', () => {
    expect(meetsMinimumActiveDays(6, false)).toBe(false);
    expect(meetsMinimumActiveDays(7, false)).toBe(true);
    expect(meetsMinimumActiveDays(0, true)).toBe(true);
  });
});
