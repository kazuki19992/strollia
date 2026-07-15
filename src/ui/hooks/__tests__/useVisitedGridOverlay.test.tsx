import { act, renderHook } from '@testing-library/react-native';

import { getVisitedCellsInBounds } from '@/features/location/visitedCellRepository';
import { useVisitedGridOverlay, UseVisitedGridOverlayResult } from '@/ui/hooks/useVisitedGridOverlay';

jest.mock('@/features/location/visitedCellRepository', () => ({
  getVisitedCellsInBounds: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/features/location/grid/gridAggregation', () => ({
  aggregateVisitedCells: jest.fn().mockReturnValue([]),
  getStableDisplayCellSizeMeters: jest.fn().mockReturnValue(1000),
}));

jest.mock('@/features/location/grid/gridCell', () => ({
  getGridBoundsForRegion: jest.fn().mockReturnValue({ minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 }),
  isGridBoundsContained: jest.fn().mockReturnValue(false),
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
});
