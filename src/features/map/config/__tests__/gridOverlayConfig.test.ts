import { GRID_OVERLAY_CONFIG, GridOverlayConfig } from '@/features/map/config/gridOverlayConfig';

describe('gridOverlayConfig グリッドオーバーレイ設定値', () => {
  describe('GRID_OVERLAY_CONFIG 設定値の整合性', () => {
    it('baseCellSizeMeters が正の整数である', () => {
      expect(GRID_OVERLAY_CONFIG.baseCellSizeMeters).toBeGreaterThan(0);
      expect(Number.isInteger(GRID_OVERLAY_CONFIG.baseCellSizeMeters)).toBe(true);
    });

    it('displayCellSizesMeters が空でない配列である', () => {
      expect(Array.isArray(GRID_OVERLAY_CONFIG.displayCellSizesMeters)).toBe(true);
      expect(GRID_OVERLAY_CONFIG.displayCellSizesMeters.length).toBeGreaterThan(0);
    });

    it('displayCellSizesMeters が昇順に並んでいる', () => {
      const sizes = GRID_OVERLAY_CONFIG.displayCellSizesMeters;
      for (let i = 1; i < sizes.length; i++) {
        expect(sizes[i]).toBeGreaterThan(sizes[i - 1]!);
      }
    });

    it('displayCellSizesMeters の先頭要素が baseCellSizeMeters と一致する', () => {
      expect(GRID_OVERLAY_CONFIG.displayCellSizesMeters[0]).toBe(GRID_OVERLAY_CONFIG.baseCellSizeMeters);
    });

    it('minimumFogOpacity が 0〜1 の範囲内である', () => {
      expect(GRID_OVERLAY_CONFIG.minimumFogOpacity).toBeGreaterThanOrEqual(0);
      expect(GRID_OVERLAY_CONFIG.minimumFogOpacity).toBeLessThanOrEqual(1);
    });

    it('maximumFogOpacity が 0〜1 の範囲内である', () => {
      expect(GRID_OVERLAY_CONFIG.maximumFogOpacity).toBeGreaterThanOrEqual(0);
      expect(GRID_OVERLAY_CONFIG.maximumFogOpacity).toBeLessThanOrEqual(1);
    });

    it('minimumFogOpacity が maximumFogOpacity 以下である', () => {
      expect(GRID_OVERLAY_CONFIG.minimumFogOpacity).toBeLessThanOrEqual(GRID_OVERLAY_CONFIG.maximumFogOpacity);
    });

    it('opacityStartLatitudeDelta が opacityEndLatitudeDelta より小さい', () => {
      expect(GRID_OVERLAY_CONFIG.opacityStartLatitudeDelta).toBeLessThan(GRID_OVERLAY_CONFIG.opacityEndLatitudeDelta);
    });

    it('opacityStartLatitudeDelta が正の値である', () => {
      expect(GRID_OVERLAY_CONFIG.opacityStartLatitudeDelta).toBeGreaterThan(0);
    });

    it('fogColor が CSS hex カラー形式の文字列である', () => {
      expect(GRID_OVERLAY_CONFIG.fogColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('visitedCellColorOverride がデフォルトで null である', () => {
      expect(GRID_OVERLAY_CONFIG.visitedCellColorOverride).toBeNull();
    });

    it('boundsPaddingRatio が正の値である', () => {
      expect(GRID_OVERLAY_CONFIG.boundsPaddingRatio).toBeGreaterThan(0);
    });

    it('displayCellSizeHysteresisRatio が 0〜1 の範囲内である', () => {
      expect(GRID_OVERLAY_CONFIG.displayCellSizeHysteresisRatio).toBeGreaterThanOrEqual(0);
      expect(GRID_OVERLAY_CONFIG.displayCellSizeHysteresisRatio).toBeLessThanOrEqual(1);
    });
  });

  describe('GridOverlayConfig 型の構造確認', () => {
    it('GRID_OVERLAY_CONFIG が GridOverlayConfig の全フィールドを持つ', () => {
      const requiredKeys: (keyof GridOverlayConfig)[] = [
        'baseCellSizeMeters',
        'displayCellSizesMeters',
        'minimumFogOpacity',
        'maximumFogOpacity',
        'opacityStartLatitudeDelta',
        'opacityEndLatitudeDelta',
        'fogColor',
        'visitedCellColorOverride',
        'boundsPaddingRatio',
        'displayCellSizeHysteresisRatio',
      ];

      for (const key of requiredKeys) {
        expect(Object.prototype.hasOwnProperty.call(GRID_OVERLAY_CONFIG, key)).toBe(true);
      }
    });
  });
});
