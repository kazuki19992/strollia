import type { Region } from 'react-native-maps';

/**
 * 表示範囲の外側へ持たせる余白比率。
 *
 * 小さなパンのたびにSQLを撃たないための先読み量で、Visited Gridの
 * `GRID_OVERLAY_CONFIG.boundsPaddingRatio` と同じ考え方・同じ値を採る。
 * Grid Overlayの設定を写真側から参照すると設定変更の影響が意図せず波及するため、
 * 値は共有せず写真側で独立して持つ。
 */
export const PHOTO_VIEWPORT_PADDING_RATIO = 0.5;

/** 緯度の絶対上限。極を越えた範囲はSQLの絞り込みで意味を持たないためクランプする。 */
const MAX_LATITUDE = 90;
/** 経度の全周。これ以上広い表示範囲は世界全体として扱う。 */
const FULL_LONGITUDE_SPAN = 360;

/**
 * `photo_assets` のビューポート検索に使う緯度経度の境界。
 *
 * 経度は日付変更線をまたぐ場合に `westLongitude > eastLongitude` となる。この場合
 * `BETWEEN` は空集合を返すため、SQL側では OR 条件へ分岐させる必要がある。
 */
export type PhotoViewportBounds = {
  /** 南端の緯度。 */
  minLatitude: number;
  /** 北端の緯度。 */
  maxLatitude: number;
  /** 西端の経度。-180〜180に正規化済み。 */
  westLongitude: number;
  /** 東端の経度。-180〜180に正規化済み。 */
  eastLongitude: number;
  /** 経度180度線をまたぐかどうか。trueなら `westLongitude > eastLongitude` になる。 */
  crossesAntimeridian: boolean;
};

/** 表示範囲から検索範囲を作るときのオプション。 */
export type PhotoViewportBoundsOptions = {
  /** 表示範囲の半径に対して外側へ追加する比率。 */
  paddingRatio?: number;
};

/**
 * 経度を-180〜180の範囲へ正規化する。
 *
 * @param longitude - 正規化前の経度。180を超える値や-180未満の値を取りうる。
 * @returns -180以上180未満へ折り返した経度。
 */
function normalizeLongitude(longitude: number): number {
  return ((((longitude + 180) % FULL_LONGITUDE_SPAN) + FULL_LONGITUDE_SPAN) % FULL_LONGITUDE_SPAN) - 180;
}

/**
 * 表示範囲を `photo_assets` 検索用の緯度経度境界へ変換する。
 *
 * 日付変更線の判定は `getGridBoundsForRegion`(`src/features/location/grid/gridCell.ts`)と
 * 同じく「余白込みの西端が-180未満、または東端が180超」で行う。ただしGrid側がX番号を
 * 世界全体へ広げるのに対し、写真側は正規化した経度を返し、SQLでOR条件へ分岐させる。
 *
 * @param region - MapViewの表示範囲。
 * @param options - 再取得を抑えるための検索余白。
 * @returns SQLite検索に使う緯度経度境界。
 */
export function getPhotoViewportBounds(region: Region, options: PhotoViewportBoundsOptions = {}): PhotoViewportBounds {
  const paddingRatio = Math.max(0, options.paddingRatio ?? 0);
  const latitudeRadius = (region.latitudeDelta / 2) * (1 + paddingRatio);
  const longitudeRadius = (region.longitudeDelta / 2) * (1 + paddingRatio);
  const minLatitude = Math.max(-MAX_LATITUDE, region.latitude - latitudeRadius);
  const maxLatitude = Math.min(MAX_LATITUDE, region.latitude + latitudeRadius);
  const westLongitude = region.longitude - longitudeRadius;
  const eastLongitude = region.longitude + longitudeRadius;

  // 全周以上を覆う場合は、正規化するとOR条件が「世界の一部を除外する」形に反転してしまう。
  if (eastLongitude - westLongitude >= FULL_LONGITUDE_SPAN) {
    return {
      minLatitude,
      maxLatitude,
      westLongitude: -180,
      eastLongitude: 180,
      crossesAntimeridian: false,
    };
  }

  const crossesAntimeridian = westLongitude < -180 || eastLongitude > 180;

  return {
    minLatitude,
    maxLatitude,
    westLongitude: crossesAntimeridian ? normalizeLongitude(westLongitude) : westLongitude,
    eastLongitude: crossesAntimeridian ? normalizeLongitude(eastLongitude) : eastLongitude,
    crossesAntimeridian,
  };
}

/**
 * 境界の経度を、日付変更線で分割した連続区間の一覧へ変換する。
 *
 * またぐ場合は `[west, 180]` と `[-180, east]` の2区間になる。
 *
 * @param bounds - 変換対象の境界。
 * @returns 西端・東端の組の一覧。
 */
function toLongitudeRanges(bounds: PhotoViewportBounds): [number, number][] {
  if (!bounds.crossesAntimeridian) {
    return [[bounds.westLongitude, bounds.eastLongitude]];
  }

  return [
    [bounds.westLongitude, 180],
    [-180, bounds.eastLongitude],
  ];
}

/**
 * `inner` の範囲が `outer` に完全に含まれるか返す。
 *
 * 余白込みで取得済みの範囲内に表示範囲が収まっている間は再取得を省くために使う
 * (`isGridBoundsContained` と同じ役割)。判定できない組み合わせでは安全側の
 * false(= 再取得する)へ倒す。
 *
 * @param outer - 取得済みの外側範囲。
 * @param inner - 現在表示している内側範囲。
 * @returns 完全に含まれる場合はtrue。
 */
export function isPhotoViewportBoundsContained(outer: PhotoViewportBounds, inner: PhotoViewportBounds): boolean {
  if (outer.minLatitude > inner.minLatitude || outer.maxLatitude < inner.maxLatitude) {
    return false;
  }

  const outerRanges = toLongitudeRanges(outer);

  return toLongitudeRanges(inner).every((innerRange) =>
    outerRanges.some((outerRange) => outerRange[0] <= innerRange[0] && outerRange[1] >= innerRange[1]),
  );
}
