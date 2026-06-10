import { createMonthlyReport, formatReportMonth, getPreviousReportMonth, getReportMonth, hasMonthlyReportData, isInReportMonth } from '../monthlyReport';
import { DailyLogSummary, LocationPoint } from '../../../types/gps';

/**
 * 月次レポートテスト用の日別ログ最小フィクスチャを作る。
 *
 * @param localDate - 対象ローカル日付。
 * @param distanceMeters - 日別保存距離。nullの場合はGPS点からの再計算対象。
 * @returns 固定pointCountとnull時刻を持つ日別ログサマリー。
 */
function log(localDate: string, distanceMeters: number | null): DailyLogSummary {
  return { localDate, distanceMeters, pointCount: 2, startedAt: null, endedAt: null, startLocationPointId: null, endLocationPointId: null };
}

/**
 * 月次レポートテスト用のGPSポイント最小フィクスチャを作る。
 *
 * @param localDate - 対象ローカル日付。
 * @param latitude - 緯度。
 * @param longitude - 経度。
 * @returns 距離計算に必要な座標と最小フィールドだけを持つGPSポイント。
 */
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

  it('Dateから直前月の対象年月を作る', () => {
    expect(getPreviousReportMonth(new Date('2026-01-15T00:00:00.000Z'))).toEqual({ year: 2025, month: 12 });
    expect(getPreviousReportMonth(new Date('2026-04-15T00:00:00.000Z'))).toEqual({ year: 2026, month: 3 });
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

  it('一部の日別距離がない場合もGPSポイントから月間距離を再計算する', () => {
    const report = createMonthlyReport(
      [log('2026-04-01', 9999), log('2026-04-02', null)],
      [point('2026-04-01', 35, 139), point('2026-04-01', 35.001, 139), point('2026-04-02', 35.001, 139), point('2026-04-02', 35.002, 139)],
      { year: 2026, month: 4 },
    );

    expect(report.totalDistanceMeters).toBeGreaterThan(200);
    expect(report.totalDistanceMeters).toBeLessThan(230);
  });
});

describe('月次レポートのデータ有無判定 hasMonthlyReportData', () => {
  it('対象月に記録がある場合はtrueを返す', () => {
    const report = createMonthlyReport([log('2026-04-01', 1000)], [], { year: 2026, month: 4 });

    expect(hasMonthlyReportData(report)).toBe(true);
  });

  it('対象月に記録が一切ない場合はfalseを返す', () => {
    const report = createMonthlyReport([], [], { year: 2026, month: 4 });

    expect(hasMonthlyReportData(report)).toBe(false);
  });

  it('別の月の記録しかない場合はfalseを返す', () => {
    const report = createMonthlyReport([log('2026-05-01', 1000)], [], { year: 2026, month: 4 });

    expect(hasMonthlyReportData(report)).toBe(false);
  });
});
