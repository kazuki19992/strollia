import { act, renderHook } from '@testing-library/react-native';

import { getVisitedCellsInBounds } from '@/features/location/visitedCellRepository';
import { logVisitedGridMetrics } from '@/features/map/visitedGridMetrics';
import { useVisitedGridOverlay, UseVisitedGridOverlayResult } from '@/ui/hooks/useVisitedGridOverlay';

jest.mock('@/features/location/visitedCellRepository', () => ({
  getVisitedCellsInBounds: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/features/map/visitedGridMetrics', () => ({
  logVisitedGridMetrics: jest.fn(),
}));

jest.mock('@/features/location/grid/gridAggregation', () => ({
  aggregateVisitedCells: jest.fn().mockReturnValue([]),
  getStableDisplayCellSizeMeters: jest.fn().mockReturnValue(1000),
}));

jest.mock('@/features/location/grid/gridCell', () => ({
  getGridBoundsForRegion: jest.fn().mockReturnValue({ minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 }),
  isGridBoundsContained: jest.fn().mockReturnValue(false),
  // Polygon座標の値自体は計測ログの検証に関係しないため、固定の矩形を返す
  cellToPolygonCoordinates: jest.fn().mockReturnValue([]),
}));

jest.mock('@/features/location/visitedCellRepository');

/** テスト用の標準マップ表示範囲。 */
const TEST_REGION = {
  latitude: 35.68,
  longitude: 139.76,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

describe('訪問グリッドオーバーレイフック useVisitedGridOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getVisitedCellsInBounds as jest.Mock).mockResolvedValue([]);
  });

  describe('初期状態', () => {
    it('初期 visitedGridCells は空配列になる', () => {
      const { result } = renderHook(() =>
        useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: '#1f7a5c' }),
      );

      expect(result.current.visitedGridCells).toEqual([]);
    });

    it('gridOverlayOpacity は数値で返される', () => {
      const { result } = renderHook(() =>
        useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: '#1f7a5c' }),
      );

      expect(typeof result.current.gridOverlayOpacity).toBe('number');
    });

    it('incrementVisitedGridRefreshVersion は関数として返される', () => {
      const { result } = renderHook(() =>
        useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: '#1f7a5c' }),
      );

      expect(typeof result.current.incrementVisitedGridRefreshVersion).toBe('function');
    });
  });

  describe('isReady が false の場合', () => {
    it('isReady が false のときは getVisitedCellsInBounds を呼ばない', async () => {
      const { result } = renderHook(() =>
        useVisitedGridOverlay({ isReady: false, gridOverlayRegion: TEST_REGION, themePrimaryColor: '#1f7a5c' }),
      );

      await act(async () => {
        await Promise.resolve();
      });

      expect(getVisitedCellsInBounds).not.toHaveBeenCalled();
      expect(result.current.visitedGridCells).toEqual([]);
    });
  });

  describe('isReady が true の場合', () => {
    it('isReady が true のときは getVisitedCellsInBounds を呼ぶ', async () => {
      renderHook(() => useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: '#1f7a5c' }));

      await act(async () => {
        await Promise.resolve();
      });

      expect(getVisitedCellsInBounds).toHaveBeenCalledTimes(1);
    });
  });

  describe('incrementVisitedGridRefreshVersion', () => {
    it('呼び出すと getVisitedCellsInBounds が再度呼ばれる', async () => {
      const { result } = renderHook(() =>
        useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: '#1f7a5c' }),
      );

      await act(async () => {
        await Promise.resolve();
      });

      const callCountBefore = (getVisitedCellsInBounds as jest.Mock).mock.calls.length;

      await act(async () => {
        result.current.incrementVisitedGridRefreshVersion();
        await Promise.resolve();
      });

      expect((getVisitedCellsInBounds as jest.Mock).mock.calls.length).toBeGreaterThan(callCountBefore);
    });
  });

  describe('効果測定ログ', () => {
    it('取得結果のセル数と描画Polygon数を計測値として出力する', async () => {
      // このフックからログ関数まで結線されていることを確認する。
      // 計測が届かないと改善前後の比較ができないため、出力そのものを固定する。
      const { aggregateVisitedCells } = jest.requireMock('@/features/location/grid/gridAggregation');
      (aggregateVisitedCells as jest.Mock).mockReturnValue([
        { cellId: '1000:1:1', cellSizeMeters: 1000, x: 1, y: 1 },
        { cellId: '1000:2:2', cellSizeMeters: 1000, x: 2, y: 2 },
      ]);
      (getVisitedCellsInBounds as jest.Mock).mockResolvedValue([
        { cellId: '100:1:1', cellSizeMeters: 100, x: 1, y: 1 },
        { cellId: '100:1:2', cellSizeMeters: 100, x: 1, y: 2 },
        { cellId: '100:2:2', cellSizeMeters: 100, x: 2, y: 2 },
      ]);

      renderHook(() => useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: '#1f7a5c' }));

      await act(async () => {
        await Promise.resolve();
      });

      expect(logVisitedGridMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          rawCellCount: 2,
          renderPolygonCount: 2,
          fetchMs: expect.any(Number),
          aggregationMs: expect.any(Number),
          overlayBuildMs: expect.any(Number),
        }),
      );
    });
  });
});
