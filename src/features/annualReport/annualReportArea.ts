/** Web Mercator で使う地球半径。単位は m。`gridCell.ts` の投影と同じ値にそろえる。 */
const WEB_MERCATOR_RADIUS_METERS = 6_378_137;

/** セルサイズと Y 番号ごとに数えた、新しく塗ったエリアの件数。 */
export type CellRowCount = {
  /** セルサイズ(Web Mercator 上の一辺)。単位は m。 */
  cellSizeMeters: number;
  /** Web Mercator メートル座標をセルサイズで割った Y 番号。 */
  y: number;
  /** その行に含まれるセル数。 */
  count: number;
};

/**
 * Web Mercator の Y 番号の行にあるセル1件の、地表での実面積(m²)を返す。
 *
 * Web Mercator のセルは投影上は正方形だが、地表では緯度が高いほど cos(緯度) 倍に縮む。
 * 行の中心緯度で一辺を縮めて二乗し、年間レポートで「どれくらいの広さか」を示すのに十分な精度にしている。
 */
export function cellRowGroundAreaSquareMeters(cellSizeMeters: number, y: number): number {
  const centerMercatorY = (y + 0.5) * cellSizeMeters;
  const latitudeRadians = 2 * Math.atan(Math.exp(centerMercatorY / WEB_MERCATOR_RADIUS_METERS)) - Math.PI / 2;
  const groundSide = cellSizeMeters * Math.cos(latitudeRadians);
  return groundSide * groundSide;
}

/** 行ごとの件数から、地表での実面積の合計(m²)を返す。行が無ければ0。 */
export function sumGroundAreaSquareMeters(rows: CellRowCount[]): number {
  return rows.reduce((sum, row) => sum + row.count * cellRowGroundAreaSquareMeters(row.cellSizeMeters, row.y), 0);
}
