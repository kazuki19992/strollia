import { developmentFlags } from '@/config/developmentFlags';
import {
  calculatePolygonReductionRatio,
  formatVisitedGridMetrics,
  formatVisitedGridSourceUpdate,
  logVisitedGridMetrics,
  logVisitedGridSourceUpdate,
} from '@/features/map/visitedGridMetrics';

/** テスト用の計測値。 */
const METRICS = {
  rawCellCount: 160,
  stableCellCount: 158,
  freshCellCount: 2,
  renderPolygonCount: 22,
  coalescedBlockCountBySize: { '4x4': 9, '2x2': 3, '1x1': 8 },
  fetchMs: 12,
  aggregationMs: 3,
  overlayBuildMs: 4,
};

describe('Visited Grid計測 visitedGridMetrics', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('calculatePolygonReductionRatio', () => {
    it('結合でPolygon数が減った割合を返す', () => {
      expect(calculatePolygonReductionRatio(160, 40)).toBeCloseTo(0.75);
    });

    it('元のセル数が0の場合は0を返す', () => {
      expect(calculatePolygonReductionRatio(0, 0)).toBe(0);
    });

    it('結合できずPolygon数が変わらない場合は0を返す', () => {
      expect(calculatePolygonReductionRatio(10, 10)).toBe(0);
    });
  });

  describe('formatVisitedGridMetrics', () => {
    it('件数・処理時間・削減率を含む1行の文字列を返す', () => {
      const formatted = formatVisitedGridMetrics(METRICS);

      expect(formatted).toContain('raw=160');
      expect(formatted).toContain('stable=158');
      expect(formatted).toContain('fresh=2');
      expect(formatted).toContain('render=22');
      expect(formatted).toContain('4x4=9');
      expect(formatted).toContain('fetchMs=12');
      expect(formatted).toContain('aggregationMs=3');
      expect(formatted).toContain('overlayBuildMs=4');
      expect(formatted).toContain('reduction=86.3%');
    });

    it('緯度経度など位置そのものを示す値は含めない', () => {
      const formatted = formatVisitedGridMetrics(METRICS);

      expect(formatted).not.toMatch(/latitude|longitude|cellId/i);
    });
  });

  describe('logVisitedGridMetrics', () => {
    it('開発フラグが無効なら出力しない', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      jest.replaceProperty(developmentFlags, 'logVisitedGridMetrics', false);

      logVisitedGridMetrics(METRICS);

      expect(logSpy).not.toHaveBeenCalled();
    });

    it('開発フラグが有効なら整形済み文字列を出力する', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      jest.replaceProperty(developmentFlags, 'logVisitedGridMetrics', true);

      logVisitedGridMetrics(METRICS);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[VisitedGrid]'));
    });
  });
});

describe('取得結果の更新/スキップログ formatVisitedGridSourceUpdate', () => {
  it('スキップした回は source=skipped と累計値を含む1行を返す', () => {
    const line = formatVisitedGridSourceUpdate({ outcome: 'skipped', cellCount: 1234, updatedCount: 3, skippedCount: 57 });

    expect(line).toBe('[VisitedGrid] source=skipped cells=1234 updated=3 skipped=57');
  });

  it('更新した回は source=updated になる', () => {
    const line = formatVisitedGridSourceUpdate({ outcome: 'updated', cellCount: 10, updatedCount: 1, skippedCount: 0 });

    expect(line).toBe('[VisitedGrid] source=updated cells=10 updated=1 skipped=0');
  });
});

describe('取得結果の更新/スキップログ出力 logVisitedGridSourceUpdate', () => {
  /** テスト用の更新/スキップ計測値。 */
  const SOURCE_UPDATE_METRICS = { outcome: 'skipped', cellCount: 1234, updatedCount: 3, skippedCount: 57 } as const;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('開発フラグが無効なら出力しない', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.replaceProperty(developmentFlags, 'logVisitedGridMetrics', false);

    logVisitedGridSourceUpdate(SOURCE_UPDATE_METRICS);

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('開発フラグが有効なら整形済み文字列を出力する', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.replaceProperty(developmentFlags, 'logVisitedGridMetrics', true);

    logVisitedGridSourceUpdate(SOURCE_UPDATE_METRICS);

    expect(logSpy).toHaveBeenCalledWith(formatVisitedGridSourceUpdate(SOURCE_UPDATE_METRICS));
  });
});
