import { NewLocationPoint } from '../../types/gps';
import { distanceMeters } from '../../utils/distance';
import { estimateAcceptedSegmentSpeedMps } from './locationSpeed';

/** 品質判定が観測を保存しない理由。 */
export type LocationQualityReason =
  | 'accuracy-too-low'
  | 'duplicate-or-jitter'
  | 'jump-suspected'
  | 'stationary-drift'
  | 'pending-track-confirmation';

/** raw GPS観測をaccepted、provisional、rejectedへ分けた結果。 */
export type LocationQualityDecision =
  | { type: 'accepted'; point: NewLocationPoint }
  | { type: 'provisional'; point: NewLocationPoint; reason: LocationQualityReason }
  | { type: 'rejected'; reason: LocationQualityReason };

/** GPS観測を品質判定するための短い履歴窓。 */
export type LocationQualityContext = {
  /** 品質判定済みの直近保存対象点。 */
  acceptedPoints: NewLocationPoint[];
  /** 軌道継続を確認中の保留点。 */
  provisionalPoints: NewLocationPoint[];
};

/** どの状態でも保存判定へ使わない水平方向精度の上限。 */
const ABSOLUTE_MAX_ACCURACY_METERS = 80;
/** 品質判定へ渡すaccepted点の最大窓長。 */
const ACCEPTED_WINDOW_SIZE = 6;
/** accepted点の重複や細かな揺れとして捨てる距離。 */
const MIN_ACCEPTED_DISTANCE_METERS = 5;
/** 短時間に超えると飛び点を疑う区間速度。 */
const JUMP_SUSPECT_SPEED_MPS = 70;
/** 停止中とみなす直近accepted点のクラスタ半径。 */
const STATIONARY_CLUSTER_RADIUS_METERS = 25;
/** 停止クラスタからこの距離以内の散りはドリフトとして落とす。 */
const STATIONARY_DRIFT_ESCAPE_METERS = 20;
/** 停止クラスタ離脱をacceptedに昇格するまでに必要な保留点数。 */
const STATIONARY_ESCAPE_CONFIRMATION_COUNT = 4;
/** 停止クラスタから十分に離脱したとみなす距離。 */
const STATIONARY_ESCAPE_MIN_ANCHOR_DISTANCE_METERS = 40;
/** 停止クラスタ離脱として扱うために必要な保留点列の移動量。 */
const STATIONARY_ESCAPE_MIN_PATH_LENGTH_METERS = 30;
/** 保留点を新しい軌道として確定するまでに必要な点数。 */
const PROVISIONAL_CONFIRMATION_COUNT = 3;
/** provisional点列をacceptedへ昇格する最大平均accuracy。 */
const PROVISIONAL_MAX_AVERAGE_ACCURACY_METERS = 35;
/** provisional点列の区間速度ばらつき許容倍率。 */
const PROVISIONAL_MAX_SPEED_RATIO = 4;
/** 保留軌道から戻ったとみなす直近accepted点との距離。 */
const RETURN_TO_ACCEPTED_RADIUS_METERS = 35;

/**
 * GPS軌跡品質判定へ渡す履歴窓を作る。
 *
 * @param acceptedPoints - 品質判定済みの直近保存対象点。
 * @param provisionalPoints - 軌道継続を確認中の保留点。
 * @returns 判定に必要な短い履歴窓。
 */
export function createLocationQualityContext(
  acceptedPoints: NewLocationPoint[],
  provisionalPoints: NewLocationPoint[] = [],
): LocationQualityContext {
  return {
    acceptedPoints: acceptedPoints.slice(-ACCEPTED_WINDOW_SIZE),
    provisionalPoints,
  };
}

/**
 * raw GPS観測を保存対象、保留、破棄へ分類する。
 *
 * @param point - 新しく取得したGPS観測。
 * @param context - accepted点と保留点の短い履歴窓。
 * @returns 観測品質に基づく保存判断。
 */
export function evaluateLocationPointQuality(point: NewLocationPoint, context: LocationQualityContext): LocationQualityDecision {
  const accuracy = point.accuracy ?? ABSOLUTE_MAX_ACCURACY_METERS;

  if (accuracy > ABSOLUTE_MAX_ACCURACY_METERS) {
    return { type: 'rejected', reason: 'accuracy-too-low' };
  }

  const previousAccepted = context.acceptedPoints.at(-1);

  if (!previousAccepted) {
    return accuracy <= 50 ? { type: 'accepted', point } : { type: 'rejected', reason: 'accuracy-too-low' };
  }

  const distance = distanceMeters(previousAccepted, point);

  if (distance < MIN_ACCEPTED_DISTANCE_METERS) {
    return { type: 'rejected', reason: 'duplicate-or-jitter' };
  }

  const stationaryDriftDecision = rejectStationaryDrift(point, context, previousAccepted);

  if (stationaryDriftDecision) {
    return stationaryDriftDecision;
  }

  if (estimateAcceptedSegmentSpeedMps(previousAccepted, point) > JUMP_SUSPECT_SPEED_MPS) {
    return { type: 'provisional', point, reason: 'jump-suspected' };
  }

  return { type: 'accepted', point };
}

/** 1観測ぶん品質判定コンテキストを前進させた結果。 */
export type LocationQualityAdvance = {
  /** 今回観測の判定結果。 */
  decision: LocationQualityDecision;
  /** 今回新たにDB保存へ渡すaccepted点。 */
  acceptedPoints: NewLocationPoint[];
  /** 次観測へ渡す品質判定コンテキスト。 */
  context: LocationQualityContext;
};

/**
 * 1つのGPS観測を品質判定し、accepted点と保留窓を更新する。
 *
 * @param point - 新しく取得したGPS観測。
 * @param context - 直前観測までの品質判定コンテキスト。
 * @returns 保存対象点と次観測用コンテキスト。
 */
export function advanceLocationQualityContext(point: NewLocationPoint, context: LocationQualityContext): LocationQualityAdvance {
  const previousAccepted = context.acceptedPoints.at(-1);

  if (
    previousAccepted &&
    context.provisionalPoints.length > 0 &&
    distanceMeters(previousAccepted, point) <= RETURN_TO_ACCEPTED_RADIUS_METERS
  ) {
    return {
      decision: { type: 'rejected', reason: 'jump-suspected' },
      acceptedPoints: [],
      context: createLocationQualityContext(context.acceptedPoints),
    };
  }

  const decision = evaluateLocationPointQuality(point, context);

  if (context.provisionalPoints.length > 0 && decision.type !== 'rejected') {
    return confirmProvisionalTrack(point, context, decision);
  }

  if (decision.type === 'accepted') {
    return {
      decision,
      acceptedPoints: [decision.point],
      context: createLocationQualityContext([...context.acceptedPoints, decision.point]),
    };
  }

  if (decision.type === 'rejected') {
    return { decision, acceptedPoints: [], context };
  }

  return confirmProvisionalTrack(point, context, decision);
}

/** 保留中の軌道へ候補点を足し、必要点数に達した場合だけまとめて確定する。 */
function confirmProvisionalTrack(
  point: NewLocationPoint,
  context: LocationQualityContext,
  decision: Exclude<LocationQualityDecision, { type: 'rejected' }>,
): LocationQualityAdvance {
  const provisionalPoints = [...context.provisionalPoints, point];
  const anchor = context.acceptedPoints.at(-1);

  if (anchor && isStationaryCluster(context.acceptedPoints) && !isReliableStationaryEscapeTrack(anchor, provisionalPoints)) {
    return {
      decision,
      acceptedPoints: [],
      context: createLocationQualityContext(context.acceptedPoints, provisionalPoints),
    };
  }

  if (provisionalPoints.length < PROVISIONAL_CONFIRMATION_COUNT || !isReliableProvisionalTrack(provisionalPoints)) {
    return {
      decision,
      acceptedPoints: [],
      context: createLocationQualityContext(context.acceptedPoints, provisionalPoints),
    };
  }

  return {
    decision: { type: 'accepted', point },
    acceptedPoints: provisionalPoints,
    context: createLocationQualityContext([...context.acceptedPoints, ...provisionalPoints]),
  };
}

/** 保留点列が停止クラスタから十分に離脱した実移動らしいか判定する。 */
function isReliableStationaryEscapeTrack(anchor: NewLocationPoint, provisionalPoints: NewLocationPoint[]): boolean {
  const latest = provisionalPoints.at(-1);

  if (!latest || provisionalPoints.length < STATIONARY_ESCAPE_CONFIRMATION_COUNT) {
    return false;
  }

  return (
    distanceMeters(anchor, latest) >= STATIONARY_ESCAPE_MIN_ANCHOR_DISTANCE_METERS &&
    totalPathDistanceMeters(provisionalPoints) >= STATIONARY_ESCAPE_MIN_PATH_LENGTH_METERS
  );
}

/** 保留点列が通常の新しい軌道として十分信頼できるか判定する。 */
function isReliableProvisionalTrack(points: NewLocationPoint[]): boolean {
  return hasGoodAverageAccuracy(points) && hasStableSegmentSpeeds(points);
}

/** 点列の平均accuracyが保存に十分か判定する。 */
function hasGoodAverageAccuracy(points: NewLocationPoint[]): boolean {
  const averageAccuracy =
    points.reduce((total, point) => total + (point.accuracy ?? ABSOLUTE_MAX_ACCURACY_METERS), 0) / Math.max(points.length, 1);

  return averageAccuracy <= PROVISIONAL_MAX_AVERAGE_ACCURACY_METERS;
}

/** 点列内の区間速度が極端にばらつかないか判定する。 */
function hasStableSegmentSpeeds(points: NewLocationPoint[]): boolean {
  const speeds = points
    .slice(1)
    .map((point, index) => estimateAcceptedSegmentSpeedMps(points[index], point))
    .filter((speed) => speed > 0);

  if (speeds.length < 2) {
    return true;
  }

  const minSpeed = Math.min(...speeds);
  const maxSpeed = Math.max(...speeds);

  return maxSpeed / minSpeed <= PROVISIONAL_MAX_SPEED_RATIO;
}

/** 点列内の隣接点距離を合計する。 */
function totalPathDistanceMeters(points: NewLocationPoint[]): number {
  return points.reduce((total, point, index) => {
    const previous = points[index - 1];
    return previous ? total + distanceMeters(previous, point) : total;
  }, 0);
}

/** accepted点が狭い範囲へ留まる停止クラスタか判定する。 */
function isStationaryCluster(points: NewLocationPoint[]): boolean {
  if (points.length < 3) {
    return false;
  }

  const anchor = points[0];
  return points.every((candidate) => distanceMeters(anchor, candidate) <= STATIONARY_CLUSTER_RADIUS_METERS);
}

/** 停止クラスタ周辺の散りを保存せず、離脱候補は保留へ回す。 */
function rejectStationaryDrift(
  point: NewLocationPoint,
  context: LocationQualityContext,
  previousAccepted: NewLocationPoint,
): LocationQualityDecision | null {
  if (!isStationaryCluster(context.acceptedPoints)) {
    return null;
  }

  return distanceMeters(previousAccepted, point) <= STATIONARY_DRIFT_ESCAPE_METERS
    ? { type: 'rejected', reason: 'stationary-drift' }
    : { type: 'provisional', point, reason: 'pending-track-confirmation' };
}
