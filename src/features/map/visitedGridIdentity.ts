import type { GridCellPolygonSource } from '@/features/location/grid/gridCell';

/** 更新スキップ判定に使う直近取得の要約。 */
export type PreviousVisitedGridFetchSummary = {
  /** 前回取得できた表示セルID。 */
  cellIds: ReadonlySet<string>;
  /** 前回取得時の表示セルサイズ。単位はm。 */
  cellSizeMeters: number;
};

/** `canSkipVisitedGridSourceUpdate` の引数。 */
export type CanSkipVisitedGridSourceUpdateParams = {
  /** 直近取得の要約。初回取得ならnull。 */
  previousFetch: PreviousVisitedGridFetchSummary | null;
  /** 今回取得した表示セル。 */
  nextCells: readonly GridCellPolygonSource[];
  /** 今回の表示セルサイズ。単位はm。 */
  displayCellSizeMeters: number;
  /** 今回fresh(GPS記録で新しく開いた)と判定されたセルID。 */
  detectedFreshCellIds: ReadonlySet<string>;
};

/**
 * 前回取得の表示セルID集合と今回の取得結果が同一かを返す。
 *
 * 比較対象はセルIDだけで、`visitCount` / `firstVisitedAt` / `lastVisitedAt` は見ない。
 * 現在地セルのこれらの値はGPS記録のたびに更新されるため、比較へ含めると「変化なし」と
 * 判定できる回がほぼなくなり、更新スキップによる軽量化が成立しなくなる。
 * 描画側(`toVisitedGridOverlayCells` → MapView Polygon)はセルIDと座標・テーマ色だけを
 * 使うため、セルID集合が同じなら描画結果も同一である。
 *
 * 将来メタデータを描画へ反映する場合は、この判定も合わせて見直すこと。
 *
 * 取得結果のセルIDはSQLの `GROUP BY` により一意なため、件数一致と包含だけで集合の一致と等価になる。
 *
 * @param previousCellIds - 前回取得できた表示セルID。
 * @param nextCells - 今回取得した表示セル。
 * @returns セルID集合が同一ならtrue。
 */
export function hasSameVisitedGridCellIds(previousCellIds: ReadonlySet<string>, nextCells: readonly GridCellPolygonSource[]): boolean {
  if (previousCellIds.size !== nextCells.length) {
    return false;
  }

  for (const cell of nextCells) {
    if (!previousCellIds.has(cell.cellId)) {
      return false;
    }
  }

  return true;
}

/**
 * 今回の取得結果で描画データの更新を省略してよいかを返す。
 *
 * 追従モード中は現在地更新のたびに再取得が走るが、その大半は表示セルの集合が変わらない。
 * 変わらない回の state 更新を止めることで、Polygon結合・座標変換・Polygon生成を丸ごと省く。
 *
 * @param params - 直近取得の要約と今回の取得結果。
 * @returns 更新を省略してよいならtrue。
 */
export function canSkipVisitedGridSourceUpdate({
  previousFetch,
  nextCells,
  displayCellSizeMeters,
  detectedFreshCellIds,
}: CanSkipVisitedGridSourceUpdateParams): boolean {
  // 初回取得は比較対象がないため必ず更新する。
  if (!previousFetch) {
    return false;
  }

  // 表示セルサイズが変わるとセルIDの体系ごと変わるため、必ず作り直す。
  if (previousFetch.cellSizeMeters !== displayCellSizeMeters) {
    return false;
  }

  // freshは結合除外とフェードの対象になるため、検出があれば必ず更新する。
  if (detectedFreshCellIds.size > 0) {
    return false;
  }

  return hasSameVisitedGridCellIds(previousFetch.cellIds, nextCells);
}
