import { developmentFlags } from '@/config/developmentFlags';

/**
 * Visited Grid Overlay 1回ぶんの取得・結合・描画コスト。
 *
 * 位置そのものを示す値(緯度経度・cellId)は持たせない。開発中に件数と処理時間だけを
 * 確認するための型であり、本番ユーザーのログへ出さない前提で設計している。
 */
export type VisitedGridMetrics = {
  /** DBから取得した表示セル数。 */
  rawCellCount: number;
  /** 結合対象になり得る既存セル数。 */
  stableCellCount: number;
  /** 新規で開いたため結合しないセル数。 */
  freshCellCount: number;
  /** 最終的にMapViewへ渡すPolygon数。 */
  renderPolygonCount: number;
  /** `4x4` などブロック倍率ごとの結合数。 */
  coalescedBlockCountBySize: Record<string, number>;
  /** SQLite取得時間。単位はms。 */
  fetchMs: number;
  /** 新規セル判定とPolygon結合にかかった時間。単位はms。 */
  aggregationMs: number;
  /** Polygon用データ変換時間。単位はms。 */
  overlayBuildMs: number;
};

/**
 * Polygon結合による削減率を返す。
 *
 * @param rawCellCount - 結合前の表示セル数。
 * @param renderPolygonCount - 結合後のPolygon数。
 * @returns 0から1の削減率。元が0件、または削減されていない場合は0。
 */
export function calculatePolygonReductionRatio(rawCellCount: number, renderPolygonCount: number): number {
  if (rawCellCount <= 0) {
    return 0;
  }

  return Math.max(0, 1 - renderPolygonCount / rawCellCount);
}

/**
 * 計測値を1行のログ文字列へ整形する。
 *
 * @param metrics - 計測値。
 * @returns 開発ログ用の1行文字列。
 */
export function formatVisitedGridMetrics(metrics: VisitedGridMetrics): string {
  const reductionPercent = (calculatePolygonReductionRatio(metrics.rawCellCount, metrics.renderPolygonCount) * 100).toFixed(1);
  const blocks = Object.entries(metrics.coalescedBlockCountBySize)
    .map(([size, count]) => `${size}=${count}`)
    .join(' ');

  return [
    '[VisitedGrid]',
    `raw=${metrics.rawCellCount}`,
    `stable=${metrics.stableCellCount}`,
    `fresh=${metrics.freshCellCount}`,
    `render=${metrics.renderPolygonCount}`,
    `reduction=${reductionPercent}%`,
    `blocks(${blocks})`,
    `fetchMs=${metrics.fetchMs}`,
    `aggregationMs=${metrics.aggregationMs}`,
    `overlayBuildMs=${metrics.overlayBuildMs}`,
  ].join(' ');
}

/**
 * 開発フラグが有効な場合だけ計測値を出力する。
 *
 * 本番ユーザーのログを汚さないよう `EXPO_PUBLIC_LOG_VISITED_GRID_METRICS` 有効時に限定する。
 *
 * @param metrics - 計測値。
 * @returns なし。
 */
export function logVisitedGridMetrics(metrics: VisitedGridMetrics): void {
  if (!developmentFlags.logVisitedGridMetrics) {
    return;
  }

  console.log(formatVisitedGridMetrics(metrics));
}

/** `visitedGridSource` を更新したか、同一結果としてスキップしたか。 */
export type VisitedGridSourceUpdateOutcome = 'updated' | 'skipped';

/**
 * 1回の取得で描画データを更新したか、スキップしたかの計測値。
 *
 * 既存の `VisitedGridMetrics` は描画データが変わったときにしか出力されないため、
 * スキップした回を観測できない。ログの少なさが「位置更新が来なかった」のか
 * 「取得したうえでスキップした」のかを区別するために、取得のたびに1行出す。
 */
export type VisitedGridSourceUpdateMetrics = {
  /** 今回の取得で state を更新したか、スキップしたか。 */
  outcome: VisitedGridSourceUpdateOutcome;
  /** 取得できた表示セル数。 */
  cellCount: number;
  /** 起動後に更新した累計回数。 */
  updatedCount: number;
  /** 起動後にスキップした累計回数。 */
  skippedCount: number;
};

/**
 * 更新/スキップの計測値を1行のログ文字列へ整形する。
 *
 * @param metrics - 計測値。
 * @returns 開発ログ用の1行文字列。
 */
export function formatVisitedGridSourceUpdate(metrics: VisitedGridSourceUpdateMetrics): string {
  return [
    '[VisitedGrid]',
    `source=${metrics.outcome}`,
    `cells=${metrics.cellCount}`,
    `updated=${metrics.updatedCount}`,
    `skipped=${metrics.skippedCount}`,
  ].join(' ');
}

/**
 * 開発フラグが有効な場合だけ更新/スキップの計測値を出力する。
 *
 * @param metrics - 計測値。
 * @returns なし。
 */
export function logVisitedGridSourceUpdate(metrics: VisitedGridSourceUpdateMetrics): void {
  if (!developmentFlags.logVisitedGridMetrics) {
    return;
  }

  console.log(formatVisitedGridSourceUpdate(metrics));
}
