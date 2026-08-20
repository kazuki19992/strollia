import { getPremiumAccessState } from '@/features/premium/revenueCatAccess';
import { resolveActiveStayPlaces } from '@/features/stayPlaces/stayPlaceAccess';
import { getStayPlaces } from '@/features/stayPlaces/stayPlaceRepository';
import type { StayPlace } from '@/features/stayPlaces/stayPlaceTypes';

/**
 * 記録時点の契約状態に対応する有効な滞在場所を取得する。
 *
 * ProviderやバックグラウンドTaskがDB・課金実装を直接組み合わせないよう、吸着用途の
 * 読み込み境界をここへ集約する。
 */
export async function getActiveStayPlacesForRecording(): Promise<StayPlace[]> {
  const [premiumAccessState, stayPlaces] = await Promise.all([getPremiumAccessState(), getStayPlaces()]);
  return resolveActiveStayPlaces(stayPlaces, premiumAccessState.isPlusActive);
}
