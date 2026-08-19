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
 * 生座標と現在有効な滞在場所から、この1点に保存する有効座標を決める。
 *
 * 入場・退出とも同じ条件が3点連続した3点目でだけ切り替えるため、先行する
 * 保存済みポイントを後から書き換えない。吸着先が契約変更や削除で無効になった
 * 場合は、この位置更新から直ちに未吸着へ戻す。
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

/** 吸着中の場所に対する退出ヒステリシスを解決する。 */
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

/** 未吸着時の最寄り候補と入場ヒステリシスを解決する。 */
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

/** 半径内の滞在場所から最寄りを選び、同距離では作成日時・ID順で安定させる。 */
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

/** 指定地点が滞在場所の吸着半径内か判定する。 */
function isWithinSnapRadius(raw: RouteCoordinate, stayPlace: StayPlace): boolean {
  return isValidCoordinate(stayPlace) && distanceMeters(raw, stayPlace) <= STAY_PLACE_SNAP_RADIUS_METERS;
}

/** 作成日時、同時刻ならIDで滞在場所を安定して比較する。 */
function compareStayPlaceCreation(a: StayPlace, b: StayPlace): number {
  const createdAtComparison = a.createdAt.localeCompare(b.createdAt);

  return createdAtComparison !== 0 ? createdAtComparison : a.id - b.id;
}

/** 有限値かつ地理座標として有効な緯度経度か判定する。 */
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

/** 吸着解除後または無効入力時の生座標結果を作る。 */
function toRawResult(raw: RouteCoordinate): StayPlaceSnapResult {
  return {
    state: INITIAL_STAY_PLACE_SNAP_STATE,
    effective: raw,
    snappedStayPlaceId: null,
  };
}

/** 吸着中の中心座標を使う結果を作る。 */
function toSnappedResult(stayPlace: StayPlace, state: StayPlaceSnapState): StayPlaceSnapResult {
  return {
    state,
    effective: { latitude: stayPlace.latitude, longitude: stayPlace.longitude },
    snappedStayPlaceId: stayPlace.id,
  };
}
