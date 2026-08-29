import type { MapPhoto } from '@/features/photos/photoLibrary';
import { isWithinPhotoViewportBounds, PHOTO_VIEWPORT_SAFETY_LIMIT, type PhotoViewportBounds } from '@/features/photos/photoViewportBounds';

/**
 * 走査結果をメモリ上で表示するときの絞り込み(キャッシュ保存に失敗したときのフォールバック)。
 *
 * **`getPhotoAssetsInBounds` と同じ絞り込みをJS側で再現する。** フォールバックだからといって
 * 絞り込みを省くと、ユーザーが「最新200件」を選んでいても走査した全件が地図へ渡り、設定が
 * 効かないうえに広域表示で描画が詰まる。DB経路と同じ二段構え(表示上限 → 範囲 → 安全上限)にする。
 */

/**
 * 走査結果を「全体の最新N件」へ絞る。
 *
 * `getPhotoAssetsInBounds` の表示上限と同じく、**範囲で絞る前に**掛ける。あとに掛けると
 * 「表示範囲ごとの最新N件」になり、設定のラベル(「最新200件」)と挙動が食い違う。
 *
 * 走査は撮影日時の降順で行うため入力は基本的に整列済みだが、フォールバックの並び順が走査側の
 * 実装に依存しないよう、ここで明示的に並べ直す。撮影日時を持たないアセットは走査時点で0へ
 * 倒れており、DBの `ORDER BY taken_at DESC`(NULLは末尾)と同じく末尾へ来る。
 *
 * @param photos - 走査で得られた写真。
 * @param displayLimit - 表示上限。上限なしの場合はnull。
 * @returns 撮影日時の降順に並べ、上限まで絞った写真。
 */
export function selectLatestFallbackPhotos(photos: readonly MapPhoto[], displayLimit: number | null): MapPhoto[] {
  const orderedPhotos = [...photos].sort((left, right) => right.creationTime - left.creationTime);

  return displayLimit === null ? orderedPhotos : orderedPhotos.slice(0, displayLimit);
}

/**
 * 表示上限で絞ったフォールバック写真を、表示範囲でさらに絞り込む。
 *
 * 安全上限(`PHOTO_VIEWPORT_SAFETY_LIMIT`)もDB経路と同じく掛ける。設定が「すべて」のときに
 * 一度にJSへ載る件数を抑えるための保険であり、経路によって効いたり効かなかったりしてはいけない。
 *
 * @param photos - `selectLatestFallbackPhotos` で絞った写真(撮影日時の降順)。
 * @param bounds - 検索対象の緯度経度境界(余白込み)。
 * @returns 範囲内の写真。安全上限まで。
 */
export function filterFallbackPhotosInBounds(photos: readonly MapPhoto[], bounds: PhotoViewportBounds): MapPhoto[] {
  return photos
    .filter((photo) => isWithinPhotoViewportBounds(bounds, photo.latitude, photo.longitude))
    .slice(0, PHOTO_VIEWPORT_SAFETY_LIMIT);
}
