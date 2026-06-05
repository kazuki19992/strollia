import type { LocationPoint } from '../types/gps';

/** 日別ルートタイムラインの開始時刻。単位は分。 */
export const DAILY_ROUTE_START_MINUTES = 0;
/** 日別ルートタイムラインの終了時刻。24:00を表す。単位は分。 */
export const DAILY_ROUTE_END_MINUTES = 24 * 60;
/** 日別ルートタイムラインの移動刻み。必要になったらこの値を変更する。 */
export const DAILY_ROUTE_TIME_STEP_MINUTES = 30;

/** 1日の経過分を「0時」「24時」などの表示へ変換する。 */
export function formatTimelineHourLabel(minutes: number): string {
  return `${Math.floor(minutes / 60)}時`;
}

/** 1日の経過分を「H:MM」形式の現在選択時刻の表示へ変換する。 */
export function formatTimelineTimeLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}:${String(remainingMinutes).padStart(2, '0')}`;
}

/** 今日の日付を 'YYYY-MM-DD' 形式で返す。テストでモック可能にするため独立関数として公開。 */
export function getTodayLocalDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** 現在時刻の1日の経過分（0〜1439）を返す。テストでモック可能にするため独立関数として公開。 */
export function getCurrentMinutesOfDay(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * ルート表示の最大終了時刻（分）を計算する純粋関数。
 * 今日の日付は現在時刻を DAILY_ROUTE_TIME_STEP_MINUTES 単位に切り捨て、過去日は DAILY_ROUTE_END_MINUTES。
 */
export function computeRouteMaxEndMinutes(localDate: string, todayLocalDate: string, currentMinutes: number): number {
  if (localDate !== todayLocalDate) return DAILY_ROUTE_END_MINUTES;
  return Math.floor(currentMinutes / DAILY_ROUTE_TIME_STEP_MINUTES) * DAILY_ROUTE_TIME_STEP_MINUTES;
}

/** GPSポイントの記録時刻を、その日の0時からの経過分へ変換する。 */
export function getPointMinutesOfDay(point: LocationPoint): number {
  const recordedAt = new Date(point.recordedAt);
  return recordedAt.getHours() * 60 + recordedAt.getMinutes();
}

/** 選択された時刻までのGPSポイントだけを返す。 */
export function filterLocationPointsUntilMinute(points: LocationPoint[], endMinutes: number): LocationPoint[] {
  return points.filter((point) => getPointMinutesOfDay(point) <= endMinutes);
}
