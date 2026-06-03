import {
  DAILY_ROUTE_END_MINUTES,
  DAILY_ROUTE_START_MINUTES,
  DAILY_ROUTE_TIME_STEP_MINUTES,
  filterLocationPointsUntilMinute,
  formatTimelineHourLabel,
  formatTimelineTimeLabel,
} from '../dailyRouteTimeline';

const points = [
  { id: 1, recordedAt: new Date(2026, 4, 31, 0, 0).toISOString(), localDate: '2026-05-31', latitude: 35, longitude: 139 },
  { id: 2, recordedAt: new Date(2026, 4, 31, 0, 30).toISOString(), localDate: '2026-05-31', latitude: 35.1, longitude: 139.1 },
  { id: 3, recordedAt: new Date(2026, 4, 31, 1, 0).toISOString(), localDate: '2026-05-31', latitude: 35.2, longitude: 139.2 },
] as never;

describe('日別ルートタイムライン', () => {
  it('0時から24時までを30分刻みで扱う定数を公開する', () => {
    expect(DAILY_ROUTE_START_MINUTES).toBe(0);
    expect(DAILY_ROUTE_END_MINUTES).toBe(1440);
    expect(DAILY_ROUTE_TIME_STEP_MINUTES).toBe(30);
  });

  it('選択時刻までのGPSポイントだけを表示対象にする', () => {
    expect(filterLocationPointsUntilMinute(points, 30).map((point) => point.id)).toEqual([1, 2]);
  });

  it('端の時刻を画面表示用ラベルに変換する', () => {
    expect(formatTimelineHourLabel(0)).toBe('0時');
    expect(formatTimelineHourLabel(1440)).toBe('24時');
  });

  it('選択中の時刻を分まで表示する', () => {
    expect(formatTimelineTimeLabel(750)).toBe('12時30分');
  });
});
