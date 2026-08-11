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
 *   `Infinity` は「無制限」を意味する特別値として扱い、後段の `Math.min(effectiveConcurrency, items.length)`
 *   により実質的に全要素を並列実行する。
 * @param mapper - 各要素に適用する非同期処理。
 * @returns 入力順を保った `Promise.allSettled` 相当の結果配列。
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  // 先に切り捨てておくと、NaN自体はもちろんundefined(Math.floor(undefined)はNaN)も
  // Math.floorの時点でNaNに正規化される。ここで得たNaNだけを1にフォールバックする。
  // Infinityは`Number.isFinite`ではじくと「無制限」の意味が失われ全要素が直列実行に
  // なってしまうため、あえて除外しない。Math.max(1, Infinity)はInfinityのまま伝播し、
  // 後段のMath.minでitems.lengthに丸め込まれるので安全に「無制限」として機能する。
  // 一方-Infinityは Math.max(1, -Infinity) = 1 となり、意図通り1にフォールバックする。
  const floored = Math.floor(concurrency);
  const effectiveConcurrency = Number.isNaN(floored) ? 1 : Math.max(1, floored);
  let nextIndex = 0;

  /**
   * 共有カウンタ `nextIndex` から次の担当要素を取り、処理し尽くすまで繰り返すワーカー。
   *
   * ワーカーを `workerCount` 個だけ同時に走らせることで同時実行数を制限する。
   * 「1要素ずつ取り合う」方式にしているのは、配列を事前に等分するとmapperの所要時間に
   * ばらつきがある場合に遅いチャンクが律速し、同時実行数を下回る時間が生じるため。
   *
   * @returns 担当分をすべて処理し終えると解決するPromise。
   */
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
