/** GIFコマの既定（最大）間隔。長い区間ではこの刻みを使う。単位は分。 */
export const GIF_FRAME_STEP_MINUTES = 15;
/** GIFの1コマあたりの表示時間。単位はミリ秒。 */
export const GIF_FRAME_DELAY_MS = 500;
/** GIFの最短再生時間。これに満たない場合はコマ間隔を細かくして尺を確保する。単位はミリ秒。 */
export const GIF_MIN_DURATION_MS = 5000;
/** 区間指定スライダーで開始・終了を最低限離す間隔（後ろが前を追い越さない最短区間）。単位は分。 */
export const GIF_MIN_RANGE_MINUTES = 15;

/**
 * 選択区間の長さから、GIFのコマ間隔（分）を決める。
 * 既定は {@link GIF_FRAME_STEP_MINUTES} 分刻みだが、それでは最短再生時間
 * （{@link GIF_MIN_DURATION_MS}）に満たない場合は、最低コマ数を満たすよう刻みを細かくする。
 *
 * @param rangeMinutes - 選択区間の長さ（分）。
 * @returns コマ間隔（1〜{@link GIF_FRAME_STEP_MINUTES} 分の整数）。
 */
export function resolveGifFrameStepMinutes(rangeMinutes: number): number {
  if (rangeMinutes <= 0) {
    return GIF_FRAME_STEP_MINUTES;
  }

  const minFrames = Math.ceil(GIF_MIN_DURATION_MS / GIF_FRAME_DELAY_MS);
  const stepForMinFrames = Math.floor(rangeMinutes / (minFrames - 1));
  return Math.max(1, Math.min(GIF_FRAME_STEP_MINUTES, stepForMinFrames));
}

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
