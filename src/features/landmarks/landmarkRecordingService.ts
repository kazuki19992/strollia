import { getPremiumAccessState } from '@/features/premium/revenueCatAccess';

import { getDetectableLandmarkSpots, type LandmarkSpot } from './landmarkCatalog';
import { getVisitedLandmarkSpotIds } from './landmarkVisitRepository';

/**
 * 1配信バッチぶんのスポット検知の可否と対象。
 *
 * `disabled` はPlus無効による明示的な権利消失、`unavailable` は取得の一時的失敗を表す。
 * 前者では滞在状態をリセットし、後者では既存の状態をそのまま保持する。
 */
export type LandmarkDetectionSnapshot =
  | { status: 'enabled'; spots: readonly LandmarkSpot[]; visitedSpotIds: ReadonlySet<string> }
  | { status: 'disabled' }
  | { status: 'unavailable' };

/**
 * 記録時点の契約状態に対応するスポット検知の対象を取得する。
 *
 * ProviderやバックグラウンドTaskがDB・課金実装を直接組み合わせないよう、境界をここへ集約する。
 * スポット実績はPlus限定であり、無料ユーザーでは到達検知自体を行わない。
 */
export async function getLandmarkDetectionSnapshotForRecording(): Promise<LandmarkDetectionSnapshot> {
  try {
    const premiumAccessState = await getPremiumAccessState();

    if (!premiumAccessState.isPlusActive) {
      return { status: 'disabled' };
    }

    return { status: 'enabled', spots: getDetectableLandmarkSpots(), visitedSpotIds: await getVisitedLandmarkSpotIds() };
  } catch (error: unknown) {
    console.warn('Landmark detection snapshot loading failed:', error);
    return { status: 'unavailable' };
  }
}
