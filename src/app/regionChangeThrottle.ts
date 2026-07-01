/**
 * ジェスチャー中の表示範囲更新（onRegionChange）を間引くためのスロットル判定。
 *
 * 前回適用時刻から `throttleMs` 以上経過していれば true（今回の更新を適用してよい）。
 *
 * @param lastAppliedMs - 前回更新を適用した時刻（ミリ秒）。
 * @param nowMs - 現在時刻（ミリ秒）。
 * @param throttleMs - 最小更新間隔（ミリ秒）。
 * @returns 今回の更新を適用してよければ true。
 */
export function shouldApplyThrottledRegionChange(lastAppliedMs: number, nowMs: number, throttleMs: number): boolean {
  return nowMs - lastAppliedMs >= throttleMs;
}
