import type * as Location from 'expo-location';

import { initializeDatabase } from '@/db/database';
import { processAchievementsForSavedPoint } from '@/features/achievements/achievementService';
import { getLatestLocationPoint, insertLocationPoint } from '@/features/logs/logRepository';
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

/**
 * 最新保存点を一度だけ読み込み、位置情報を継続的に保存するセッションを作る。
 *
 * 前景監視では位置情報が1件ずつ届くため、呼び出し間で前回点を保持して
 * 距離・時系列判定とVisited Grid補間を背景タスクの一括処理と一致させる。
 */
export async function createLocationRecordingSession(): Promise<LocationRecordingSession> {
  await initializeDatabase();

  const latestSavedPoint = await getLatestLocationPoint();
  let previousSavedPoint: Parameters<typeof shouldSaveLocationPoint>[1] = latestSavedPoint;
  let previousVisitedCellPoint: ReturnType<typeof toLocationPoint> | null = latestSavedPoint;

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
          const point = toLocationPoint(location);
          const visitedCells = getVisitedCellsForLocationPoint(previousVisitedCellPoint, point);

          if (visitedCells.length > 0) {
            await upsertVisitedCells(visitedCells, point.recordedAt);
            previousVisitedCellPoint = point;
          }

          if (shouldSaveLocationPoint(point, previousSavedPoint)) {
            const locationPointId = await insertLocationPoint(point);
            savedPoints.push({ point, locationPointId });
            previousSavedPoint = point;
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
 * GPXインポート優先モードを終了し、インポート中にバッファへ退避していた位置情報を
 * 通常の保存規則(距離・時系列判定、Visited Grid補間、実績処理)でまとめて取り込む。
 *
 * インポートの成否にかかわらず必ず呼ぶこと(finally推奨)。呼ばないと
 * 位置情報がバッファに残ったまま以後の記録も退避され続ける。
 *
 * 取り込みに失敗した場合は退避分をバッファへ戻してから例外を投げる。
 * 戻した分は次の位置情報受信時(recordLocations)に自動的に回収されるため、
 * 位置情報が失われることはない。
 */
export async function flushLocationsBufferedDuringGpxImport(): Promise<void> {
  const drained = endGpxImportPriorityAndDrain();

  if (drained.length === 0) {
    return;
  }

  try {
    const session = await createLocationRecordingSession();
    await session.recordLocations(drained);
  } catch (error: unknown) {
    // 位置情報を失わないよう退避分を戻す。次の記録時に受信順を保って回収される
    requeueLocationsToBuffer(drained);
    throw error;
  }
}
