import type * as Location from 'expo-location';

import { initializeDatabase } from '@/db/database';
import { processAchievementsForSavedPoint } from '@/features/achievements/achievementService';
import {
  ActiveStayPlacesSnapshot,
  recordLocationObservation,
  RecordLocationObservationResult,
} from '@/features/location/locationObservationRecorder';
import type { StayPlace } from '@/features/stayPlaces/stayPlaceTypes';
import {
  bufferLocationsDuringGpxImport,
  drainBufferedLocations,
  endGpxImportPriorityAndDrain,
  isGpxImportPriorityActive,
  requeueLocationsToBuffer,
} from './gpxImportPriority';
import { toLocationPoint } from './locationMapper';

/** 前景・背景の位置情報を同じ保存規則で処理するセッション。 */
export type LocationRecordingSession = {
  /** 位置情報を観測日時順に原子的なRecorderへ渡す。 */
  recordLocations: (locations: Location.LocationObject[]) => Promise<void>;
};

/** 記録中の各観測点で有効な滞在場所を取得する依存。 */
export type LocationRecordingSessionOptions = {
  /** 課金状態・設定変更を次の配信バッチから反映するため、配信バッチごとに取得する。 */
  getActiveStayPlaces?: () => Promise<StayPlace[]>;
};

/**
 * SQLite初期化後、前景・背景で共通の記録処理を行うセッションを作る。
 *
 * 吸着・GPS保存判定・Visited Grid補間起点は観測ごとにSQLiteの最新状態を読む
 * Recorderへ委譲し、セッションを跨ぐ前景・背景配信でも同じ永続状態を使う。
 */
export async function createLocationRecordingSession(options: LocationRecordingSessionOptions = {}): Promise<LocationRecordingSession> {
  await initializeDatabase();

  return {
    async recordLocations(locations) {
      // GPXインポート中はDB書き込みの競合(SQLITE_BUSY)を避けるため、
      // 位置情報をバッファへ退避してインポート完了後にまとめて取り込む。
      if (isGpxImportPriorityActive()) {
        bufferLocationsDuringGpxImport(locations);
        return;
      }

      // flush失敗などでバッファに残った位置情報も含め、永続状態を時系列順に進める。
      const pendingLocations = drainBufferedLocations();
      const combinedLocations = pendingLocations.length > 0 ? [...pendingLocations, ...locations] : locations;
      const locationsToProcess = combinedLocations
        .map((location, originalIndex) => ({ location, originalIndex }))
        .sort((left, right) => left.location.timestamp - right.location.timestamp || left.originalIndex - right.originalIndex)
        .map(({ location }) => location);

      const savedPoints: { point: ReturnType<typeof toLocationPoint>; locationPointId: number }[] = [];
      // Expoは複数観測を1回のタスク配信へまとめる。設定DBを点ごとに読むと不要な
      // ロック競合を増やすため、この配信全体では同じ有効滞在場所を使う。
      const activeStayPlaces: ActiveStayPlacesSnapshot = await getActiveStayPlacesSnapshot(options.getActiveStayPlaces);
      /** 保存を完了した位置情報の数。途中失敗時に未確定分をバッファへ戻すために追跡する。 */
      let processedCount = 0;
      /** 後続観測が失敗しても、先に確定した点の実績処理後に元のエラーを返すため保持する。 */
      let recordingError: unknown = undefined;
      let hasRecordingError = false;

      try {
        for (const location of locationsToProcess) {
          const rawPoint = toLocationPoint(location);
          const result: RecordLocationObservationResult = await recordLocationObservation({
            rawPoint,
            activeStayPlaces,
          });

          if (result.status === 'saved') {
            savedPoints.push({ point: result.point, locationPointId: result.locationPointId });
          }

          processedCount += 1;
        }
      } catch (error: unknown) {
        // 保存が成功するまで位置情報を失わないよう、未確定分(処理中に失敗した点を含む)を
        // バッファへ戻して次の記録時に受信順を保って再試行する。
        requeueLocationsToBuffer(locationsToProcess.slice(processedCount));
        recordingError = error;
        hasRecordingError = true;
      }

      // GPSポイントを確定してから、逆ジオコーディングを含む実績処理を行う。
      for (const { point, locationPointId } of savedPoints) {
        await processAchievementsForSavedPoint(point, locationPointId).catch((error: unknown) => {
          console.warn('Achievement processing failed:', error);
        });
      }

      if (hasRecordingError) {
        throw recordingError;
      }
    },
  };
}

/** 滞在場所一覧の読込結果を、Recorderが取得失敗と空一覧を区別できる形式へ変換する。 */
async function getActiveStayPlacesSnapshot(
  getActiveStayPlaces: (() => Promise<StayPlace[]>) | undefined,
): Promise<ActiveStayPlacesSnapshot> {
  if (!getActiveStayPlaces) {
    return { status: 'ready', stayPlaces: [] };
  }

  try {
    return { status: 'ready', stayPlaces: await getActiveStayPlaces() };
  } catch (error: unknown) {
    console.warn('Stay place loading failed:', error);
    return { status: 'unavailable' };
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
