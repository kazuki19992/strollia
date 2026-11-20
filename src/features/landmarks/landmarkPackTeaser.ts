/** 無料ユーザー向けのぼかし導線に向けて分割したパック行。 */
export type LandmarkPackTeaserSplit<T> = {
  /** 通常表示する行(無料パックすべて)。元の表示順を保つ。 */
  visibleItems: T[];
  /** ぼかし領域の先頭に置き、上端から下端へ段階的にぼかす行(Plus用パックの1件目)。ぼかし領域を作らない場合はnull。 */
  peekItem: T | null;
  /** 固定高さの領域で完全にぼかす行(Plus用パックの2件目以降)。 */
  hiddenItems: T[];
};

/**
 * 実績画面のスポットパック行を、無料ユーザー向けのぼかし導線に合わせて分割する。
 *
 * 無料ユーザーにはPlus用パックを0.5件(上端から下端へ段階的にぼかした1件目)だけ見せ、残りの件数を読み取れないようにする
 * (`docs/superpowers/specs/2026-11-20-plus-pack-blur-teaser-design.md`)。
 * Plus用パックが1件だけでも、件数を読み取らせないためにぼかし領域を作る。
 * Plus有効時、またはPlus用パックが0件でぼかす対象がない場合は、全件を通常表示にする。
 *
 * @param items - 表示順に並んだパック行。
 * @param isPlusActive - Strollia Plusが有効かどうか。
 */
export function splitLandmarkPacksForTeaser<T extends { pack: { isFree: boolean } }>(
  items: T[],
  isPlusActive: boolean,
): LandmarkPackTeaserSplit<T> {
  const plusItems = items.filter((item) => !item.pack.isFree);

  if (isPlusActive || plusItems.length === 0) {
    return { visibleItems: items, peekItem: null, hiddenItems: [] };
  }

  return {
    visibleItems: items.filter((item) => item.pack.isFree),
    peekItem: plusItems[0],
    hiddenItems: plusItems.slice(1),
  };
}
