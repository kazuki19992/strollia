import {
  computeRouteMaxEndMinutes,
  DAILY_ROUTE_END_MINUTES,
  DAILY_ROUTE_START_MINUTES,
  DAILY_ROUTE_TIME_STEP_MINUTES,
  filterLocationPointsBetweenMinutes,
  filterLocationPointsUntilMinute,
  formatTimelineHourLabel,
  formatTimelineTimeLabel,
  formatTimelineTimeLabelPadded,
} from '../dailyRouteTimeline';

const points = [
  { id: 1, recordedAt: new Date(2026, 4, 31, 0, 0).toISOString(), localDate: '2026-05-31', latitude: 35, longitude: 139 },
  { id: 2, recordedAt: new Date(2026, 4, 31, 0, 30).toISOString(), localDate: '2026-05-31', latitude: 35.1, longitude: 139.1 },
  { id: 3, recordedAt: new Date(2026, 4, 31, 1, 0).toISOString(), localDate: '2026-05-31', latitude: 35.2, longitude: 139.2 },
] as never;

describe('日別ルートタイムライン', () => {
  it('0時から24時までを5分刻みで扱う定数を公開する', () => {
    expect(DAILY_ROUTE_START_MINUTES).toBe(0);
    expect(DAILY_ROUTE_END_MINUTES).toBe(1440);
    expect(DAILY_ROUTE_TIME_STEP_MINUTES).toBe(5);
  });

  it('選択時刻までのGPSポイントだけを表示対象にする', () => {
    expect(filterLocationPointsUntilMinute(points, 30).map((point) => point.id)).toEqual([1, 2]);
  });

  it('開始〜終了の範囲内のGPSポイントだけを返す', () => {
    expect(filterLocationPointsBetweenMinutes(points, 30, 60).map((point) => point.id)).toEqual([2, 3]);
    expect(filterLocationPointsBetweenMinutes(points, 0, 0).map((point) => point.id)).toEqual([1]);
  });

  it('端の時刻を画面表示用ラベルに変換する', () => {
    expect(formatTimelineHourLabel(0)).toBe('0時');
    expect(formatTimelineHourLabel(1440)).toBe('24時');
  });

  it('選択中の時刻を HH:MM 形式で表示する', () => {
    expect(formatTimelineTimeLabel(0)).toBe('0:00');
    expect(formatTimelineTimeLabel(30)).toBe('0:30');
    expect(formatTimelineTimeLabel(750)).toBe('12:30');
    expect(formatTimelineTimeLabel(1440)).toBe('24:00');
  });

  it('時刻を0埋め2桁(HH:MM)で表示する（等幅フォントで幅を揃える）', () => {
    expect(formatTimelineTimeLabelPadded(0)).toBe('00:00');
    expect(formatTimelineTimeLabelPadded(586)).toBe('09:46');
    expect(formatTimelineTimeLabelPadded(750)).toBe('12:30');
  });

  it('過去日のルート最大時刻は 24:00 になる', () => {
    expect(computeRouteMaxEndMinutes('2026-05-31', '2026-06-04', 750)).toBe(DAILY_ROUTE_END_MINUTES);
  });

  it('今日のルート最大時刻は現在時刻を 5 分単位に切り捨てた値になる', () => {
    expect(computeRouteMaxEndMinutes('2026-06-04', '2026-06-04', 750)).toBe(750);
    expect(computeRouteMaxEndMinutes('2026-06-04', '2026-06-04', 762)).toBe(760);
    expect(computeRouteMaxEndMinutes('2026-06-04', '2026-06-04', 780)).toBe(780);
  });

  it('今日の 0:05 未満はルート最大時刻が 0 になる（スライダー非表示の条件）', () => {
    expect(computeRouteMaxEndMinutes('2026-06-04', '2026-06-04', 0)).toBe(0);
    expect(computeRouteMaxEndMinutes('2026-06-04', '2026-06-04', 4)).toBe(0);
    expect(computeRouteMaxEndMinutes('2026-06-04', '2026-06-04', 5)).toBe(5);
  });
});
