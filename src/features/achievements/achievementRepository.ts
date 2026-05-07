import { db } from '../../db/database';
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
  const [distanceRow, logDaysRow, prefectureRow, municipalityRow] = await Promise.all([
    db.getFirstAsync<{ totalDistanceMeters: number | null }>(
      'SELECT COALESCE(SUM(COALESCE(distance_meters, 0)), 0) as totalDistanceMeters FROM daily_logs',
    ),
    db.getFirstAsync<{ logDays: number }>('SELECT COUNT(*) as logDays FROM daily_logs WHERE point_count > 0'),
    db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM visited_admin_areas WHERE area_type = 'prefecture'"),
    db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM visited_admin_areas WHERE area_type = 'municipality'"),
  ]);

  return {
    totalDistanceMeters: distanceRow?.totalDistanceMeters ?? 0,
    logDays: logDaysRow?.logDays ?? 0,
    prefectureCount: prefectureRow?.count ?? 0,
    municipalityCount: municipalityRow?.count ?? 0,
  };
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

/** 現在の進捗から新しく解除できる実績を保存し、通知キューに積む。 */
export async function evaluateAndStoreAchievementUnlocks(now = new Date().toISOString()): Promise<AchievementDefinition[]> {
  const [progress, unlockedIds] = await Promise.all([getAchievementProgress(), getUnlockedAchievementIds()]);
  const newlyUnlocked = evaluateAchievementUnlocks(progress, unlockedIds);

  if (newlyUnlocked.length === 0) {
    return [];
  }

  await db.withTransactionAsync(async () => {
    for (const definition of newlyUnlocked) {
      const progressValue = getProgressValueForCondition(definition.condition, progress);

      await db.runAsync(
        `INSERT OR IGNORE INTO achievement_unlocks (achievement_id, unlocked_at, progress_value, created_at)
         VALUES (?, ?, ?, ?)`,
        definition.id,
        now,
        progressValue,
        now,
      );
      await db.runAsync(
        `INSERT INTO achievement_notification_queue (achievement_id, queued_at, created_at)
         VALUES (?, ?, ?)`,
        definition.id,
        now,
        now,
      );
    }
  });

  return newlyUnlocked;
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
