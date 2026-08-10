/**
 * 指定した同時実行数を超えないよう制限しながら、配列の各要素に非同期処理を適用する。
 *
 * `Promise.allSettled(items.map(mapper))` は全要素を一斉並列実行するため、
 * mapper が重い処理(メインスレッドを使うネイティブ処理など)を伴う場合に
 * 実行元スレッドを一時に飽和させてしまう。concurrency 件ずつに区切って
 * 実行することでピーク負荷を抑える。
 *
 * @param items - 処理対象の配列。
 * @param concurrency - 同時に実行する処理の最大数。1未満・NaN・undefinedなど不正な値は1として扱う。
 * @param mapper - 各要素に適用する非同期処理。
 * @returns 入力順を保った `Promise.allSettled` 相当の結果配列。
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  // NaN・undefined等の非有限値をそのままMath.max/Math.minに渡すとNaNが伝播し、
  // ワーカー数0件・結果が空配列になって全要素が未処理のまま返ってしまう。
  // 非有限値は1にフォールバックし、小数値は切り捨てて整数のワーカー数にする。
  const effectiveConcurrency = Number.isFinite(concurrency) ? Math.max(1, Math.floor(concurrency)) : 1;
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      // JSはシングルスレッドで、await を挟まないこの2行は割り込まれずに実行される。
      // そのため複数ワーカーが同時にこのブロックへ来ても同じindexを取り合うことはない。
      const currentIndex = nextIndex;
      nextIndex += 1;

      try {
        const value = await mapper(items[currentIndex], currentIndex);
        results[currentIndex] = { status: 'fulfilled', value };
      } catch (reason: unknown) {
        results[currentIndex] = { status: 'rejected', reason };
      }
    }
  }

  const workerCount = Math.min(effectiveConcurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

  return results;
}
