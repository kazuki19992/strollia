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
 * 最新保存点を一度だけ読み込み、位置情報を継続的に保存するセッションを作る。
 *
 * 前景監視では位置情報が1件ずつ届くため、呼び出し間で前回点を保持して
 * 距離・時系列判定とVisited Grid補間を背景タスクの一括処理と一致させる。
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
      /** 保存を完了した位置情報の数。途中失敗時に未確定分をバッファへ戻すために追跡する。 */
      let processedCount = 0;

      try {
        for (const location of locationsToProcess) {
          const rawPoint = toLocationPoint(location);
          const activeStayPlaces = await getActiveStayPlacesSafely(options.getActiveStayPlaces);
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

/** 滞在場所一覧の読込失敗時も生座標の記録を止めないため、吸着なしへ安全にフォールバックする。 */
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
 * GPXインポート優先モードを終了し、インポート中にバッファへ退避していた位置情報を
 * 通常の保存規則(距離・時系列判定、Visited Grid補間、実績処理)でまとめて取り込む。
 *
 * インポートの成否にかかわらず必ず呼ぶこと(finally推奨)。呼ばないと
 * 位置情報がバッファに残ったまま以後の記録も退避され続ける。
 *
 * 取り込みに失敗した場合も位置情報は失われない:
 * - セッション生成の失敗: 退避分をこの関数がバッファへ戻す
 * - 保存処理の途中失敗: recordLocations 自身が未確定分だけをバッファへ戻す
 *   (この関数では戻さない。両方で戻すと同じ位置情報が二重にバッファへ入り、
 *   次回再処理で重複保存や daily_logs の重複加算につながるため)
 * 戻した分は次の位置情報受信時(recordLocations)に受信順を保って回収される。
 */
export async function flushLocationsBufferedDuringGpxImport(): Promise<void> {
  const drained = endGpxImportPriorityAndDrain();

  if (drained.length === 0) {
    return;
  }

  let session: LocationRecordingSession;
  try {
    session = await createLocationRecordingSession();
  } catch (error: unknown) {
    // recordLocations へ渡る前の失敗はここで戻す(渡った後の失敗は recordLocations が戻す)
    requeueLocationsToBuffer(drained);
    throw error;
  }

  await session.recordLocations(drained);
}
