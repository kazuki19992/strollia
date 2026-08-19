import type * as Location from 'expo-location';

import { initializeDatabase } from '@/db/database';
import { processAchievementsForSavedPoint } from '@/features/achievements/achievementService';
import { getLatestLocationPoint, insertLocationPoint } from '@/features/logs/logRepository';
import { toEffectiveLocationPoint } from '@/features/location/effectiveLocationPoint';
import { INITIAL_STAY_PLACE_SNAP_STATE, resolveStayPlaceSnap, StayPlaceSnapState } from '@/features/stayPlaces/stayPlaceSnapResolver';
import { StayPlace } from '@/features/stayPlaces/stayPlaceTypes';
import { NewLocationPoint } from '@/types/gps';
import {
  bufferLocationsDuringGpxImport,
  drainBufferedLocations,
  endGpxImportPriorityAndDrain,
  isGpxImportPriorityActive,
  requeueLocationsToBuffer,
} from './gpxImportPriority';
import { getVisitedCellsForLocationPoint } from './grid/gridInterpolation';
import { toLocationPoint } from './locationMapper';
import { shouldSaveLocationPoint } from './locationSaveFilter';
import { upsertVisitedCells } from './visitedCellRepository';

/** 前景・背景の位置情報を同じ保存規則で処理するセッション。 */
export type LocationRecordingSession = {
  /** 位置情報を受信順に処理し、前回点を次回呼び出しへ引き継ぐ。 */
  recordLocations: (locations: Location.LocationObject[]) => Promise<void>;
};

/** 記録中の各観測点で有効な滞在場所を取得する依存。 */
export type LocationRecordingSessionOptions = {
  /** 課金状態・設定変更を次の観測から反映するため、ポイントごとに取得する。 */
  getActiveStayPlaces?: () => Promise<StayPlace[]>;
};

/**
 * Creates a session that continuously records location updates while preserving state between calls.
 *
 * Initializes the database and loads the latest saved location once. Location updates received during
 * GPX import are buffered for later processing.
 *
 * @param options - Optional configuration for loading active stay places used for location snapping.
 * @returns A location recording session.
 */
export async function createLocationRecordingSession(options: LocationRecordingSessionOptions = {}): Promise<LocationRecordingSession> {
  await initializeDatabase();

  const latestSavedPoint = await getLatestLocationPoint();
  let previousSavedPoint: Parameters<typeof shouldSaveLocationPoint>[1] = latestSavedPoint
    ? toEffectiveLocationPoint(latestSavedPoint)
    : null;
  let previousVisitedCellPoint: NewLocationPoint | null = latestSavedPoint ? toEffectiveLocationPoint(latestSavedPoint) : null;
  let snapState: StayPlaceSnapState = INITIAL_STAY_PLACE_SNAP_STATE;

  return {
    async recordLocations(locations) {
      // GPXインポート中はDB書き込みの競合(SQLITE_BUSY)を避けるため、
      // 位置情報をバッファへ退避してインポート完了後にまとめて取り込む。
      if (isGpxImportPriorityActive()) {
        bufferLocationsDuringGpxImport(locations);
        return;
      }

      // flush失敗などでバッファに残った位置情報があれば、受信順を保って先に処理する(取りこぼし防止)
      const pendingLocations = drainBufferedLocations();
      const locationsToProcess = pendingLocations.length > 0 ? [...pendingLocations, ...locations] : locations;

      const savedPoints: { point: ReturnType<typeof toLocationPoint>; locationPointId: number }[] = [];
      // Expoは複数観測を1回のタスク配信へまとめる。設定DBを点ごとに読むと不要な
      // ロック競合を増やすため、この配信全体では同じ有効滞在場所を使う。
      const activeStayPlaces = await getActiveStayPlacesSafely(options.getActiveStayPlaces);
      /** 保存を完了した位置情報の数。途中失敗時に未確定分をバッファへ戻すために追跡する。 */
      let processedCount = 0;

      try {
        for (const location of locationsToProcess) {
          const rawPoint = toLocationPoint(location);
          const snapResult = resolveStayPlaceSnap({
            state: snapState,
            raw: rawPoint,
            activeStayPlaces,
          });
          snapState = snapResult.state;
          const point: NewLocationPoint = {
            ...rawPoint,
            effectiveLatitude: snapResult.effective.latitude,
            effectiveLongitude: snapResult.effective.longitude,
            snappedStayPlaceId: snapResult.snappedStayPlaceId,
          };
          const effectivePoint = toEffectiveLocationPoint(point);
          const visitedCells = getVisitedCellsForLocationPoint(previousVisitedCellPoint, effectivePoint);

          if (visitedCells.length > 0) {
            await upsertVisitedCells(visitedCells, effectivePoint.recordedAt);
            previousVisitedCellPoint = effectivePoint;
          }

          if (shouldSaveLocationPoint(effectivePoint, previousSavedPoint)) {
            const locationPointId = await insertLocationPoint(point);
            savedPoints.push({ point, locationPointId });
            previousSavedPoint = effectivePoint;
          }

          processedCount += 1;
        }
      } catch (error: unknown) {
        // 保存が成功するまで位置情報を失わないよう、未確定分(処理中に失敗した点を含む)を
        // バッファへ戻して次の記録時に受信順を保って再試行する。
        requeueLocationsToBuffer(locationsToProcess.slice(processedCount));
        throw error;
      }

      // GPSポイントを確定してから、逆ジオコーディングを含む実績処理を行う。
      for (const { point, locationPointId } of savedPoints) {
        await processAchievementsForSavedPoint(point, locationPointId).catch((error: unknown) => {
          console.warn('Achievement processing failed:', error);
        });
      }
    },
  };
}

/**
 * Loads the active stay places while allowing location recording to continue if loading fails.
 *
 * @param getActiveStayPlaces - Optional function that loads the active stay places.
 * @returns The active stay places, or an empty list when no loader is configured or loading fails.
 */
async function getActiveStayPlacesSafely(getActiveStayPlaces: (() => Promise<StayPlace[]>) | undefined): Promise<StayPlace[]> {
  if (!getActiveStayPlaces) {
    return [];
  }

  try {
    return await getActiveStayPlaces();
  } catch (error: unknown) {
    console.warn('Stay place loading failed:', error);
    return [];
  }
}

/**
 * Ends GPX import priority and processes buffered locations using normal recording rules.
 *
 * Buffered locations are restored if session creation fails. Processing failures preserve
 * unconfirmed locations through the recording session and propagate the error.
 */
export async function flushLocationsBufferedDuringGpxImport(options: LocationRecordingSessionOptions = {}): Promise<void> {
  const drained = endGpxImportPriorityAndDrain();

  if (drained.length === 0) {
    return;
  }

  let session: LocationRecordingSession;
  try {
    session = await createLocationRecordingSession(options);
  } catch (error: unknown) {
    // recordLocations へ渡る前の失敗はここで戻す(渡った後の失敗は recordLocations が戻す)
    requeueLocationsToBuffer(drained);
    throw error;
  }

  await session.recordLocations(drained);
}
