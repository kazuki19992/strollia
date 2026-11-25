import type { AnnualReportAreaMap } from '@/features/annualReport/annualReportTypes';
import {
  areaCellToPolygon,
  buildAreaSampleCells,
  buildCalendarCells,
  createRoutePlayback,
  downsampleRoute,
  quantizeRevealCount,
  formatClockTime,
  hasPrivacyRadiusInAreaMap,
  hideAreaMapCellsByPrivacy,
  isAreaCellHiddenByPrivacy,
  resolveRoutePlaybackFrame,
  toFarthestDayPlaybackRoute,
} from '@/features/annualReport/annualReportVisuals';
import { cellToPolygonCoordinates, coordinateToGridCell } from '@/features/location/grid/gridCell';
import type { StayPlace } from '@/features/stayPlaces/stayPlaceTypes';

/** テスト用の滞在場所。 */
function stayPlace(latitude: number, longitude: number, privacyRadiusMeters: number | null): StayPlace {
  return {
    id: 1,
    name: '自宅',
    iconHexcode: '1F3E0',
    latitude,
    longitude,
    privacyRadiusMeters,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

/** 10km のマスとその中心。 */
const BIG_CELL_SIZE = 10000;
const bigGridCell = coordinateToGridCell({ latitude: 35.68, longitude: 139.76 }, BIG_CELL_SIZE);
const bigCell: [number, number] = [bigGridCell.x, bigGridCell.y];
const bigCellCorners = cellToPolygonCoordinates(bigGridCell);
const bigCellCenter = {
  latitude: (bigCellCorners[0].latitude + bigCellCorners[2].latitude) / 2,
  longitude: (bigCellCorners[0].longitude + bigCellCorners[2].longitude) / 2,
};

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

  describe('新しく塗ったエリアの地図のマスと非表示範囲', () => {
    it('areaCellToPolygon はセル番号から地図画面と同じ4頂点を作る', () => {
      expect(areaCellToPolygon(bigCell, BIG_CELL_SIZE)).toEqual(bigCellCorners);
    });

    it('非表示範囲の円が大きいマスの内側にすっぽり入り辺に触れない場合も、範囲にかかるとみなす', () => {
      expect(isAreaCellHiddenByPrivacy(bigCell, BIG_CELL_SIZE, [stayPlace(bigCellCenter.latitude, bigCellCenter.longitude, 100)])).toBe(
        true,
      );
    });

    it('円の中心がマスの外でも、半径がマスの辺にかかれば範囲にかかるとみなす', () => {
      // 北の辺から約50m 外側に中心を置き、半径100m で辺にかかる
      const outside = stayPlace(bigCellCorners[2].latitude + 0.00045, bigCellCenter.longitude, 100);

      expect(isAreaCellHiddenByPrivacy(bigCell, BIG_CELL_SIZE, [outside])).toBe(true);
    });

    it('遠くの滞在場所では隠さない', () => {
      expect(isAreaCellHiddenByPrivacy(bigCell, BIG_CELL_SIZE, [stayPlace(bigCellCenter.latitude + 1, bigCellCenter.longitude, 100)])).toBe(
        false,
      );
    });

    it('非表示半径を設定していない(null)滞在場所は、マスの中にあっても無視する', () => {
      expect(isAreaCellHiddenByPrivacy(bigCell, BIG_CELL_SIZE, [stayPlace(bigCellCenter.latitude, bigCellCenter.longitude, null)])).toBe(
        false,
      );
    });

    it('非表示設定が壊れているときは安全側に倒して、すべてのマスを隠す', () => {
      const broken = [stayPlace(bigCellCenter.latitude + 1, bigCellCenter.longitude, 123)];
      const areaMap: AnnualReportAreaMap = {
        cellSizeMeters: BIG_CELL_SIZE,
        newCells: [bigCell],
        previousCells: [[bigCell[0] + 1, bigCell[1]]],
      };

      expect(isAreaCellHiddenByPrivacy(bigCell, BIG_CELL_SIZE, broken)).toBe(true);
      expect(hideAreaMapCellsByPrivacy(areaMap, broken)).toEqual({ cellSizeMeters: BIG_CELL_SIZE, newCells: [], previousCells: [] });
    });

    it('hideAreaMapCellsByPrivacy は新しいマス・前からのマスの両方から範囲にかかるマスだけを除く', () => {
      const neighbor: [number, number] = [bigCell[0] + 3, bigCell[1]];
      const areaMap: AnnualReportAreaMap = {
        cellSizeMeters: BIG_CELL_SIZE,
        newCells: [bigCell, neighbor],
        previousCells: [bigCell, neighbor],
      };

      const hidden = hideAreaMapCellsByPrivacy(areaMap, [stayPlace(bigCellCenter.latitude, bigCellCenter.longitude, 100)]);

      expect(hidden).toEqual({ cellSizeMeters: BIG_CELL_SIZE, newCells: [neighbor], previousCells: [neighbor] });
    });

    it('hasPrivacyRadiusInAreaMap は新しいマス・前からのマスのどちらがかかっても true', () => {
      const home = [stayPlace(bigCellCenter.latitude, bigCellCenter.longitude, 100)];
      const far: [number, number] = [bigCell[0] + 5, bigCell[1]];

      expect(hasPrivacyRadiusInAreaMap({ cellSizeMeters: BIG_CELL_SIZE, newCells: [bigCell], previousCells: [] }, home)).toBe(true);
      expect(hasPrivacyRadiusInAreaMap({ cellSizeMeters: BIG_CELL_SIZE, newCells: [far], previousCells: [bigCell] }, home)).toBe(true);
      expect(hasPrivacyRadiusInAreaMap({ cellSizeMeters: BIG_CELL_SIZE, newCells: [far], previousCells: [] }, home)).toBe(false);
    });
  });
});
