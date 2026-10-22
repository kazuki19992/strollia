import { getConfirmedPremiumAccessState } from '@/features/premium/revenueCatAccess';

import { getDetectableLandmarkSpots, isLandmarkSpotInFreePack, type LandmarkSpot } from './landmarkCatalog';
import { getVisitedLandmarkSpotIds } from './landmarkVisitRepository';

/**
 * 1配信バッチぶんのスポット検知の対象。
 *
 * `enabled` の `spots` は「無料パックのスポット」∪「Plus有効なら有料パックのスポットも含む」で
 * フィルタ済み。検知の可否はパック単位(`isFree`)で決まるため、機能全体を止める `disabled` 状態は
 * 存在しない。`unavailable` は課金状態取得の一時的失敗を表し、次の正常取得まで滞在状態を保持する。
 */
export type LandmarkDetectionSnapshot =
  | { status: 'enabled'; spots: readonly LandmarkSpot[]; visitedSpotIds: ReadonlySet<string> }
  | { status: 'unavailable' };

/**
 * 記録時点の契約状態に対応するスポット検知の対象を取得する。
 *
 * ProviderやバックグラウンドTaskがDB・課金実装を直接組み合わせないよう、境界をここへ集約する。
 * 無料パックのスポットはPlus加入状況に関わらず常に検知対象へ含め、有料パックのスポットは
 * Plus有効時のみ含める。
 */
export async function getLandmarkDetectionSnapshotForRecording(): Promise<LandmarkDetectionSnapshot> {
  try {
    // getPremiumAccessState ではなく confirmed 版を使う。前者はRevenueCatの取得失敗を
    // 既定状態(本番ではPlus無効)へ丸めるため、一時的な通信失敗と「Plus無効」が区別できず、
    // 有料パックの滞在計測を誤ってリセットしてしまう。ここでは失敗を例外のまま受け取り、
    // 下の catch で unavailable(状態を保持)へ落とす。
    const premiumAccessState = await getConfirmedPremiumAccessState();
    const spots = getDetectableLandmarkSpots().filter(
      (spot) => premiumAccessState.isPlusActive || isLandmarkSpotInFreePack(spot),
    );

    return { status: 'enabled', spots, visitedSpotIds: await getVisitedLandmarkSpotIds() };
  } catch (error: unknown) {
    console.warn('Landmark detection snapshot loading failed:', error);
    return { status: 'unavailable' };
  }
}
