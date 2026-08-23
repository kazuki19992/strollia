import * as SQLite from 'expo-sqlite';

import type { VisitedGridInterpolationPoint } from '@/features/location/grid/gridInterpolation';
import { INITIAL_STAY_PLACE_SNAP_STATE, StayPlaceSnapState } from '@/features/stayPlaces/stayPlaceSnapResolver';

/** SQLiteへ永続化するライブ記録中の滞在場所吸着状態。 */
export type PersistedLocationRecordingState = StayPlaceSnapState & {
  /** 吸着状態へ反映済みの最新ライブ観測日時。 */
  lastObservedAt: string | null;
  /** 最後にVisited Gridのセル更新へ利用できた有効座標。 */
  lastVisitedGridPoint: VisitedGridInterpolationPoint | null;
};

/** 未保存時に返す、未吸着のライブ記録状態。 */
export const INITIAL_PERSISTED_LOCATION_RECORDING_STATE: PersistedLocationRecordingState = {
  ...INITIAL_STAY_PLACE_SNAP_STATE,
  lastObservedAt: null,
  lastVisitedGridPoint: null,
};

/** `location_recording_state` のSELECT結果。 */
type LocationRecordingStateRow = StayPlaceSnapState & {
  /** 吸着状態へ反映済みの最新ライブ観測日時。 */
  lastObservedAt: string | null;
  /** 最後にVisited Gridへ反映した観測日時。 */
  lastVisitedGridRecordedAt: string | null;
  /** 最後にVisited Gridへ反映した有効緯度。 */
  lastVisitedGridLatitude: number | null;
  /** 最後にVisited Gridへ反映した有効経度。 */
  lastVisitedGridLongitude: number | null;
};

/** SQLite行の3列が完全かつ有効な場合だけGrid補間起点へ変換する。 */
function toVisitedGridInterpolationPoint(row: LocationRecordingStateRow): VisitedGridInterpolationPoint | null {
  const { lastVisitedGridRecordedAt: recordedAt, lastVisitedGridLatitude: latitude, lastVisitedGridLongitude: longitude } = row;

  if (
    recordedAt == null ||
    latitude == null ||
    longitude == null ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return { recordedAt, latitude, longitude };
}

/**
 * 現在の排他トランザクションからライブ記録状態を取得する。
 *
 * 状態行がない初回起動時は、呼び出し元が安全に更新できる未吸着の初期状態を新しいオブジェクトとして返す。
 */
export async function getLocationRecordingStateInCurrentTransaction(
  runner: SQLite.SQLiteDatabase,
): Promise<PersistedLocationRecordingState> {
  const row = await runner.getFirstAsync<LocationRecordingStateRow>(
    `SELECT active_stay_place_id AS activeStayPlaceId,
            candidate_stay_place_id AS candidateStayPlaceId,
            candidate_count AS candidateCount,
            outside_count AS outsideCount,
            last_observed_at AS lastObservedAt,
            last_visited_grid_recorded_at AS lastVisitedGridRecordedAt,
            last_visited_grid_latitude AS lastVisitedGridLatitude,
            last_visited_grid_longitude AS lastVisitedGridLongitude
     FROM location_recording_state
     WHERE id = 1`,
  );

  if (!row) {
    return { ...INITIAL_PERSISTED_LOCATION_RECORDING_STATE };
  }

  return {
    activeStayPlaceId: row.activeStayPlaceId,
    candidateStayPlaceId: row.candidateStayPlaceId,
    candidateCount: row.candidateCount,
    outsideCount: row.outsideCount,
    lastObservedAt: row.lastObservedAt,
    lastVisitedGridPoint: toVisitedGridInterpolationPoint(row),
  };
}

/**
 * 現在の排他トランザクション内で、ライブ記録状態の単一行を保存する。
 *
 * IDを常に1に固定し、プロセス再起動後も最後に確定したヒステリシス状態を復元できるようにする。
 */
export async function upsertLocationRecordingStateInCurrentTransaction(
  state: PersistedLocationRecordingState,
  updatedAt: string,
  runner: SQLite.SQLiteDatabase,
): Promise<void> {
  await runner.runAsync(
    `INSERT INTO location_recording_state (
       id,
       active_stay_place_id,
       candidate_stay_place_id,
       candidate_count,
       outside_count,
       last_observed_at,
       last_visited_grid_recorded_at,
       last_visited_grid_latitude,
       last_visited_grid_longitude,
       updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       active_stay_place_id = excluded.active_stay_place_id,
       candidate_stay_place_id = excluded.candidate_stay_place_id,
       candidate_count = excluded.candidate_count,
       outside_count = excluded.outside_count,
       last_observed_at = excluded.last_observed_at,
       last_visited_grid_recorded_at = excluded.last_visited_grid_recorded_at,
       last_visited_grid_latitude = excluded.last_visited_grid_latitude,
       last_visited_grid_longitude = excluded.last_visited_grid_longitude,
       updated_at = excluded.updated_at`,
    1,
    state.activeStayPlaceId,
    state.candidateStayPlaceId,
    state.candidateCount,
    state.outsideCount,
    state.lastObservedAt,
    state.lastVisitedGridPoint?.recordedAt ?? null,
    state.lastVisitedGridPoint?.latitude ?? null,
    state.lastVisitedGridPoint?.longitude ?? null,
    updatedAt,
  );
}
