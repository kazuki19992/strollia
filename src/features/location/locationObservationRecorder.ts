import { withExclusiveTransaction } from '@/db/database';
import {
  INITIAL_LANDMARK_ARRIVAL_STATE,
  resolveLandmarkArrival,
  type LandmarkArrivalState,
} from '@/features/landmarks/landmarkArrivalResolver';
import type { LandmarkDetectionSnapshot } from '@/features/landmarks/landmarkRecordingService';
import { insertLandmarkSpotVisitInCurrentTransaction } from '@/features/landmarks/landmarkVisitRepository';
import {
  getLatestLocationPointInCurrentTransaction,
  hasLocationPointRawIdentityInCurrentTransaction,
  insertLocationPointInCurrentTransaction,
} from '@/features/logs/logRepository';
import {
  getLocationRecordingStateInCurrentTransaction,
  PersistedLocationRecordingState,
  upsertLocationRecordingStateInCurrentTransaction,
} from '@/features/location/locationRecordingStateRepository';
import { resolveStayPlaceSnap, StayPlaceSnapState } from '@/features/stayPlaces/stayPlaceSnapResolver';
import { StayPlace } from '@/features/stayPlaces/stayPlaceTypes';
import { NewLocationPoint } from '@/types/gps';
import { toEffectiveLocationPoint } from './effectiveLocationPoint';
import { getVisitedCellsForLocationPoint } from './grid/gridInterpolation';
import { isStaleLocationObservation } from './locationObservationOrder';
import { shouldSaveLocationPoint } from './locationSaveFilter';
import { upsertVisitedCellsInCurrentTransaction } from './visitedCellRepository';

/** 1観測の吸着判定に使う有効滞在場所の取得結果。 */
export type ActiveStayPlacesSnapshot = { status: 'ready'; stayPlaces: StayPlace[] } | { status: 'unavailable' };

/** 原子的な位置観測記録へ渡す入力。 */
export type RecordLocationObservationInput = {
  /** Expo Locationから変換済みの生GPS観測。 */
  rawPoint: NewLocationPoint;
  /** 当該観測で利用できる有効滞在場所一覧、または一時的な取得失敗。 */
  activeStayPlaces: ActiveStayPlacesSnapshot;
  /** 当該配信バッチで利用できるスポット検知の対象、または無効・取得失敗。 */
  landmarkDetection: LandmarkDetectionSnapshot;
  /** DB更新日時。未指定時は呼び出し時刻を使う。 */
  now?: string;
};

/** 原子的な位置観測記録の結果。 */
export type RecordLocationObservationResult =
  { status: 'saved'; point: NewLocationPoint; locationPointId: number } | { status: 'not-saved' } | { status: 'stale' | 'duplicate' };

/** トランザクション内で求めた結果をコールバック外へ受け渡す箱。 */
type RecordLocationObservationResultHolder = {
  value: RecordLocationObservationResult | null;
};

/** 生観測と吸着結果から、保存用の生座標・有効座標を併せ持つ点を作る。 */
function createRecordedPoint(
  rawPoint: NewLocationPoint,
  effective: { latitude: number; longitude: number },
  snappedStayPlaceId: number | null,
): NewLocationPoint {
  return {
    ...rawPoint,
    effectiveLatitude: effective.latitude,
    effectiveLongitude: effective.longitude,
    snappedStayPlaceId,
  };
}

/** 滞在場所取得失敗時にカウンターを変更せず引き継ぐ吸着状態を作る。 */
function preserveSnapState(state: PersistedLocationRecordingState): StayPlaceSnapState {
  return {
    activeStayPlaceId: state.activeStayPlaceId,
    candidateStayPlaceId: state.candidateStayPlaceId,
    candidateCount: state.candidateCount,
    outsideCount: state.outsideCount,
  };
}

/** 永続化された記録状態からスポット到達判定の状態を取り出す。 */
function toLandmarkArrivalState(state: PersistedLocationRecordingState): LandmarkArrivalState {
  return {
    candidateSpotId: state.landmarkCandidateSpotId,
    candidateEnteredAt: state.landmarkCandidateEnteredAt,
    outsideCount: state.landmarkOutsideCount,
  };
}

/**
 * スポット検知の可否に応じて到達判定を行う。
 *
 * Plus無効(`disabled`)は明示的な権利消失のため滞在状態をリセットする。
 * 取得失敗(`unavailable`)は一時的な障害のため、次の正常取得まで滞在状態を保持する。
 */
function resolveLandmarkArrivalForObservation(
  persistedState: PersistedLocationRecordingState,
  rawPoint: NewLocationPoint,
  detection: LandmarkDetectionSnapshot,
): { state: LandmarkArrivalState; arrivedSpotId: string | null } {
  if (detection.status === 'disabled') {
    return { state: INITIAL_LANDMARK_ARRIVAL_STATE, arrivedSpotId: null };
  }

  if (detection.status === 'unavailable') {
    return { state: toLandmarkArrivalState(persistedState), arrivedSpotId: null };
  }

  return resolveLandmarkArrival({
    state: toLandmarkArrivalState(persistedState),
    // 到達判定は生座標で行う。滞在場所への吸着座標を使うと、吸着中の位置が
    // スポット判定へ混入してしまうため。
    observation: { latitude: rawPoint.latitude, longitude: rawPoint.longitude, recordedAt: rawPoint.recordedAt },
    spots: detection.spots,
    visitedSpotIds: detection.visitedSpotIds,
  });
}

/**
 * 1件のライブ位置観測について、吸着状態・GPSログ・日別集計・Visited Gridを原子的に更新する。
 *
 * 古い観測とGPS一意制約の重複はどの状態も進めない。同一GPS観測の再配信だけで
 * 吸着の3点連続やVisited Gridを進めないためであり、滞在場所取得失敗時だけは
 * 生座標を記録しながら既存の吸着カウンターを次の正常取得まで維持する。
 */
export async function recordLocationObservation(input: RecordLocationObservationInput): Promise<RecordLocationObservationResult> {
  const { rawPoint, activeStayPlaces } = input;
  const now = input.now ?? new Date().toISOString();
  const result: RecordLocationObservationResultHolder = { value: null };

  await withExclusiveTransaction(async (txn) => {
    const persistedState = await getLocationRecordingStateInCurrentTransaction(txn);

    if (isStaleLocationObservation(persistedState.lastObservedAt, rawPoint.recordedAt, now)) {
      result.value = { status: 'stale' };
      return;
    }

    const snapResult =
      activeStayPlaces.status === 'ready'
        ? resolveStayPlaceSnap({ state: persistedState, raw: rawPoint, activeStayPlaces: activeStayPlaces.stayPlaces })
        : { state: preserveSnapState(persistedState), effective: rawPoint, snappedStayPlaceId: null };
    const point = createRecordedPoint(rawPoint, snapResult.effective, snapResult.snappedStayPlaceId);
    const effectivePoint = toEffectiveLocationPoint(point);
    const latestSavedPoint = await getLatestLocationPointInCurrentTransaction(txn);
    const previousSavedPoint = latestSavedPoint ? toEffectiveLocationPoint(latestSavedPoint) : null;
    const shouldSave = shouldSaveLocationPoint(effectivePoint, previousSavedPoint);

    if (!shouldSave && (await hasLocationPointRawIdentityInCurrentTransaction(rawPoint, txn))) {
      result.value = { status: 'duplicate' };
      return;
    }

    const visitedCells = getVisitedCellsForLocationPoint(persistedState.lastVisitedGridPoint, effectivePoint);

    let locationPointId: number | null = null;
    if (shouldSave) {
      const inserted = await insertLocationPointInCurrentTransaction(point, now, txn);

      if (!inserted) {
        result.value = { status: 'duplicate' };
        return;
      }

      locationPointId = inserted.locationPointId;
    }

    if (visitedCells.length > 0) {
      await upsertVisitedCellsInCurrentTransaction(visitedCells, rawPoint.recordedAt, txn);
    }

    // スポット到達は保存されない観測も対象にする。停止中はGPS保存フィルタがほとんどの点を
    // 捨てるため、保存点だけを見ていると滞在時間が進まず到達が永久に確定しない。
    const landmarkResult = resolveLandmarkArrivalForObservation(persistedState, rawPoint, input.landmarkDetection);

    if (landmarkResult.arrivedSpotId) {
      await insertLandmarkSpotVisitInCurrentTransaction(
        {
          spotId: landmarkResult.arrivedSpotId,
          visitedAt: rawPoint.recordedAt,
          visitedLocalDate: rawPoint.localDate,
          // 保存対象外の観測で確定した場合は根拠GPS点が存在しないためnullになる
          locationPointId,
        },
        now,
        txn,
      );
    }

    const lastVisitedGridPoint =
      visitedCells.length > 0
        ? { recordedAt: effectivePoint.recordedAt, latitude: effectivePoint.latitude, longitude: effectivePoint.longitude }
        : persistedState.lastVisitedGridPoint;
    await upsertLocationRecordingStateInCurrentTransaction(
      {
        ...snapResult.state,
        lastObservedAt: rawPoint.recordedAt,
        lastVisitedGridPoint,
        // 単一行を丸ごと上書きするため、到達判定で求めた途中状態も必ず書き戻す
        landmarkCandidateSpotId: landmarkResult.state.candidateSpotId,
        landmarkCandidateEnteredAt: landmarkResult.state.candidateEnteredAt,
        landmarkOutsideCount: landmarkResult.state.outsideCount,
      },
      now,
      txn,
    );

    result.value = locationPointId == null ? { status: 'not-saved' } : { status: 'saved', point, locationPointId };
  });

  if (!result.value) {
    throw new Error('Location observation transaction completed without a result.');
  }

  return result.value;
}
