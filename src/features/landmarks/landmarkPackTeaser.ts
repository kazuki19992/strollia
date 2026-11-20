/** 無料ユーザー向けのグラデーション導線に向けて分割したパック行。 */
export type LandmarkPackTeaserSplit<T> = {
  /** 通常表示する行(無料パックすべて)。元の表示順を保つ。 */
  visibleItems: T[];
  /** グラデーション領域の先頭に置き、上端から下端へ背景色を段階的に重ねる行(Plus用パックの1件目)。グラデーション領域を作らない場合はnull。 */
  peekItem: T | null;
  /** 固定高さの領域で背景色を最大の不透明度で重ね、うっすら見せる行(Plus用パックの2件目以降)。 */
  hiddenItems: T[];
};

/**
 * 実績画面のスポットパック行を、無料ユーザー向けのグラデーション導線に合わせて分割する。
 *
 * 無料ユーザーにはPlus用パックを0.5件(上端から下端へ背景色を段階的に重ねた1件目)だけ見せ、残りの件数を読み取れないようにする
 * (`docs/superpowers/specs/2026-11-20-plus-pack-blur-teaser-design.md`)。
 * Plus用パックが1件だけでも、件数を読み取らせないためにグラデーション領域を作る。
 * Plus有効時、またはPlus用パックが0件で対象がない場合は、全件を通常表示にする。
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
