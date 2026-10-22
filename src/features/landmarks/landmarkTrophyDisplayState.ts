/** パックトロフィーの表示状態。 */
export type LandmarkTrophyDisplayState = 'dim' | 'grayscale' | 'color';

/** 過半数の境界。50%ちょうどは減光のままとする。 */
const MAJORITY_RATIO = 0.5;

/**
 * 到達率からトロフィーの表示状態を解決する。
 *
 * シルエット(tintColor)は使わない。スポットトロフィーは円の内側が全面不透明なため、
 * tintColorでは単色の丸になりどのパックか判別できなくなる。
 * 減光した白黒 → 白黒 → フルカラーの3段階なら、円形の絵柄でも進行が読み取れる。
 */
export function resolveLandmarkTrophyDisplayState(ratio: number): LandmarkTrophyDisplayState {
  if (!Number.isFinite(ratio) || ratio <= MAJORITY_RATIO) {
    return 'dim';
  }

  return ratio >= 1 ? 'color' : 'grayscale';
}
