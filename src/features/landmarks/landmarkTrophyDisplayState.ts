/** パックトロフィーの表示状態。 */
export type LandmarkTrophyDisplayState = 'silhouette' | 'grayscale' | 'color';

/** 過半数の境界。50%ちょうどはシルエットのままとする。 */
const MAJORITY_RATIO = 0.5;

/**
 * 到達率からトロフィーの表示状態を解決する。
 *
 * 通常の実績トロフィーと同じく、シルエット → 白黒 → フルカラーの3段階で進行を表す。
 * 以前のトロフィーは円形の絵柄で形が共通だったためシルエットにするとどのパックか判別できず、
 * 減光した白黒で代用していた。パックごとにトロフィーの形が異なるようになったため、シルエットに揃えた。
 */
export function resolveLandmarkTrophyDisplayState(ratio: number): LandmarkTrophyDisplayState {
  if (!Number.isFinite(ratio) || ratio <= MAJORITY_RATIO) {
    return 'silhouette';
  }

  return ratio >= 1 ? 'color' : 'grayscale';
}
