import { resolveInitialPremiumAccess } from '../initialPremiumAccess';

describe('起動時のPlus状態取得', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('取得が制限時間を超えた場合はフォールバックを返す', async () => {
    jest.useFakeTimers();
    const fallback = { isPlusActive: false, entitlementId: 'strollia_plus' };
    const pending = new Promise<typeof fallback>(() => undefined);

    const resultPromise = resolveInitialPremiumAccess(pending, fallback, { timeoutMs: 3000 });
    await jest.advanceTimersByTimeAsync(3000);

    await expect(resultPromise).resolves.toEqual({ state: fallback, timedOut: true, confirmed: false });
    expect(jest.getTimerCount()).toBe(0);
  });

  test('取得が完了した場合はタイマーを残さず結果を返す', async () => {
    jest.useFakeTimers();
    const fallback = { isPlusActive: false, entitlementId: 'strollia_plus' };
    const active = { isPlusActive: true, entitlementId: 'strollia_plus' };

    await expect(resolveInitialPremiumAccess(Promise.resolve(active), fallback, { timeoutMs: 3000 })).resolves.toEqual({ state: active, timedOut: false, confirmed: true });
    expect(jest.getTimerCount()).toBe(0);
  });

  test('取得が失敗した場合はタイマーを残さずフォールバックを返す', async () => {
    jest.useFakeTimers();
    const fallback = { isPlusActive: false, entitlementId: 'strollia_plus' };

    await expect(resolveInitialPremiumAccess(Promise.reject(new Error('取得失敗')), fallback, { timeoutMs: 3000 })).resolves.toEqual({ state: fallback, timedOut: false, confirmed: false });
    expect(jest.getTimerCount()).toBe(0);
  });

  test('待機中に中止された場合はタイマーを残さず中止エラーを返す', async () => {
    jest.useFakeTimers();
    const fallback = { isPlusActive: false, entitlementId: 'strollia_plus' };
    const controller = new AbortController();
    const resultPromise = resolveInitialPremiumAccess(
      new Promise(() => undefined),
      fallback,
      { timeoutMs: 3000, signal: controller.signal },
    );

    controller.abort();

    await expect(resultPromise).rejects.toMatchObject({ name: 'AbortError' });
    expect(jest.getTimerCount()).toBe(0);
  });
});
