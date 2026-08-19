import { getPremiumAccessState } from '@/features/premium/revenueCatAccess';
import { resolveActiveStayPlaces } from '@/features/stayPlaces/stayPlaceAccess';
import { getStayPlaces } from '@/features/stayPlaces/stayPlaceRepository';
import type { StayPlace } from '@/features/stayPlaces/stayPlaceTypes';

/**
 * Retrieves stay places active under the current Plus access state for recording.
 *
 * @returns Stay places resolved as active for the current Plus access state
 */
export async function getActiveStayPlacesForRecording(): Promise<StayPlace[]> {
  const [premiumAccessState, stayPlaces] = await Promise.all([getPremiumAccessState(), getStayPlaces()]);
  return resolveActiveStayPlaces(stayPlaces, premiumAccessState.isPlusActive);
}
