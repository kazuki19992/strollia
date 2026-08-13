import { GRID_OVERLAY_CONFIG } from '@/features/map/config/gridOverlayConfig';
import { getDisplayCellSizeMeters, getStableDisplayCellSizeMeters } from '@/features/location/grid/gridAggregation';

describe('Visited Grid表示集約 gridAggregation', () => {
  it('ズームに応じて表示セルサイズを選ぶ', () => {
    expect(getDisplayCellSizeMeters({ latitudeDelta: 0.005 }, GRID_OVERLAY_CONFIG)).toBe(100);
    expect(getDisplayCellSizeMeters({ latitudeDelta: 0.03 }, GRID_OVERLAY_CONFIG)).toBe(100);
    expect(getDisplayCellSizeMeters({ latitudeDelta: 0.08 }, GRID_OVERLAY_CONFIG)).toBe(200);
    expect(getDisplayCellSizeMeters({ latitudeDelta: 0.5 }, GRID_OVERLAY_CONFIG)).toBe(1000);
    expect(getDisplayCellSizeMeters({ latitudeDelta: 2.5 }, GRID_OVERLAY_CONFIG)).toBe(5000);
    expect(getDisplayCellSizeMeters({ latitudeDelta: 4.5 }, GRID_OVERLAY_CONFIG)).toBe(10000);
  });

  it('セルサイズ切替境界付近では直前の表示セルサイズを維持する', () => {
    expect(getStableDisplayCellSizeMeters({ latitudeDelta: 0.061 }, 100, GRID_OVERLAY_CONFIG)).toBe(100);
    expect(getStableDisplayCellSizeMeters({ latitudeDelta: 0.05 }, 200, GRID_OVERLAY_CONFIG)).toBe(200);
  });

  it('セルサイズ切替境界から十分離れた場合は次の表示セルサイズへ切り替える', () => {
    expect(getStableDisplayCellSizeMeters({ latitudeDelta: 0.073 }, 100, GRID_OVERLAY_CONFIG)).toBe(200);
    expect(getStableDisplayCellSizeMeters({ latitudeDelta: 0.04 }, 200, GRID_OVERLAY_CONFIG)).toBe(100);
  });
});
