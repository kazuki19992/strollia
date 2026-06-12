import { normalizeValue } from './StepSlider';

export type RangeThumb = 'start' | 'end';

/**
 * 動かしたつまみの生値を stepValue へ丸め、開始と終了が常に minSeparation 以上離れるよう
 * クランプして新しい [start, end] を返す（後ろつまみが前つまみを追い越さない）。
 * minSeparation 省略時は stepValue を最短間隔とする。
 *
 * - 'start' を動かすとき: minValue 〜 (end - minSeparation) にクランプ。
 * - 'end' を動かすとき: (start + minSeparation) 〜 maxValue にクランプ。
 */
export function resolveRangeThumbValues(
  thumb: RangeThumb,
  rawValue: number,
  current: { start: number; end: number },
  bounds: { minValue: number; maxValue: number; stepValue: number; minSeparation?: number },
): { start: number; end: number } {
  const { start, end } = current;
  const { minValue, maxValue, stepValue } = bounds;
  const minSeparation = bounds.minSeparation ?? stepValue;
  if (thumb === 'start') {
    const upper = Math.max(minValue, end - minSeparation);
    const next = normalizeValue(rawValue, minValue, upper, stepValue);
    return { start: next, end };
  }
  const lower = Math.min(maxValue, start + minSeparation);
  const next = normalizeValue(rawValue, lower, maxValue, stepValue);
  return { start, end: next };
}
