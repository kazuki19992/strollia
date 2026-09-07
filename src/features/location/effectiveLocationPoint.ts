/** 有効座標のフォールバックに必要な最小のポイント形状。 */
type EffectiveCoordinatePoint = {
  latitude: number;
  longitude: number;
  effectiveLatitude?: number | null;
  effectiveLongitude?: number | null;
};

/**
 * 保存済みポイントを、記録時に決定した有効座標で読むための共通変換。
 *
 * 旧データや片方だけ・範囲外の有効座標は、位置情報を捏造せず生座標のまま返す。
 */
export function toEffectiveLocationPoint<T extends EffectiveCoordinatePoint>(point: T): T {
  const { effectiveLatitude, effectiveLongitude } = point;

  if (!isValidLatitude(effectiveLatitude) || !isValidLongitude(effectiveLongitude)) {
    return point;
  }

  return { ...point, latitude: effectiveLatitude, longitude: effectiveLongitude };
}

/** 有効緯度として保存値を使えるか判定する。 */
function isValidLatitude(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90;
}

/** 有効経度として保存値を使えるか判定する。 */
function isValidLongitude(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180;
}
