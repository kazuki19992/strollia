import { splitLandmarkPacksForTeaser } from '@/features/landmarks/landmarkPackTeaser';

/** テスト用のパック行。分割関数は pack.isFree だけを見る。 */
type TestItem = { id: string; pack: { isFree: boolean } };

/** IDと無料/Plus用の区別からテスト用の行を作る。 */
function item(id: string, isFree: boolean): TestItem {
  return { id, pack: { isFree } };
}

describe('Plus用パックのぼかし導線の分割 splitLandmarkPacksForTeaser', () => {
  it('Plus有効なら全件を通常表示にし、ぼかし対象を作らない', () => {
    const items = [item('free1', true), item('plus1', false), item('plus2', false), item('plus3', false)];

    expect(splitLandmarkPacksForTeaser(items, true)).toEqual({ visibleItems: items, peekItem: null, hiddenItems: [] });
  });

  it('Plus用パックが0件なら全件を通常表示にする', () => {
    const items = [item('free1', true), item('free2', true)];

    expect(splitLandmarkPacksForTeaser(items, false)).toEqual({ visibleItems: items, peekItem: null, hiddenItems: [] });
  });

  it('Plus用パックが1件でもその1件を半分見せる行にし、件数を読み取らせない', () => {
    const items = [item('free1', true), item('plus1', false)];

    expect(splitLandmarkPacksForTeaser(items, false)).toEqual({
      visibleItems: [items[0]],
      peekItem: items[1],
      hiddenItems: [],
    });
  });

  it('Plus用パックが4件なら1件目を半分見せる行にし、2件目以降を完全にぼかす行にする', () => {
    const items = [item('free1', true), item('plus1', false), item('plus2', false), item('plus3', false), item('plus4', false)];

    const result = splitLandmarkPacksForTeaser(items, false);

    expect(result.visibleItems.map((value) => value.id)).toEqual(['free1']);
    expect(result.peekItem?.id).toBe('plus1');
    expect(result.hiddenItems.map((value) => value.id)).toEqual(['plus2', 'plus3', 'plus4']);
  });

  it('無料パックがPlus用パックの後ろにあっても通常表示の行は元の表示順を保つ', () => {
    const items = [item('plus1', false), item('free1', true), item('plus2', false), item('free2', true), item('plus3', false)];

    const result = splitLandmarkPacksForTeaser(items, false);

    expect(result.visibleItems.map((value) => value.id)).toEqual(['free1', 'free2']);
    expect(result.peekItem?.id).toBe('plus1');
    expect(result.hiddenItems.map((value) => value.id)).toEqual(['plus2', 'plus3']);
  });
});
