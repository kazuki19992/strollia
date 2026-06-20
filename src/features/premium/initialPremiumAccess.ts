import type { PremiumAccessState } from './revenueCatAccess';

/** 起動を無期限に止めないためのPlus状態取得待機上限。 */
export const INITIAL_PREMIUM_ACCESS_TIMEOUT_MS = 3000;

/** Plus状態の初回取得を待機上限内に収め、失敗時は安全な既定値へ戻す。 */
export async function resolveInitialPremiumAccess(
  request: Promise<PremiumAccessState>,
  fallback: PremiumAccessState,
  timeoutMs = INITIAL_PREMIUM_ACCESS_TIMEOUT_MS,
): Promise<PremiumAccessState> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<PremiumAccessState>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), timeoutMs);
  });

  try {
    return await Promise.race([request.catch(() => fallback), timeout]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}
