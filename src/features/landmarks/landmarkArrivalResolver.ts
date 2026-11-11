import { distanceMeters } from '@/utils/distance';

import type { LandmarkArea, LandmarkSpot } from './landmarkCatalog';

/** 候補地点の半径外を何回連続で観測したらリセットするか。1点の外れ値を許容する。 */
const REQUIRED_OUTSIDE_OBSERVATION_COUNT = 2;

/** 滞在時間を計測している途中状態。 */
export type LandmarkArrivalState = {
  /**
   * 滞在時間を計測中の地点ID。半径内にいない間はnull。
   * 円1つのスポットは地点ID=スポットIDのため、旧実装が保存したスポットIDの計測状態もそのまま引き継げる。
   */
  candidateAreaId: string | null;
  /** 候補地点の半径内で最初に観測した日時。 */
  candidateEnteredAt: string | null;
  /** 候補地点の半径外を連続観測した回数。 */
  outsideCount: number;
};

/** 未計測の初期状態。 */
export const INITIAL_LANDMARK_ARRIVAL_STATE: LandmarkArrivalState = {
  candidateAreaId: null,
  candidateEnteredAt: null,
  outsideCount: 0,
};

/** 到達判定へ渡すGPS観測。保存されない観測も含む。 */
export type LandmarkArrivalObservation = {
  latitude: number;
  longitude: number;
  /** 観測日時(ISO8601)。経過時間は端末の現在時刻ではなくこの値で計算する。 */
  recordedAt: string;
};

/** 到達が確定した地点とその所属スポット。 */
export type LandmarkAreaArrival = {
  /** 地点が属するスポットのID。 */
  spotId: string;
  /** 到達した地点のID。 */
  areaId: string;
};

/** 到達判定の結果。 */
export type LandmarkArrivalResult = {
  /** 次の観測へ引き継ぐ状態。 */
  state: LandmarkArrivalState;
  /** この観測で到達が確定した地点。未確定ならnull。 */
  arrival: LandmarkAreaArrival | null;
};

/**
 * 1観測ぶんの地点到達を判定する。スポットの到達(全地点の到達)の判断は呼び出し側が行う。
 *
 * 判定は観測回数ではなく時刻差で行う。GPS保存フィルタは停止中の点をほとんど保存しないため、
 * 「滝の前で立ち止まる」ケースでは保存点がほぼ増えない。回数ベースにすると最も達成させたい
 * 状況で滞在時間が進まなくなるため、入場時刻と観測時刻の差で判定する。
 * この設計により、トンネル通過などで観測が数分空いても正しく到達が確定する。
 */
export function resolveLandmarkArrival(input: {
  state: LandmarkArrivalState;
  observation: LandmarkArrivalObservation;
  spots: readonly LandmarkSpot[];
  visitedSpotIds: ReadonlySet<string>;
  /** 到達済みの地点ID。複数地点スポットで、到達済みの地点だけを候補から外すために使う。 */
  visitedAreaIds: ReadonlySet<string>;
}): LandmarkArrivalResult {
  const { state, observation, spots, visitedSpotIds, visitedAreaIds } = input;

  if (!isValidCoordinate(observation)) {
    return { state, arrival: null };
  }

  const candidate = findClosestAreaInRadius(observation, spots, visitedSpotIds, visitedAreaIds);

  if (!candidate) {
    return resolveWhileOutside(state);
  }

  const isSameCandidate = state.candidateAreaId === candidate.area.id;
  const enteredAt = isSameCandidate && state.candidateEnteredAt ? state.candidateEnteredAt : observation.recordedAt;
  const elapsedSeconds = (Date.parse(observation.recordedAt) - Date.parse(enteredAt)) / 1000;

  if (Number.isFinite(elapsedSeconds) && elapsedSeconds >= candidate.area.dwellSeconds) {
    return { state: INITIAL_LANDMARK_ARRIVAL_STATE, arrival: { spotId: candidate.spot.id, areaId: candidate.area.id } };
  }

  return {
    state: { candidateAreaId: candidate.area.id, candidateEnteredAt: enteredAt, outsideCount: 0 },
    arrival: null,
  };
}

/**
 * 候補の半径外を観測したときの状態を解決する。
 *
 * 1点の外れ値では滞在時間をリセットしない。GPSノイズで1点だけ半径外へ飛んだときに
 * 計測がゼロへ戻るのを避けるためで、到達は一度確定すれば取り消されない片方向の判定であり、
 * 誤って早く確定するリスクのほうが小さい。
 */
function resolveWhileOutside(state: LandmarkArrivalState): LandmarkArrivalResult {
  if (state.candidateAreaId == null) {
    return { state: INITIAL_LANDMARK_ARRIVAL_STATE, arrival: null };
  }

  const outsideCount = state.outsideCount + 1;

  if (outsideCount >= REQUIRED_OUTSIDE_OBSERVATION_COUNT) {
    return { state: INITIAL_LANDMARK_ARRIVAL_STATE, arrival: null };
  }

  return { state: { ...state, outsideCount }, arrival: null };
}

/**
 * 観測地点の半径内にある未到達地点のうち最寄りを返す。
 *
 * 到達済みスポットの地点と、到達済みの地点は候補から外す。
 * 同距離の場合は地点ID昇順で安定させる。UUIDv7は生成順に単調増加するため、実質マスタへの登録順になる。
 */
function findClosestAreaInRadius(
  observation: LandmarkArrivalObservation,
  spots: readonly LandmarkSpot[],
  visitedSpotIds: ReadonlySet<string>,
  visitedAreaIds: ReadonlySet<string>,
): { spot: LandmarkSpot; area: LandmarkArea } | null {
  let closest: { spot: LandmarkSpot; area: LandmarkArea; distance: number } | null = null;

  for (const spot of spots) {
    if (spot.retired || visitedSpotIds.has(spot.id)) {
      continue;
    }

    for (const area of spot.areas) {
      if (visitedAreaIds.has(area.id)) {
        continue;
      }

      const distance = distanceMeters(observation, area);

      // 境界値は範囲内として扱う(既存の滞在場所の吸着半径と同じ)
      if (distance > area.radiusMeters) {
        continue;
      }

      if (!closest || distance < closest.distance || (distance === closest.distance && area.id < closest.area.id)) {
        closest = { spot, area, distance };
      }
    }
  }

  return closest ? { spot: closest.spot, area: closest.area } : null;
}

/** 有限値かつ地理座標として有効な緯度経度か判定する。 */
function isValidCoordinate(coordinate: { latitude: number; longitude: number }): boolean {
  return (
    Number.isFinite(coordinate.latitude) &&
    Number.isFinite(coordinate.longitude) &&
    coordinate.latitude >= -90 &&
    coordinate.latitude <= 90 &&
    coordinate.longitude >= -180 &&
    coordinate.longitude <= 180
  );
}
