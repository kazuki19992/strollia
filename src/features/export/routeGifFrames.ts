/**
 * 区間 [startMinutes, endMinutes] を stepMinutes 刻みにした、各GIFコマの「0時からの経過分」を返す。
 * 終了時刻は必ず最後のコマとして含める。終了が開始以下なら開始のみ。
 *
 * @param startMinutes - 区間開始（0時からの経過分）。
 * @param endMinutes - 区間終了（0時からの経過分）。
 * @param stepMinutes - コマ間隔（分）。
 * @returns 各コマの minute-of-day 配列。
 */
export function computeGifFrameMinutesInRange(startMinutes: number, endMinutes: number, stepMinutes: number): number[] {
  if (endMinutes <= startMinutes) {
    return [startMinutes];
  }

  const frames: number[] = [];
  for (let minute = startMinutes; minute < endMinutes; minute += stepMinutes) {
    frames.push(minute);
  }
  frames.push(endMinutes);
  return frames;
}
