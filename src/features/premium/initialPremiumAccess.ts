import type { PremiumAccessState } from './revenueCatAccess';

/** 起動を無期限に止めないためのPlus状態取得待機上限。 */
export const INITIAL_PREMIUM_ACCESS_TIMEOUT_MS = 3000;

/** 初回待機の結果と、取得完了ではなく上限到達で戻ったかを表す。 */
export type InitialPremiumAccessResult = {
  state: PremiumAccessState;
  timedOut: boolean;
};

/** Plus状態の初回取得を待機上限内に収め、失敗時は安全な既定値へ戻す。 */
export async function resolveInitialPremiumAccess(
  request: Promise<PremiumAccessState>,
  fallback: PremiumAccessState,
  timeoutMs = INITIAL_PREMIUM_ACCESS_TIMEOUT_MS,
): Promise<InitialPremiumAccessResult> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<InitialPremiumAccessResult>((resolve) => {
    timeoutId = setTimeout(() => resolve({ state: fallback, timedOut: true }), timeoutMs);
  });
  const settledRequest = request
    .then((state) => ({ state, timedOut: false }))
    .catch(() => ({ state: fallback, timedOut: false }));

  try {
    return await Promise.race([settledRequest, timeout]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}
