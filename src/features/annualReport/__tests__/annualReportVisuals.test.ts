import {
  buildAreaTileLayout,
  buildCalendarCells,
  createRoutePlayback,
  downsampleRoute,
  quantizeRevealCount,
  formatClockTime,
  resolveRoutePlaybackFrame,
  toFarthestDayPlaybackRoute,
} from '@/features/annualReport/annualReportVisuals';

describe('年間レポートの表示用データ annualReportVisuals', () => {
  describe('buildCalendarCells', () => {
    it('対象年の全日を1月1日から順に並べ、記録のある日だけ点灯にする', () => {
      const cells = buildCalendarCells(2026, ['2026-01-02', '2026-12-31']);

      expect(cells).toHaveLength(365);
      expect(cells[0]).toEqual({ date: '2026-01-01', active: false });
      expect(cells[1]).toEqual({ date: '2026-01-02', active: true });
      expect(cells[364]).toEqual({ date: '2026-12-31', active: true });
    });

    it('うるう年は366日になる', () => {
      expect(buildCalendarCells(2028, [])).toHaveLength(366);
    });
  });

  describe('buildAreaTileLayout', () => {
    test('0件はタイルなし(列・行・1枚あたりのマス数もすべて0)', () => {
      expect(buildAreaTileLayout(0)).toEqual({ columns: 0, rows: 0, tileCount: 0, cellsPerTile: 0 });
    });

    test('1件は1×1の1枚', () => {
      expect(buildAreaTileLayout(1)).toEqual({ columns: 1, rows: 1, tileCount: 1, cellsPerTile: 1 });
    });

    test('7件は3列3行の格子に7枚(正方形に近い形)', () => {
      expect(buildAreaTileLayout(7)).toEqual({ columns: 3, rows: 3, tileCount: 7, cellsPerTile: 1 });
    });

    test('100件は10×10で1枚1マス', () => {
      expect(buildAreaTileLayout(100)).toEqual({ columns: 10, rows: 10, tileCount: 100, cellsPerTile: 1 });
    });

    test('487件は100枚にまとめ、1枚あたり5マスを表す', () => {
      expect(buildAreaTileLayout(487)).toEqual({ columns: 10, rows: 10, tileCount: 100, cellsPerTile: 5 });
    });

    test('100万件でもタイルは100枚のまま(1枚あたりのマス数だけ増える)', () => {
      expect(buildAreaTileLayout(1_000_000)).toEqual({ columns: 10, rows: 10, tileCount: 100, cellsPerTile: 10_000 });
    });

    test('上限枚数を指定できる', () => {
      expect(buildAreaTileLayout(50, 16)).toEqual({ columns: 4, rows: 4, tileCount: 16, cellsPerTile: 4 });
    });
  });

  describe('formatClockTime', () => {
    it('端末ローカル時刻をHH:MMで返す', () => {
      const date = new Date(2026, 7, 14, 7, 5, 30);

      expect(formatClockTime(date.getTime())).toBe('07:05');
    });
  });

  describe('resolveRoutePlaybackFrame', () => {
    const route = [
      { latitude: 35, longitude: 139, recordedAt: new Date(2026, 7, 14, 8, 0).toISOString() },
      { latitude: 35, longitude: 139.01, recordedAt: new Date(2026, 7, 14, 9, 0).toISOString() },
      { latitude: 35, longitude: 139.03, recordedAt: new Date(2026, 7, 14, 12, 0).toISOString() },
    ];

    it('進行度0では始点にいて、軌跡は始点だけになる', () => {
      const frame = resolveRoutePlaybackFrame(createRoutePlayback(route), 0);

      expect(frame.position).toEqual({ latitude: 35, longitude: 139 });
      expect(frame.trail).toEqual([{ latitude: 35, longitude: 139 }]);
      expect(frame.distanceFraction).toBe(0);
      expect(formatClockTime(frame.recordedAtMs)).toBe('08:00');
    });

    it('進行度は経路長の割合で、点間の位置と時刻を補間する', () => {
      // 全長の2/3は2本目の線分のちょうど中間(1本目が1/3、2本目が2/3の長さ)
      const frame = resolveRoutePlaybackFrame(createRoutePlayback(route), 2 / 3);

      expect(frame.position.longitude).toBeCloseTo(139.02, 5);
      expect(frame.trail).toHaveLength(3);
      expect(frame.distanceFraction).toBeCloseTo(2 / 3, 5);
      // 9:00〜12:00 の中間
      expect(frame.recordedAtMs).toBeCloseTo(new Date(2026, 7, 14, 10, 30).getTime(), -4);
    });

    it('進行度1では終点にいて、軌跡は全点になる', () => {
      const frame = resolveRoutePlaybackFrame(createRoutePlayback(route), 1);

      expect(frame.position).toEqual({ latitude: 35, longitude: 139.03 });
      expect(frame.trail).toHaveLength(3);
      expect(frame.distanceFraction).toBe(1);
    });

    it('点が1つ以下のルートでも落ちない', () => {
      const frame = resolveRoutePlaybackFrame(createRoutePlayback([route[0]]), 0.5);

      expect(frame.position).toEqual({ latitude: 35, longitude: 139 });
      expect(resolveRoutePlaybackFrame(createRoutePlayback([]), 0.5).trail).toEqual([]);
    });
  });

  describe('toFarthestDayPlaybackRoute', () => {
    it('最遠日のルートを再生用の最大300点に間引き、始点と終点を残す', () => {
      const route = Array.from({ length: 500 }, (_, index) => index);

      const sampled = toFarthestDayPlaybackRoute(route);

      expect(sampled).toHaveLength(300);
      expect(sampled[0]).toBe(0);
      expect(sampled[299]).toBe(499);
      expect(sampled).toEqual(downsampleRoute(route, 300));
    });
  });

  describe('downsampleRoute', () => {
    const route = Array.from({ length: 1000 }, (_, index) => ({ latitude: 35, longitude: 139 + index / 1000, recordedAt: `t${index}` }));

    it('上限以下ならそのまま返す', () => {
      expect(downsampleRoute(route.slice(0, 10), 300)).toEqual(route.slice(0, 10));
    });

    it('上限を超えると始点と終点を残して等間隔に間引く', () => {
      const sampled = downsampleRoute(route, 300);

      expect(sampled).toHaveLength(300);
      expect(sampled[0]).toBe(route[0]);
      expect(sampled[299]).toBe(route[999]);
    });
  });

  describe('quantizeRevealCount', () => {
    it('開始前は0、終了後は全件を返す', () => {
      expect(quantizeRevealCount(0, 900, 10, 365, 40)).toBe(0);
      expect(quantizeRevealCount(100_000, 900, 10, 365, 40)).toBe(365);
    });

    it('途中は段階数に合わせて切り上げた件数を返す', () => {
      // 100件・10段階なら10件刻み。開始から15件分経過 → 20件
      expect(quantizeRevealCount(900 + 15 * 10, 900, 10, 100, 10)).toBe(20);
    });
  });
});
