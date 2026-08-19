import { StayPlace } from '@/features/stayPlaces/stayPlaceTypes';

/** 滞在場所の読み込み状態。共有経路はready以外で位置情報を出力しない。 */
export type StayPlacesStatus = 'loading' | 'ready' | 'error';

/**
 * Compares stay places by creation timestamp, using ascending ID order for ties.
 *
 * @returns A negative number if `a` precedes `b`, a positive number if `a` follows `b`, or `0` if they are equivalent.
 */
function compareStayPlacesByCreation(a: StayPlace, b: StayPlace): number {
  const createdAtComparison = a.createdAt.localeCompare(b.createdAt);

  return createdAtComparison !== 0 ? createdAtComparison : a.id - b.id;
}

/**
 * Determines which stay places are available for the current subscription.
 *
 * @param stayPlaces - The saved stay places to evaluate.
 * @param isPlusActive - Whether the Plus subscription is active.
 * @returns The stay places in registration order, including all places for active Plus subscriptions or only the earliest registered place otherwise.
 */
export function resolveActiveStayPlaces(stayPlaces: StayPlace[], isPlusActive: boolean): StayPlace[] {
  const orderedStayPlaces = [...stayPlaces].sort(compareStayPlacesByCreation);

  return isPlusActive ? orderedStayPlaces : orderedStayPlaces.slice(0, 1);
}
