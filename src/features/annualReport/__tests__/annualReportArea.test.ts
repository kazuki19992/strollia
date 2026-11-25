import { cellRowGroundAreaSquareMeters, sumGroundAreaSquareMeters } from '@/features/annualReport/annualReportArea';

/** Web Mercator で使う地球半径(m)。テスト内で緯度からY番号を求めるために使う。 */
const RADIUS = 6_378_137;

/** 緯度(度)を、指定セルサイズのY番号へ変換する。 */
function rowAt(latitude: number, cellSizeMeters = 100): number {
  const radians = (latitude * Math.PI) / 180;
  return Math.floor((RADIUS * Math.log(Math.tan(Math.PI / 4 + radians / 2))) / cellSizeMeters);
}

describe('新しいエリアの実面積 annualReportArea', () => {
  test('赤道付近(y=0)の100mセル1件は約10,000m²', () => {
    expect(cellRowGroundAreaSquareMeters(100, 0)).toBeCloseTo(10_000, 0);
  });

  test('緯度35°付近の100mセルは約6,700m²(±1%)', () => {
    const area = cellRowGroundAreaSquareMeters(100, rowAt(35));

    expect(area).toBeGreaterThan(6_700 * 0.99);
    expect(area).toBeLessThan(6_700 * 1.01);
  });

  test('南半球の行も緯度に応じて縮む(負のY番号でも正しく扱う)', () => {
    expect(cellRowGroundAreaSquareMeters(100, rowAt(-35))).toBeCloseTo(cellRowGroundAreaSquareMeters(100, rowAt(35)), -1);
  });

  test('複数行の面積を件数で重み付けして合計する', () => {
    const rows = [
      { cellSizeMeters: 100, y: 0, count: 2 },
      { cellSizeMeters: 100, y: rowAt(35), count: 3 },
    ];

    expect(sumGroundAreaSquareMeters(rows)).toBeCloseTo(2 * 10_000 + 3 * cellRowGroundAreaSquareMeters(100, rowAt(35)), 3);
  });

  test('行が無ければ0を返す', () => {
    expect(sumGroundAreaSquareMeters([])).toBe(0);
  });
});
