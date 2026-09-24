import { LANDMARK_PACKS, getActiveSpotsForPack } from './landmarkCatalog';

/** パック1件の到達進捗。 */
export type LandmarkPackProgress = {
  /** 対象パックのUUIDv7。 */
  packId: string;
  /** 到達済みスポット数。 */
  visitedCount: number;
  /** 完走に必要なスポット数(retiredを除く)。 */
  totalCount: number;
};

/**
 * 到達済みスポットIDからパックごとの進捗を求める。
 *
 * 到達済みIDの集合ではなくマスタ側を起点に数えるため、マスタから消えたスポットの
 * 到達記録が残っていても分子が分母を超えない。
 * 同一スポットが複数パックに属する場合、1回の到達で該当する全パックの進捗が進む。
 */
export function resolveLandmarkPackProgress(visitedSpotIds: ReadonlySet<string>): LandmarkPackProgress[] {
  return LANDMARK_PACKS.map((pack) => {
    const spots = getActiveSpotsForPack(pack.id);

    return {
      packId: pack.id,
      visitedCount: spots.filter((spot) => visitedSpotIds.has(spot.id)).length,
      totalCount: spots.length,
    };
  });
}
