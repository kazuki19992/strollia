import { act, renderHook } from '@testing-library/react-native';

import { getVisitedCellsInBounds } from '@/features/location/visitedCellRepository';
import { useVisitedGridOverlay } from '@/ui/hooks/useVisitedGridOverlay';

// getVisitedCellsInBoundsだけモックする。gridCell / gridAggregation / visitedGridFreshCells /
// visitedGridCoalescing は実物を使い、結合結果・fresh判定を実座標で検証する。
jest.mock('@/features/location/visitedCellRepository', () => ({
  getVisitedCellsInBounds: jest.fn().mockResolvedValue([]),
}));

/** テスト用の標準マップ表示範囲。latitudeDelta=0.01は表示セルサイズ100mになる。 */
const TEST_REGION = {
  latitude: 35.68,
  longitude: 139.76,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

const THEME_PRIMARY_COLOR = '#1f7a5c';

/**
 * TEST_REGION中心を含む4x4ブロックの原点(基本100mセル番号)。
 * `coordinateToGridCell` の実際のWeb Mercator変換に基づく値で、
 * DB取得範囲(padding 0.5あり)・画面外判定範囲(padding無し)の両方に完全に収まる。
 */
const BLOCK_ORIGIN = { x: 155580, y: 42564 };

/**
 * DB取得範囲・画面外判定範囲の両方に収まりつつ、BLOCK_ORIGINの4x4ブロックとは重ならない座標。
 * 再取得時の新規セル検出(fresh判定)の対象として使う。
 */
const FRESH_CELL = { x: 155585, y: 42570 };

/** VisitedCellRow相当のテスト用行を作る。 */
function makeRow(x: number, y: number) {
  return {
    cellId: `100:${x}:${y}`,
    cellSizeMeters: 100,
    x,
    y,
    firstVisitedAt: '2026-08-01T00:00:00.000Z',
    lastVisitedAt: '2026-08-01T00:00:00.000Z',
    visitCount: 1,
  };
}

/** 指定した原点から完全に埋まった正方形ブロック分のvisited cell行を作る。 */
function makeFullBlockRows(origin: { x: number; y: number }, blockSize = 4) {
  const rows: ReturnType<typeof makeRow>[] = [];

  for (let y = origin.y; y < origin.y + blockSize; y += 1) {
    for (let x = origin.x; x < origin.x + blockSize; x += 1) {
      rows.push(makeRow(x, y));
    }
  }

  return rows;
}

/** マイクロタスクを1つ流し、フックの非同期取得effectを完了させる。 */
async function flushFetch(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('訪問グリッドオーバーレイフック useVisitedGridOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getVisitedCellsInBounds as jest.Mock).mockResolvedValue([]);
  });

  describe('初期状態', () => {
    it('初期 visitedGridCells は空配列になる', () => {
      const { result } = renderHook(() =>
        useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: THEME_PRIMARY_COLOR }),
      );

      expect(result.current.visitedGridCells).toEqual([]);
    });

    it('gridOverlayOpacity は数値で返される', () => {
      const { result } = renderHook(() =>
        useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: THEME_PRIMARY_COLOR }),
      );

      expect(typeof result.current.gridOverlayOpacity).toBe('number');
    });

    it('incrementVisitedGridRefreshVersion は関数として返される', () => {
      const { result } = renderHook(() =>
        useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: THEME_PRIMARY_COLOR }),
      );

      expect(typeof result.current.incrementVisitedGridRefreshVersion).toBe('function');
    });
  });

  describe('isReady が false の場合', () => {
    it('isReady が false のときは getVisitedCellsInBounds を呼ばない', async () => {
      const { result } = renderHook(() =>
        useVisitedGridOverlay({ isReady: false, gridOverlayRegion: TEST_REGION, themePrimaryColor: THEME_PRIMARY_COLOR }),
      );

      await flushFetch();

      expect(getVisitedCellsInBounds).not.toHaveBeenCalled();
      expect(result.current.visitedGridCells).toEqual([]);
    });
  });

  describe('isReady が true の場合', () => {
    it('isReady が true のときは getVisitedCellsInBounds を呼ぶ', async () => {
      renderHook(() => useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: THEME_PRIMARY_COLOR }));

      await flushFetch();

      expect(getVisitedCellsInBounds).toHaveBeenCalledTimes(1);
    });

    it('getVisitedCellsInBounds は表示セルサイズ(100)付きで呼ばれる', async () => {
      renderHook(() => useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: THEME_PRIMARY_COLOR }));

      await flushFetch();

      expect(getVisitedCellsInBounds).toHaveBeenCalledWith(expect.any(Object), 100);
    });
  });

  describe('incrementVisitedGridRefreshVersion', () => {
    it('呼び出すと getVisitedCellsInBounds が再度呼ばれる', async () => {
      const { result } = renderHook(() =>
        useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: THEME_PRIMARY_COLOR }),
      );

      await flushFetch();

      const callCountBefore = (getVisitedCellsInBounds as jest.Mock).mock.calls.length;

      await act(async () => {
        result.current.incrementVisitedGridRefreshVersion();
        await Promise.resolve();
      });

      expect((getVisitedCellsInBounds as jest.Mock).mock.calls.length).toBeGreaterThan(callCountBefore);
    });
  });

  describe('Polygon結合とfresh判定', () => {
    it('完全に埋まった4x4は1つのPolygonへ結合される', async () => {
      (getVisitedCellsInBounds as jest.Mock).mockResolvedValue(makeFullBlockRows(BLOCK_ORIGIN));

      const { result } = renderHook(() =>
        useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: THEME_PRIMARY_COLOR }),
      );

      await flushFetch();

      expect(result.current.visitedGridCells).toHaveLength(1);
      expect(result.current.visitedGridCells[0].id).toBe(`400:${BLOCK_ORIGIN.x / 4}:${BLOCK_ORIGIN.y / 4}`);
    });

    it('結合できないデータは100mセルのPolygonとして描画される', async () => {
      const scatteredRows = [
        makeRow(BLOCK_ORIGIN.x, BLOCK_ORIGIN.y),
        makeRow(BLOCK_ORIGIN.x + 2, BLOCK_ORIGIN.y),
        makeRow(BLOCK_ORIGIN.x, BLOCK_ORIGIN.y + 2),
      ];
      (getVisitedCellsInBounds as jest.Mock).mockResolvedValue(scatteredRows);

      const { result } = renderHook(() =>
        useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: THEME_PRIMARY_COLOR }),
      );

      await flushFetch();

      expect(result.current.visitedGridCells).toHaveLength(3);
      expect(result.current.visitedGridCells.map((cell) => cell.id).sort()).toEqual(scatteredRows.map((row) => row.cellId).sort());
    });

    it('初回取得のセルはフェードせず即時表示する', async () => {
      (getVisitedCellsInBounds as jest.Mock).mockResolvedValue(makeFullBlockRows(BLOCK_ORIGIN));

      const { result } = renderHook(() =>
        useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: THEME_PRIMARY_COLOR }),
      );

      await flushFetch();

      // フェード中はalphaが0から始まる。初回取得は即時表示のためalpha 0のrgbaにはならない。
      expect(result.current.visitedGridCells[0].fillColor).not.toMatch(/, 0\)$/);
    });

    it('再取得で新しく現れたセルは結合されず100mセルのまま残る', async () => {
      (getVisitedCellsInBounds as jest.Mock).mockResolvedValueOnce(makeFullBlockRows(BLOCK_ORIGIN));

      const { result } = renderHook(() =>
        useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: THEME_PRIMARY_COLOR }),
      );

      await flushFetch();

      expect(result.current.visitedGridCells).toHaveLength(1);

      (getVisitedCellsInBounds as jest.Mock).mockResolvedValueOnce([
        ...makeFullBlockRows(BLOCK_ORIGIN),
        makeRow(FRESH_CELL.x, FRESH_CELL.y),
      ]);

      await act(async () => {
        result.current.incrementVisitedGridRefreshVersion();
        await Promise.resolve();
      });

      const ids = result.current.visitedGridCells.map((cell) => cell.id);

      expect(result.current.visitedGridCells).toHaveLength(2);
      expect(ids).toContain(`400:${BLOCK_ORIGIN.x / 4}:${BLOCK_ORIGIN.y / 4}`);
      expect(ids).toContain(`100:${FRESH_CELL.x}:${FRESH_CELL.y}`);
    });
  });
});
