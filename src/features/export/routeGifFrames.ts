import type { LocationPoint } from '../../types/gps';
import { getPointMinutesOfDay } from '../../app/dailyRouteTimeline';

/**
 * その日の点列から、累積GIFの各コマが表す「0時からの経過分」を算出する。
 * 最初の点の時刻から最後の点の時刻まで stepMinutes 刻みで進め、最後の時刻を必ず含める。
 *
 * @param points - 時刻昇順のGPSポイント。
 * @param stepMinutes - コマ間隔（分）。
 * @returns 各コマの minute-of-day 配列。点が1つ以下なら空配列。
 */
export function computeGifFrameMinutes(points: LocationPoint[], stepMinutes: number): number[] {
  if (points.length < 2) {
    return [];
  }

  const firstMinute = getPointMinutesOfDay(points[0]);
  const lastMinute = getPointMinutesOfDay(points[points.length - 1]);

  const frames: number[] = [];
  for (let minute = firstMinute; minute < lastMinute; minute += stepMinutes) {
    frames.push(minute);
  }
  frames.push(lastMinute);
  return frames;
}
