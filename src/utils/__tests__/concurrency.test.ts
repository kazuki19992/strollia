import { mapWithConcurrency } from '@/utils/concurrency';

describe('並列数制限付きmap mapWithConcurrency', () => {
  it('入力順と同じ順序で結果を返す', async () => {
    const items = [1, 2, 3, 4, 5];

    const results = await mapWithConcurrency(items, 2, async (item) => item * 10);

    expect(results).toEqual([
      { status: 'fulfilled', value: 10 },
      { status: 'fulfilled', value: 20 },
      { status: 'fulfilled', value: 30 },
      { status: 'fulfilled', value: 40 },
      { status: 'fulfilled', value: 50 },
    ]);
  });

  it('空配列の場合は空配列を返す', async () => {
    const results = await mapWithConcurrency<number, number>([], 4, async (item) => item);

    expect(results).toEqual([]);
  });

  it('同時に実行される処理数がconcurrencyを超えない', async () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    let runningCount = 0;
    let maxRunningCount = 0;

    await mapWithConcurrency(items, 3, async (item) => {
      runningCount += 1;
      maxRunningCount = Math.max(maxRunningCount, runningCount);
      await new Promise((resolve) => setTimeout(resolve, 5));
      runningCount -= 1;
      return item;
    });

    expect(maxRunningCount).toBeLessThanOrEqual(3);
  });

  it('一部の処理が失敗しても残りの結果と合わせて返す', async () => {
    const items = [1, 2, 3];

    const results = await mapWithConcurrency(items, 2, async (item) => {
      if (item === 2) {
        throw new Error('failed for 2');
      }
      return item * 100;
    });

    expect(results).toEqual([
      { status: 'fulfilled', value: 100 },
      { status: 'rejected', reason: new Error('failed for 2') },
      { status: 'fulfilled', value: 300 },
    ]);
  });

  it('concurrencyが要素数より多い場合も全要素を処理する', async () => {
    const items = [1, 2];

    const results = await mapWithConcurrency(items, 10, async (item) => item);

    expect(results).toEqual([
      { status: 'fulfilled', value: 1 },
      { status: 'fulfilled', value: 2 },
    ]);
  });

  it('concurrencyが0以下でも1として扱い処理が完了する', async () => {
    const items = [1, 2];

    const results = await mapWithConcurrency(items, 0, async (item) => item);

    expect(results).toEqual([
      { status: 'fulfilled', value: 1 },
      { status: 'fulfilled', value: 2 },
    ]);
  });
});
