import type { RouteCoordinate } from '@/features/map/routeMapper';
import { StayPlace } from '@/features/stayPlaces/stayPlaceTypes';
import { distanceMeters } from '@/utils/distance';

/** 滞在場所中心へ吸着する半径。境界値を含む。 */
const STAY_PLACE_SNAP_RADIUS_METERS = 50;
/** 入場・退出を確定するまで同じ状態が続く必要がある連続点数。 */
const REQUIRED_CONSECUTIVE_POINT_COUNT = 3;

/**
 * 位置情報記録セッションだけが保持する吸着状態。
 *
 * SQLiteへ保存せず、再起動時は `INITIAL_STAY_PLACE_SNAP_STATE` から再判定する。
 */
export type StayPlaceSnapState = {
  activeStayPlaceId: number | null;
  candidateStayPlaceId: number | null;
  candidateCount: number;
  outsideCount: number;
};

/** 新規セッション・再起動時に使う未吸着状態。 */
export const INITIAL_STAY_PLACE_SNAP_STATE: StayPlaceSnapState = {
  activeStayPlaceId: null,
  candidateStayPlaceId: null,
  candidateCount: 0,
  outsideCount: 0,
};

/** 吸着解決の出力。 */
export type StayPlaceSnapResult = {
  state: StayPlaceSnapState;
  effective: RouteCoordinate;
  snappedStayPlaceId: number | null;
};

/**
 * Determines the coordinate and stay-place snapping state for a route point.
 *
 * Invalid coordinates and points without a confirmed eligible stay place retain their
 * raw coordinates. Entry and exit transitions require three consecutive qualifying
 * points.
 *
 * @param input - The current snapping state, raw coordinate, and active stay places
 * @returns The coordinate to store, updated snapping state, and snapped stay place when applicable
 */
export function resolveStayPlaceSnap(input: {
  state: StayPlaceSnapState;
  raw: RouteCoordinate;
  activeStayPlaces: StayPlace[];
}): StayPlaceSnapResult {
  const { state, raw, activeStayPlaces } = input;

  if (!isValidCoordinate(raw)) {
    return toRawResult(raw);
  }

  const activeStayPlace =
    state.activeStayPlaceId == null ? null : activeStayPlaces.find((stayPlace) => stayPlace.id === state.activeStayPlaceId);

  if (activeStayPlace) {
    return resolveWhileActive({ state, raw, activeStayPlace });
  }

  const inactiveState = state.activeStayPlaceId == null ? state : INITIAL_STAY_PLACE_SNAP_STATE;
  return resolveWhileInactive({ state: inactiveState, raw, activeStayPlaces });
}

/**
 * Resolves exit hysteresis for the currently snapped stay place.
 *
 * @param input - The current snap state, raw coordinate, and active stay place.
 * @returns The snapped stay-place result while fewer than three consecutive points are outside the radius; otherwise, the raw coordinate with cleared snap state.
 */
function resolveWhileActive(input: { state: StayPlaceSnapState; raw: RouteCoordinate; activeStayPlace: StayPlace }): StayPlaceSnapResult {
  const { state, raw, activeStayPlace } = input;

  if (!isWithinSnapRadius(raw, activeStayPlace)) {
    const outsideCount = state.outsideCount + 1;

    if (outsideCount >= REQUIRED_CONSECUTIVE_POINT_COUNT) {
      return toRawResult(raw);
    }

    return toSnappedResult(activeStayPlace, {
      activeStayPlaceId: activeStayPlace.id,
      candidateStayPlaceId: null,
      candidateCount: 0,
      outsideCount,
    });
  }

  return toSnappedResult(activeStayPlace, {
    activeStayPlaceId: activeStayPlace.id,
    candidateStayPlaceId: null,
    candidateCount: 0,
    outsideCount: 0,
  });
}

/**
 * Resolves the nearest stay-place candidate while snapping is inactive and confirms entry after consecutive candidate points.
 *
 * @param input - The current snap state, raw coordinate, and active stay places.
 * @returns The updated snap state and effective coordinate, snapping to the candidate after three consecutive points.
 */
function resolveWhileInactive(input: {
  state: StayPlaceSnapState;
  raw: RouteCoordinate;
  activeStayPlaces: StayPlace[];
}): StayPlaceSnapResult {
  const { state, raw, activeStayPlaces } = input;
  const candidate = findClosestEligibleStayPlace(raw, activeStayPlaces);

  if (!candidate) {
    return toRawResult(raw);
  }

  const candidateCount = state.candidateStayPlaceId === candidate.id ? state.candidateCount + 1 : 1;

  if (candidateCount >= REQUIRED_CONSECUTIVE_POINT_COUNT) {
    return toSnappedResult(candidate, {
      activeStayPlaceId: candidate.id,
      candidateStayPlaceId: null,
      candidateCount: 0,
      outsideCount: 0,
    });
  }

  return {
    state: {
      activeStayPlaceId: null,
      candidateStayPlaceId: candidate.id,
      candidateCount,
      outsideCount: 0,
    },
    effective: raw,
    snappedStayPlaceId: null,
  };
}

/**
 * Finds the nearest active stay place within the snapping radius.
 *
 * @param raw - The raw route coordinate used to measure proximity
 * @param activeStayPlaces - The active stay places eligible for snapping
 * @returns The nearest eligible stay place, or `null` when none is within the radius
 */
function findClosestEligibleStayPlace(raw: RouteCoordinate, activeStayPlaces: StayPlace[]): StayPlace | null {
  let closest: { stayPlace: StayPlace; distance: number } | null = null;

  for (const stayPlace of activeStayPlaces) {
    if (!isWithinSnapRadius(raw, stayPlace)) {
      continue;
    }

    const distance = distanceMeters(raw, stayPlace);
    if (
      !closest ||
      distance < closest.distance ||
      (distance === closest.distance && compareStayPlaceCreation(stayPlace, closest.stayPlace) < 0)
    ) {
      closest = { stayPlace, distance };
    }
  }

  return closest?.stayPlace ?? null;
}

/**
 * Determines whether a coordinate is within the stay place snapping radius.
 *
 * @param raw - The coordinate to check
 * @param stayPlace - The stay place whose coordinates define the center of the radius
 * @returns `true` if the stay place has valid coordinates and the raw coordinate is within 50 meters of it, `false` otherwise.
 */
function isWithinSnapRadius(raw: RouteCoordinate, stayPlace: StayPlace): boolean {
  return isValidCoordinate(stayPlace) && distanceMeters(raw, stayPlace) <= STAY_PLACE_SNAP_RADIUS_METERS;
}

/**
 * Orders stay places by creation timestamp and then by numeric ID.
 *
 * @param a - The first stay place to compare
 * @param b - The second stay place to compare
 * @returns A negative number if `a` precedes `b`, a positive number if `a` follows `b`, or `0` if their ordering values are equal
 */
function compareStayPlaceCreation(a: StayPlace, b: StayPlace): number {
  const createdAtComparison = a.createdAt.localeCompare(b.createdAt);

  return createdAtComparison !== 0 ? createdAtComparison : a.id - b.id;
}

/**
 * Determines whether a coordinate contains finite latitude and longitude values within valid geographic bounds.
 *
 * @param coordinate - The coordinate to validate
 * @returns `true` if the latitude is between -90 and 90 and the longitude is between -180 and 180, `false` otherwise.
 */
function isValidCoordinate(coordinate: RouteCoordinate): boolean {
  return (
    Number.isFinite(coordinate.latitude) &&
    Number.isFinite(coordinate.longitude) &&
    coordinate.latitude >= -90 &&
    coordinate.latitude <= 90 &&
    coordinate.longitude >= -180 &&
    coordinate.longitude <= 180
  );
}

/**
 * Creates a result that uses the raw coordinate without an active stay-place snap.
 *
 * @returns The raw coordinate with initial snap state and no snapped stay-place ID.
 */
function toRawResult(raw: RouteCoordinate): StayPlaceSnapResult {
  return {
    state: INITIAL_STAY_PLACE_SNAP_STATE,
    effective: raw,
    snappedStayPlaceId: null,
  };
}

/**
 * Creates a result using the stay place's center coordinates.
 *
 * @param stayPlace - The stay place whose coordinates are used
 * @param state - The snap state associated with the result
 * @returns A snapped coordinate result with the stay place ID
 */
function toSnappedResult(stayPlace: StayPlace, state: StayPlaceSnapState): StayPlaceSnapResult {
  return {
    state,
    effective: { latitude: stayPlace.latitude, longitude: stayPlace.longitude },
    snappedStayPlaceId: stayPlace.id,
  };
}
