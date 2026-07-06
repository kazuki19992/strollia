import { getVisitedCellsInBounds } from '@/features/location/visitedCellRepository';
import { useVisitedGridOverlay, UseVisitedGridOverlayResult } from '@/app/hooks/useVisitedGridOverlay';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

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

type HookProbeProps = {
  /** フックの戻り値をテストへ渡すコールバック。 */
  onResult: (result: UseVisitedGridOverlayResult) => void;
  /** isReady の値。 */
  isReady?: boolean;
};

/** フックを実行するための最小コンポーネント。 */
function HookProbe({ onResult, isReady = true }: HookProbeProps) {
  const result = useVisitedGridOverlay({ isReady, gridOverlayRegion: TEST_REGION, themePrimaryColor: '#1f7a5c' });
  onResult(result);
  return null;
}

describe('訪問グリッドオーバーレイフック useVisitedGridOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getVisitedCellsInBounds as jest.Mock).mockResolvedValue([]);
  });

  describe('初期状態', () => {
    it('初期 visitedGridCells は空配列になる', () => {
      let result: UseVisitedGridOverlayResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.visitedGridCells).toEqual([]);
    });

    it('gridOverlayOpacity は数値で返される', () => {
      let result: UseVisitedGridOverlayResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(typeof result!.gridOverlayOpacity).toBe('number');
    });

    it('incrementVisitedGridRefreshVersion は関数として返される', () => {
      let result: UseVisitedGridOverlayResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(typeof result!.incrementVisitedGridRefreshVersion).toBe('function');
    });
  });

  describe('isReady が false の場合', () => {
    it('isReady が false のときは getVisitedCellsInBounds を呼ばない', async () => {
      let result: UseVisitedGridOverlayResult | undefined;

      await act(async () => {
        ReactTestRenderer.create(<HookProbe isReady={false} onResult={(r) => (result = r)} />);
        await Promise.resolve();
      });

      expect(getVisitedCellsInBounds).not.toHaveBeenCalled();
      expect(result!.visitedGridCells).toEqual([]);
    });
  });

  describe('isReady が true の場合', () => {
    it('isReady が true のときは getVisitedCellsInBounds を呼ぶ', async () => {
      await act(async () => {
        ReactTestRenderer.create(<HookProbe isReady={true} onResult={() => undefined} />);
        await Promise.resolve();
      });

      expect(getVisitedCellsInBounds).toHaveBeenCalledTimes(1);
    });
  });

  describe('incrementVisitedGridRefreshVersion', () => {
    it('呼び出すと getVisitedCellsInBounds が再度呼ばれる', async () => {
      let result: UseVisitedGridOverlayResult | undefined;

      await act(async () => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
        await Promise.resolve();
      });

      const callCountBefore = (getVisitedCellsInBounds as jest.Mock).mock.calls.length;

      await act(async () => {
        result!.incrementVisitedGridRefreshVersion();
        await Promise.resolve();
      });

      expect((getVisitedCellsInBounds as jest.Mock).mock.calls.length).toBeGreaterThan(callCountBefore);
    });
  });
});
