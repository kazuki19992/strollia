import type { GridCellPolygonSource } from '@/features/location/grid/gridCell';
import { canSkipVisitedGridSourceUpdate, hasSameVisitedGridCellIds } from '@/features/map/visitedGridIdentity';

/** テスト用の表示セルを作る。メタデータは同一性判定の対象外であることを示すため引数で差し替えられる。 */
function makeCell(x: number, y: number, metadata: Partial<GridCellPolygonSource> = {}): GridCellPolygonSource {
  return {
    cellId: `100:${x}:${y}`,
    cellSizeMeters: 100,
    x,
    y,
    firstVisitedAt: '2026-08-01T00:00:00.000Z',
    lastVisitedAt: '2026-08-01T00:00:00.000Z',
    visitCount: 1,
    ...metadata,
  };
}

describe('表示セル同一性判定 hasSameVisitedGridCellIds', () => {
  it('同じセルIDの集合なら順序が違ってもtrueを返す', () => {
    const previousCellIds = new Set(['100:1:1', '100:2:2', '100:3:3']);
    const nextCells = [makeCell(3, 3), makeCell(1, 1), makeCell(2, 2)];

    expect(hasSameVisitedGridCellIds(previousCellIds, nextCells)).toBe(true);
  });

  it('セルIDが同じでメタデータだけ違う場合もtrueを返す', () => {
    // 現在地セルの visit_count / last_visited_at はGPS記録のたびに更新される。
    // これを差分として扱うと更新スキップがほぼ成立しなくなるため、判定対象から外す仕様。
    const previousCellIds = new Set(['100:1:1']);
    const nextCells = [makeCell(1, 1, { visitCount: 99, lastVisitedAt: '2026-08-13T12:00:00.000Z' })];

    expect(hasSameVisitedGridCellIds(previousCellIds, nextCells)).toBe(true);
  });

  it('件数が同じでもセルIDが1つ違えばfalseを返す', () => {
    const previousCellIds = new Set(['100:1:1', '100:2:2']);
    const nextCells = [makeCell(1, 1), makeCell(9, 9)];

    expect(hasSameVisitedGridCellIds(previousCellIds, nextCells)).toBe(false);
  });

  it('セルが増えた場合はfalseを返す', () => {
    const previousCellIds = new Set(['100:1:1']);
    const nextCells = [makeCell(1, 1), makeCell(2, 2)];

    expect(hasSameVisitedGridCellIds(previousCellIds, nextCells)).toBe(false);
  });

  it('セルが減った場合はfalseを返す', () => {
    const previousCellIds = new Set(['100:1:1', '100:2:2']);
    const nextCells = [makeCell(1, 1)];

    expect(hasSameVisitedGridCellIds(previousCellIds, nextCells)).toBe(false);
  });

  it('前回も今回も0件ならtrueを返す', () => {
    expect(hasSameVisitedGridCellIds(new Set<string>(), [])).toBe(true);
  });
});

describe('更新スキップ判定 canSkipVisitedGridSourceUpdate', () => {
  /** 判定がtrueになる既定の引数。各テストで1条件だけ崩して使う。 */
  function makeSkippableParams() {
    return {
      previousFetch: { cellIds: new Set(['100:1:1', '100:2:2']), cellSizeMeters: 100 },
      nextCells: [makeCell(1, 1), makeCell(2, 2)],
      displayCellSizeMeters: 100,
      detectedFreshCellIds: new Set<string>(),
    };
  }

  it('前回取得と同じセルID集合でfresh検出が0件ならtrueを返す', () => {
    expect(canSkipVisitedGridSourceUpdate(makeSkippableParams())).toBe(true);
  });

  it('初回取得(previousFetchがnull)ではfalseを返す', () => {
    expect(canSkipVisitedGridSourceUpdate({ ...makeSkippableParams(), previousFetch: null })).toBe(false);
  });

  it('表示セルサイズが前回と違う場合はfalseを返す', () => {
    expect(canSkipVisitedGridSourceUpdate({ ...makeSkippableParams(), displayCellSizeMeters: 200 })).toBe(false);
  });

  it('fresh検出が1件でもあればfalseを返す', () => {
    const params = { ...makeSkippableParams(), detectedFreshCellIds: new Set(['100:5:5']) };

    expect(canSkipVisitedGridSourceUpdate(params)).toBe(false);
  });

  it('セルIDの集合が変わっていればfalseを返す', () => {
    const params = { ...makeSkippableParams(), nextCells: [makeCell(1, 1), makeCell(2, 2), makeCell(3, 3)] };

    expect(canSkipVisitedGridSourceUpdate(params)).toBe(false);
  });
});
