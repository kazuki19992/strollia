import { developmentFlags } from '@/config/developmentFlags';

/**
 * 写真ライブラリ走査1回ぶんの計測値。
 *
 * **内訳を分けて持つ。** 走査上限の撤廃(Phase 2-c)を設計するには、1万件規模へ外挿できる形の
 * 数字が要る。「メタデータ取得は件数に対してほぼ一定か」「位置情報取得が支配的か」
 * 「DB保存が効いてくるのは何件からか」は合計時間だけでは見分けられないため、
 * フェーズごとの所要時間を別々に持つ。
 *
 * 計測はフラグに関係なく常に行う(`Date.now()` の差分でありコストは無視できる)。
 * 表示するかどうかだけをフラグで切り替える。
 */
export type PhotoScanMetrics = {
  /** 走査したアセット件数(次ページ判定用の超過分は含まない)。 */
  scannedAssetCount: number;
  /** ジオタグを持っていた件数。 */
  geotaggedPhotoCount: number;
  /** `getLocation()` がrejectした件数。 */
  locationRejectedCount: number;
  /** `exeForMetadata()` の所要時間(ミリ秒)。 */
  metadataDurationMs: number;
  /** `getLocation()` 全体の所要時間(ミリ秒)。 */
  locationDurationMs: number;
  /** `savePhotoAssets`(走査済み窓との突き合わせを含む)の所要時間(ミリ秒)。 */
  saveDurationMs: number;
  /** 走査全体の所要時間(ミリ秒)。 */
  totalDurationMs: number;
};

/**
 * 所要時間を秒(小数1桁)の表示へ変換する。
 *
 * スクリーンショットから読み取る前提なので、ミリ秒の桁は落として比較しやすい粒度にする。
 *
 * @param durationMs - 所要時間(ミリ秒)。
 * @returns `12.3s` 形式の文字列。
 */
function formatSeconds(durationMs: number): string {
  return `${(durationMs / 1000).toFixed(1)}s`;
}

/**
 * 計測値を地図画面に表示する行へ整形する。
 *
 * 1行目に件数、2行目に所要時間の内訳を置く。1行に詰め込むと折り返して読みにくくなるため、
 * 意味のまとまりで2行に分ける。
 *
 * @param metrics - 走査1回ぶんの計測値。
 * @returns 表示する行の配列(件数行・時間行の2行)。
 */
export function formatPhotoScanMetricsLines(metrics: PhotoScanMetrics): string[] {
  return [
    `走査 ${metrics.scannedAssetCount}件 / ジオタグ ${metrics.geotaggedPhotoCount}件 / 失敗 ${metrics.locationRejectedCount}件`,
    `メタデータ ${formatSeconds(metrics.metadataDurationMs)} / 位置 ${formatSeconds(metrics.locationDurationMs)} / ` +
      `保存 ${formatSeconds(metrics.saveDurationMs)} / 合計 ${formatSeconds(metrics.totalDurationMs)}`,
  ];
}

/**
 * 計測フラグが有効なときだけ、地図画面に表示する行を作る。
 *
 * **フラグが無効なときは必ずnullを返す。** 通常のユーザーに計測値を見せないための境界であり、
 * 表示側はこの戻り値がnullなら何も描画しない。
 *
 * @param metrics - 走査1回ぶんの計測値。走査前はnull。
 * @returns 表示する行。フラグ無効時または計測前はnull。
 */
export function createPhotoScanMetricsLines(metrics: PhotoScanMetrics | null): string[] | null {
  if (!developmentFlags.logPhotoScanMetrics || metrics === null) {
    return null;
  }

  return formatPhotoScanMetricsLines(metrics);
}
