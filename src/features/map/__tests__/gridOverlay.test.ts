import { GRID_OVERLAY_CONFIG } from '../config/gridOverlayConfig';
import { getFogOpacity } from '../gridOverlay';

describe('Visited Grid Overlay表示計算 gridOverlay', () => {
  it('latitudeDeltaに応じてFog opacityを線形補間する', () => {
    expect(getFogOpacity({ latitudeDelta: 0.001 }, GRID_OVERLAY_CONFIG)).toBe(0.2);
    expect(getFogOpacity({ latitudeDelta: 0.2 }, GRID_OVERLAY_CONFIG)).toBe(0.6);
    expect(getFogOpacity({ latitudeDelta: 0.105 }, GRID_OVERLAY_CONFIG)).toBeCloseTo(0.4);
  });
});
