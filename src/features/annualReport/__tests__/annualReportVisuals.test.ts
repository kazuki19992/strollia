import {
  buildAreaSampleCells,
  buildCalendarCells,
  createRoutePlayback,
  formatClockTime,
  resolveRoutePlaybackFrame,
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

  describe('buildAreaSampleCells', () => {
    it('指定したマス数を返し、新旧の比率に応じて塗り分ける', () => {
      const cells = buildAreaSampleCells(100, 100, 100);

      expect(cells).toHaveLength(100);
      const oldCount = cells.filter((cell) => cell === 'old').length;
      const newCount = cells.filter((cell) => cell === 'new').length;
      expect(oldCount + newCount).toBe(62);
      expect(newCount).toBe(31);
    });

    it('新しいエリアが少なくても1マスは新しいエリアとして塗る', () => {
      const cells = buildAreaSampleCells(100_000, 1, 100);

      expect(cells.filter((cell) => cell === 'new')).toHaveLength(1);
    });

    it('前年までのエリアが0なら全て新しいエリアになる', () => {
      const cells = buildAreaSampleCells(0, 5, 50);

      expect(cells.filter((cell) => cell === 'old')).toHaveLength(0);
      expect(cells.filter((cell) => cell === 'new')).toHaveLength(31);
    });

    it('同じ入力なら毎回同じ並びになる', () => {
      expect(buildAreaSampleCells(10, 20, 80)).toEqual(buildAreaSampleCells(10, 20, 80));
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
});
