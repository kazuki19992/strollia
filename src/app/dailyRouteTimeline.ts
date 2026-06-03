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

/** GPSポイントの記録時刻を、その日の0時からの経過分へ変換する。 */
export function getPointMinutesOfDay(point: LocationPoint): number {
  const recordedAt = new Date(point.recordedAt);
  return recordedAt.getHours() * 60 + recordedAt.getMinutes();
}

/** 選択された時刻までのGPSポイントだけを返す。 */
export function filterLocationPointsUntilMinute(points: LocationPoint[], endMinutes: number): LocationPoint[] {
  return points.filter((point) => getPointMinutesOfDay(point) <= endMinutes);
}
