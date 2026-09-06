import { withExclusiveTransaction } from '@/db/database';
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

    const lastVisitedGridPoint =
      visitedCells.length > 0
        ? { recordedAt: effectivePoint.recordedAt, latitude: effectivePoint.latitude, longitude: effectivePoint.longitude }
        : persistedState.lastVisitedGridPoint;
    await upsertLocationRecordingStateInCurrentTransaction(
      { ...snapResult.state, lastObservedAt: rawPoint.recordedAt, lastVisitedGridPoint },
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
