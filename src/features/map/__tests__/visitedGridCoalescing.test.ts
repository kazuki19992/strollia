import type { GridCellPolygonSource } from '@/features/location/grid/gridCell';
import { coalesceVisitedGridCells } from '@/features/map/visitedGridCoalescing';

/** 指定サイズの表示セルを作る。 */
function cell(x: number, y: number, cellSizeMeters = 100): GridCellPolygonSource {
  return { cellId: `${cellSizeMeters}:${x}:${y}`, cellSizeMeters, x, y };
}

/** originを左下とする size x size のセル集合を作る。 */
function block(originX: number, originY: number, size: number, cellSizeMeters = 100): GridCellPolygonSource[] {
  const cells: GridCellPolygonSource[] = [];

  for (let y = originY; y < originY + size; y += 1) {
    for (let x = originX; x < originX + size; x += 1) {
      cells.push(cell(x, y, cellSizeMeters));
    }
  }

  return cells;
}

describe('Visited Grid Polygon結合 coalesceVisitedGridCells', () => {
  it('4x4が完全に埋まっていれば1つの400mセルへ結合する', () => {
    const result = coalesceVisitedGridCells(block(0, 0, 4), new Set());

    expect(result.stableCells).toHaveLength(1);
    expect(result.stableCells[0]).toEqual(expect.objectContaining({ cellId: '400:0:0', cellSizeMeters: 400, x: 0, y: 0 }));
    expect(result.blockCountBySize['4x4']).toBe(1);
  });

  it('4x4の一部が欠けている場合は2x2と単体へ落とす', () => {
    // 4x4から右上の1セル(3,3)を欠けさせる。左下・右下・左上の2x2は成立し、右上ブロックの3セルが単体で残る。
    const cells = block(0, 0, 4).filter((target) => !(target.x === 3 && target.y === 3));

    const result = coalesceVisitedGridCells(cells, new Set());

    expect(result.blockCountBySize['4x4']).toBeUndefined();
    expect(result.blockCountBySize['2x2']).toBe(3);
    expect(result.blockCountBySize['1x1']).toBe(3);
    expect(result.stableCells).toHaveLength(6);
  });

  it('市松模様状では誤って結合せず100mセルのまま返す', () => {
    const cells: GridCellPolygonSource[] = [];

    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < 4; x += 1) {
        if ((x + y) % 2 === 0) {
          cells.push(cell(x, y));
        }
      }
    }

    const result = coalesceVisitedGridCells(cells, new Set());

    expect(result.stableCells).toHaveLength(8);
    expect(result.stableCells.every((target) => target.cellSizeMeters === 100)).toBe(true);
  });

  it('未訪問セルを含むブロックは結合せず未訪問エリアを塗らない', () => {
    const cells = block(0, 0, 2).filter((target) => !(target.x === 1 && target.y === 1));

    const result = coalesceVisitedGridCells(cells, new Set());

    expect(result.stableCells.map((target) => target.cellId).sort()).toEqual(['100:0:0', '100:0:1', '100:1:0']);
  });

  it('fresh cellは結合対象から除外し100mセルのまま返す', () => {
    const result = coalesceVisitedGridCells(block(0, 0, 2), new Set(['100:1:1']));

    expect(result.freshCells.map((target) => target.cellId)).toEqual(['100:1:1']);
    expect(result.stableCells.map((target) => target.cellId).sort()).toEqual(['100:0:0', '100:0:1', '100:1:0']);
  });

  it('結合後セルは範囲内の最古・最新訪問日時と訪問回数を引き継ぐ', () => {
    const cells = block(0, 0, 2).map((target, index) => ({
      ...target,
      firstVisitedAt: `2026-05-0${index + 1}T00:00:00.000Z`,
      lastVisitedAt: `2026-06-0${index + 1}T00:00:00.000Z`,
      visitCount: index + 1,
    }));

    const result = coalesceVisitedGridCells(cells, new Set());

    expect(result.stableCells[0]).toEqual(
      expect.objectContaining({
        firstVisitedAt: '2026-05-01T00:00:00.000Z',
        lastVisitedAt: '2026-06-04T00:00:00.000Z',
        visitCount: 10,
      }),
    );
  });

  it('負のセル番号でもブロック整列を崩さず結合する', () => {
    const result = coalesceVisitedGridCells(block(-4, -4, 4), new Set());

    expect(result.stableCells).toHaveLength(1);
    expect(result.stableCells[0]).toEqual(expect.objectContaining({ cellId: '400:-1:-1', x: -1, y: -1 }));
  });

  it('ブロック整列していない4x4は整列2x2を1つだけ結合し残りは単体で返す', () => {
    // x=1..4, y=1..4 は 4x4 の整列ブロック(x=0..3 / x=4..7)にまたがるため 4x4 では結合しない。
    // 2x2の整列ブロック(x,y各0/2/4起点)のうち完全に埋まるのは origin(2,2)の1つだけで、
    // 残り12セルはどの整列ブロックにも属さず単体のまま残る(1個の2x2 + 12個の1x1 = 13セル)。
    const result = coalesceVisitedGridCells(block(1, 1, 4), new Set());

    expect(result.blockCountBySize['4x4']).toBeUndefined();
    expect(result.blockCountBySize['2x2']).toBe(1);
    expect(result.blockCountBySize['1x1']).toBe(12);
    expect(result.stableCells).toHaveLength(13);
    // 結合しても塗る面積は変わらない(100mセル換算で16セルぶん、未訪問セルを塗らないことの確認)
    const coveredCellCount = result.stableCells.reduce((total, target) => total + (target.cellSizeMeters / 100) ** 2, 0);
    expect(coveredCellCount).toBe(16);
  });

  it('表示セルサイズが200mのセルにも適用できる', () => {
    const result = coalesceVisitedGridCells(block(0, 0, 2, 200), new Set());

    expect(result.stableCells).toHaveLength(1);
    expect(result.stableCells[0]).toEqual(expect.objectContaining({ cellId: '400:0:0', cellSizeMeters: 400 }));
  });

  it('空配列を渡しても壊れない', () => {
    const result = coalesceVisitedGridCells([], new Set());

    expect(result.stableCells).toEqual([]);
    expect(result.freshCells).toEqual([]);
    expect(result.blockCountBySize).toEqual({});
  });
});
