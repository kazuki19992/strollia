import { db } from '../../db/database';
import { LocationPoint } from '../../types/gps';
import { totalDistanceMeters } from '../../utils/distance';
import { ACHIEVEMENT_DEFINITIONS, AchievementDefinition, getAchievementDefinition } from './achievementDefinitions';
import { AchievementProgress, evaluateAchievementUnlocks, getProgressValueForCondition } from './achievementEvaluator';

/** SQLiteから取得する解除済み実績行。 */
export type AchievementUnlock = {
  achievementId: string;
  unlockedAt: string;
  progressValue: number | null;
};

/** 実績画面で表示する実績状態。 */
export type AchievementListItem = {
  definition: AchievementDefinition;
  unlockedAt: string | null;
  progressValue: number;
};

/** アプリ内表示が未完了の解除通知。 */
export type PendingAchievementNotification = {
  queueId: number;
  definition: AchievementDefinition;
};

/** 現在の進捗をSQLiteの集計テーブルから取得する。 */
export async function getAchievementProgress(): Promise<AchievementProgress> {
  const [dailyDistanceRows, logDaysRow, prefectureRow, municipalityRow] = await Promise.all([
    db.getAllAsync<{ localDate: string; distanceMeters: number | null }>(
      'SELECT local_date as localDate, distance_meters as distanceMeters FROM daily_logs',
    ),
    db.getFirstAsync<{ logDays: number }>('SELECT COUNT(*) as logDays FROM daily_logs WHERE point_count > 0'),
    db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM visited_admin_areas WHERE area_type = 'prefecture'"),
    db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM visited_admin_areas WHERE area_type = 'municipality'"),
  ]);

  return {
    totalDistanceMeters: await calculateTotalDistanceMeters(dailyDistanceRows),
    logDays: logDaysRow?.logDays ?? 0,
    prefectureCount: prefectureRow?.count ?? 0,
    municipalityCount: municipalityRow?.count ?? 0,
  };
}


/**
 * daily_logsの距離合計を計算し、NULLの日はGPSポイントからフォールバック計算する。
 *
 * @param dailyDistanceRows - daily_logsから取得した日別距離行。
 * @returns 実績評価で使う総移動距離メートル。
 */
async function calculateTotalDistanceMeters(dailyDistanceRows: { localDate: string; distanceMeters: number | null }[]): Promise<number> {
  const fixedDistance = dailyDistanceRows.reduce((total, row) => total + (row.distanceMeters ?? 0), 0);
  const fallbackDates = dailyDistanceRows.filter((row) => row.distanceMeters == null).map((row) => row.localDate);

  if (fallbackDates.length === 0) {
    return fixedDistance;
  }

  const placeholders = fallbackDates.map(() => '?').join(', ');
  const points = await db.getAllAsync<LocationPoint>(
    `SELECT
      id,
      recorded_at as recordedAt,
      local_date as localDate,
      latitude,
      longitude,
      altitude,
      speed,
      heading,
      accuracy,
      altitude_accuracy as altitudeAccuracy,
      source,
      created_at as createdAt
     FROM location_points
     WHERE local_date IN (${placeholders})
     ORDER BY local_date ASC, recorded_at ASC, id ASC`,
    ...fallbackDates,
  );
  const pointsByDate = new Map<string, LocationPoint[]>();

  for (const point of points) {
    const datePoints = pointsByDate.get(point.localDate) ?? [];
    datePoints.push(point);
    pointsByDate.set(point.localDate, datePoints);
  }

  const fallbackDistance = fallbackDates.reduce((total, localDate) => total + totalDistanceMeters(pointsByDate.get(localDate) ?? []), 0);

  return fixedDistance + fallbackDistance;
}

/** 解除済み実績IDを取得する。 */
export async function getUnlockedAchievementIds(): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ achievementId: string }>('SELECT achievement_id as achievementId FROM achievement_unlocks');
  return new Set(rows.map((row) => row.achievementId));
}

/** 実績一覧で使う定義と解除状態をまとめて取得する。 */
export async function getAchievementListItems(): Promise<AchievementListItem[]> {
  const [progress, unlockRows] = await Promise.all([
    getAchievementProgress(),
    db.getAllAsync<AchievementUnlock>(
      `SELECT
        achievement_id as achievementId,
        unlocked_at as unlockedAt,
        progress_value as progressValue
       FROM achievement_unlocks`,
    ),
  ]);
  const unlockMap = new Map(unlockRows.map((row) => [row.achievementId, row]));

  return ACHIEVEMENT_DEFINITIONS.map((definition) => {
    const unlock = unlockMap.get(definition.id);

    return {
      definition,
      unlockedAt: unlock?.unlockedAt ?? null,
      progressValue: unlock?.progressValue ?? getProgressValueForCondition(definition.condition, progress),
    };
  }).sort((a, b) => a.definition.sortOrder - b.definition.sortOrder);
}

/** 実績再評価の挙動オプション。 */
export type EvaluateAchievementUnlockOptions = {
  /** テストや一括処理で使う評価時刻。 */
  now?: string;
};

/** 現在の進捗から新しく解除できる実績を保存し、通知キューに積む。 */
export async function evaluateAndStoreAchievementUnlocks(options: EvaluateAchievementUnlockOptions = {}): Promise<AchievementDefinition[]> {
  const now = options.now ?? new Date().toISOString();
  const [progress, unlockedIds] = await Promise.all([getAchievementProgress(), getUnlockedAchievementIds()]);
  const newlyUnlocked = evaluateAchievementUnlocks(progress, unlockedIds);

  if (newlyUnlocked.length === 0) {
    return [];
  }

  await db.withTransactionAsync(async () => {
    for (const definition of newlyUnlocked) {
      const progressValue = getProgressValueForCondition(definition.condition, progress);

      const unlockResult = await db.runAsync(
        `INSERT OR IGNORE INTO achievement_unlocks (achievement_id, unlocked_at, progress_value, created_at)
         VALUES (?, ?, ?, ?)`,
        definition.id,
        now,
        progressValue,
        now,
      );
      if (unlockResult.changes > 0) {
        await db.runAsync(
          `INSERT OR IGNORE INTO achievement_notification_queue (achievement_id, queued_at, created_at)
           VALUES (?, ?, ?)`,
          definition.id,
          now,
          now,
        );
      }
    }
  });

  return newlyUnlocked;
}


/** 開発中の動作確認用に解除済み実績と通知キューを削除する。 */
export async function resetAchievementUnlocksForDevelopment(): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM achievement_notification_queue');
    await db.runAsync('DELETE FROM achievement_unlocks');
  });
}

/** ローカル通知を送信済みにする。 */
export async function markAchievementPushDelivered(achievementId: string, deliveredAt = new Date().toISOString()): Promise<void> {
  await db.runAsync(
    `UPDATE achievement_notification_queue
     SET delivered_push_at = COALESCE(delivered_push_at, ?)
     WHERE achievement_id = ? AND delivered_push_at IS NULL`,
    deliveredAt,
    achievementId,
  );
}

/** アプリ内演出をまだ表示していない解除通知を取得する。 */
export async function getPendingInAppAchievementNotifications(): Promise<PendingAchievementNotification[]> {
  const rows = await db.getAllAsync<{ queueId: number; achievementId: string }>(
    `SELECT id as queueId, achievement_id as achievementId
     FROM achievement_notification_queue
     WHERE shown_in_app_at IS NULL
     ORDER BY queued_at ASC, id ASC`,
  );

  return rows.flatMap((row) => {
    const definition = getAchievementDefinition(row.achievementId);
    return definition ? [{ queueId: row.queueId, definition }] : [];
  });
}

/** アプリ内演出を表示済みにする。 */
export async function markAchievementShownInApp(queueId: number, shownAt = new Date().toISOString()): Promise<void> {
  await db.runAsync('UPDATE achievement_notification_queue SET shown_in_app_at = ? WHERE id = ?', shownAt, queueId);
}
