import { createMonthlyReport, formatReportMonth, getReportMonth, isInReportMonth } from '../monthlyReport';
import { DailyLogSummary, LocationPoint } from '../../../types/gps';

function log(localDate: string, distanceMeters: number | null): DailyLogSummary {
  return { localDate, distanceMeters, pointCount: 2, startedAt: null, endedAt: null };
}

function point(localDate: string, latitude: number, longitude: number): LocationPoint {
  return {
    id: Number(`${localDate.replaceAll('-', '')}${Math.round(latitude * 1000)}`),
    localDate,
    recordedAt: `${localDate}T00:00:00.000Z`,
    latitude,
    longitude,
    altitude: null,
    speed: null,
    heading: null,
    accuracy: null,
    altitudeAccuracy: null,
  };
}

describe('月次レポート集計 monthlyReport', () => {
  it('Dateから対象年月を作る', () => {
    expect(getReportMonth(new Date('2026-04-15T00:00:00.000Z'))).toEqual({ year: 2026, month: 4 });
  });

  it('対象年月をYYYY-MM形式にする', () => {
    expect(formatReportMonth({ year: 2026, month: 4 })).toBe('2026-04');
  });

  it('ローカル日付が対象月に含まれるか判定する', () => {
    expect(isInReportMonth('2026-04-30', { year: 2026, month: 4 })).toBe(true);
    expect(isInReportMonth('2026-05-01', { year: 2026, month: 4 })).toBe(false);
  });

  it('保存済み日別距離から月次総移動距離を集計する', () => {
    const report = createMonthlyReport(
      [log('2026-04-01', 1000), log('2026-04-02', 2500), log('2026-05-01', 9999)],
      [],
      { year: 2026, month: 4 },
    );

    expect(report.label).toBe('2026-04');
    expect(report.totalDistanceMeters).toBe(3500);
    expect(report.activeDays).toBe(2);
  });

  it('日別距離がない場合はGPSポイントから距離を計算する', () => {
    const report = createMonthlyReport(
      [log('2026-04-01', null)],
      [point('2026-04-01', 35, 139), point('2026-04-01', 35.001, 139), point('2026-05-01', 36, 139)],
      { year: 2026, month: 4 },
    );

    expect(report.totalDistanceMeters).toBeGreaterThan(100);
    expect(report.totalDistanceMeters).toBeLessThan(120);
  });
});
