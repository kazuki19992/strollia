import { mapWithConcurrency } from '@/utils/concurrency';

describe('並列数制限付きmap mapWithConcurrency', () => {
  it('完了順が入力順と逆でも、結果は入力順と同じ順序で返す', async () => {
    const items = [1, 2, 3, 4, 5];

    // 先頭の要素ほど遅く完了するよう遅延を逆順にし、完了順(5,4,3,2,1)と
    // 入力順(1,2,3,4,5)が一致しないケースを作る。concurrencyを要素数と同じ
    // にすることで全ワーカーがほぼ同時に開始し、遅延が確実に重なり合う。
    const results = await mapWithConcurrency(items, items.length, async (item, index) => {
      await new Promise((resolve) => setTimeout(resolve, (items.length - index) * 10));
      return item * 10;
    });

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

  it('concurrencyがNaNでも1として扱い、全要素を穴なしで処理する', async () => {
    const items = [1, 2, 3];

    // NaNをMath.max/Math.minにそのまま渡すとワーカー数がNaN・Array.from結果が
    // 空配列になり、全要素未処理のスパース配列(穴あき)がそのまま返ってしまう。
    // lengthだけでなく各要素の中身を検証し、穴あきでないことを確認する。
    const results = await mapWithConcurrency(items, NaN, async (item) => item * 10);

    expect(results).toEqual([
      { status: 'fulfilled', value: 10 },
      { status: 'fulfilled', value: 20 },
      { status: 'fulfilled', value: 30 },
    ]);
  });
});
