import { normalizeValue } from './StepSlider';

export type RangeThumb = 'start' | 'end';

/**
 * 動かしたつまみの生値をステップへ丸め、開始<終了が常に stepValue 以上離れるようクランプして
 * 新しい [start, end] を返す。
 *
 * - 'start' を動かすとき: minValue 〜 (end - stepValue) にクランプ。
 * - 'end' を動かすとき: (start + stepValue) 〜 maxValue にクランプ。
 */
export function resolveRangeThumbValues(
  thumb: RangeThumb,
  rawValue: number,
  current: { start: number; end: number },
  bounds: { minValue: number; maxValue: number; stepValue: number },
): { start: number; end: number } {
  const { start, end } = current;
  const { minValue, maxValue, stepValue } = bounds;
  if (thumb === 'start') {
    const upper = Math.max(minValue, end - stepValue);
    const next = normalizeValue(rawValue, minValue, upper, stepValue);
    return { start: next, end };
  }
  const lower = Math.min(maxValue, start + stepValue);
  const next = normalizeValue(rawValue, lower, maxValue, stepValue);
  return { start, end: next };
}
