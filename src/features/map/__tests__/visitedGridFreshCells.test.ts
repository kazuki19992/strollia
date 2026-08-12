import type { GridCell } from '@/features/location/grid/gridCell';
import { detectFreshVisitedCells, evictOffscreenFreshCellIds, MAX_FADING_VISITED_CELL_COUNT } from '@/features/map/visitedGridFreshCells';

/** 100m表示セルを組み立てる。 */
function cell(x: number, y: number): GridCell {
  return { cellId: `100:${x}:${y}`, cellSizeMeters: 100, x, y };
}

/** detectFreshVisitedCells の既定引数。テストごとに必要な項目だけ上書きする。 */
function params(overrides: Partial<Parameters<typeof detectFreshVisitedCells>[0]> = {}) {
  return {
    previousCellIds: new Set<string>(),
    previousBounds: { minX: 0, maxX: 10, minY: 0, maxY: 10 },
    nextCells: [] as GridCell[],
    displayCellSizeMeters: 100,
    baseCellSizeMeters: 100,
    maxFadingCellCount: MAX_FADING_VISITED_CELL_COUNT,
    ...overrides,
  };
}

describe('Visited Grid新規セル検出 detectFreshVisitedCells', () => {
  it('前回取得済み範囲の内側に現れた新しいセルはfreshかつフェード対象になる', () => {
    const result = detectFreshVisitedCells(
      params({
        previousCellIds: new Set(['100:5:5']),
        nextCells: [cell(5, 5), cell(5, 6)],
      }),
    );

    expect([...result.freshCellIds]).toEqual(['100:5:6']);
    expect([...result.fadingCellIds]).toEqual(['100:5:6']);
  });

  it('前回取得範囲の外にあるセルはスクロールで入った既存セルとして扱いfreshにしない', () => {
    const result = detectFreshVisitedCells(
      params({
        previousBounds: { minX: 0, maxX: 3, minY: 0, maxY: 3 },
        previousCellIds: new Set(['100:1:1']),
        nextCells: [cell(1, 1), cell(9, 9)],
      }),
    );

    expect(result.freshCellIds.size).toBe(0);
  });

  it('初回取得(前回範囲なし)ではfreshなしとして即時表示する', () => {
    const result = detectFreshVisitedCells(
      params({
        previousBounds: null,
        nextCells: [cell(1, 1), cell(2, 2)],
      }),
    );

    expect(result.freshCellIds.size).toBe(0);
    expect(result.fadingCellIds.size).toBe(0);
  });

  it('前回も存在したセルはfreshにしない', () => {
    const result = detectFreshVisitedCells(
      params({
        previousCellIds: new Set(['100:1:1', '100:2:2']),
        nextCells: [cell(1, 1), cell(2, 2)],
      }),
    );

    expect(result.freshCellIds.size).toBe(0);
  });

  it('200m以上の集約表示ではどの100mセルが開いたか特定できないためfreshを検出しない', () => {
    const result = detectFreshVisitedCells(
      params({
        previousCellIds: new Set(['200:1:1']),
        nextCells: [{ cellId: '200:2:2', cellSizeMeters: 200, x: 2, y: 2 }],
        displayCellSizeMeters: 200,
      }),
    );

    expect(result.freshCellIds.size).toBe(0);
    expect(result.fadingCellIds.size).toBe(0);
  });

  it('一度に大量のセルがfresh判定された場合はフェードだけ止め、結合除外は維持する', () => {
    const nextCells = Array.from({ length: 100 }, (unused, index) => cell(1, index));

    const result = detectFreshVisitedCells(
      params({
        previousBounds: { minX: 0, maxX: 200, minY: 0, maxY: 200 },
        previousCellIds: new Set(['100:0:0']),
        nextCells,
        maxFadingCellCount: 64,
      }),
    );

    expect(result.freshCellIds.size).toBe(100);
    expect(result.fadingCellIds.size).toBe(0);
  });
});

describe('Visited Grid新規セルの画面外判定 evictOffscreenFreshCellIds', () => {
  it('実表示範囲の内側にあるfreshは維持する', () => {
    const retained = evictOffscreenFreshCellIds(new Set(['100:5:5']), { minX: 0, maxX: 10, minY: 0, maxY: 10 });

    expect([...retained]).toEqual(['100:5:5']);
  });

  it('実表示範囲の外へ出たfreshは落としてstable扱いにする', () => {
    const retained = evictOffscreenFreshCellIds(new Set(['100:5:5', '100:20:20']), { minX: 0, maxX: 10, minY: 0, maxY: 10 });

    expect([...retained]).toEqual(['100:5:5']);
  });

  it('境界上のセルは画面内として維持する', () => {
    const retained = evictOffscreenFreshCellIds(new Set(['100:0:0', '100:10:10']), { minX: 0, maxX: 10, minY: 0, maxY: 10 });

    expect(retained.size).toBe(2);
  });

  it('負のセル番号でも範囲判定できる', () => {
    const retained = evictOffscreenFreshCellIds(new Set(['100:-5:-5', '100:-20:-1']), { minX: -10, maxX: 0, minY: -10, maxY: 0 });

    expect([...retained]).toEqual(['100:-5:-5']);
  });

  it('解釈できない形式のセルIDは落とす', () => {
    const retained = evictOffscreenFreshCellIds(new Set(['broken', '100:5:5']), { minX: 0, maxX: 10, minY: 0, maxY: 10 });

    expect([...retained]).toEqual(['100:5:5']);
  });

  it('空集合を渡しても壊れない', () => {
    expect(evictOffscreenFreshCellIds(new Set(), { minX: 0, maxX: 10, minY: 0, maxY: 10 }).size).toBe(0);
  });
});
