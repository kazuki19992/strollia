/**
 * ウィンドウ寸法から横画面レイアウトを使うべきか判定する純粋関数。
 *
 * 正方形・NaN・0以下の不正な寸法は縦画面扱い(false)にし、既存の縦レイアウトを変えないようにする。
 *
 * @param width - ウィンドウ幅。
 * @param height - ウィンドウ高さ。
 */
export function isLandscapeLayout(width: number, height: number): boolean {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return false;
  }
  return width > height;
}
