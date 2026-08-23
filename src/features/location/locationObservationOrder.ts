/** 永続化された観測日時を端末時計の巻き戻りとして無効化する未来差の上限。 */
export const MAX_FUTURE_OBSERVATION_SKEW_MS = 60 * 60 * 1000;

/**
 * 永続状態の最終観測日時に対して、ライブ観測を古いものとして除外すべきか判定する。
 *
 * 最終観測日時が処理時刻より1時間を超えて未来、またはいずれかの日時が不正なら、
 * 端末時計の巻き戻りで記録を恒久停止させないため順序ガードを無効にする。
 */
export function isStaleLocationObservation(lastObservedAt: string | null, recordedAt: string, processedAt: string): boolean {
  if (lastObservedAt == null) {
    return false;
  }

  const lastObservedAtMs = Date.parse(lastObservedAt);
  const recordedAtMs = Date.parse(recordedAt);
  const processedAtMs = Date.parse(processedAt);
  if (![lastObservedAtMs, recordedAtMs, processedAtMs].every(Number.isFinite)) {
    return false;
  }

  if (lastObservedAtMs - processedAtMs > MAX_FUTURE_OBSERVATION_SKEW_MS) {
    return false;
  }

  return recordedAtMs <= lastObservedAtMs;
}
