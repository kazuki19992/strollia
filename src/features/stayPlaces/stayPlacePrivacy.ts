import type { RouteCoordinate } from '@/features/map/routeMapper';
import { isStayPlacePrivacyRadiusMeters, type StayPlace } from '@/features/stayPlaces/stayPlaceTypes';

/** 共有時の非表示半径を設定画面全体で同じ単位へ整形する。 */
export function formatStayPlacePrivacyRadius(privacyRadiusMeters: number | null): string {
  if (privacyRadiusMeters === null) {
    return '共有画像に含める';
  }

  return privacyRadiusMeters >= 1000 ? `${privacyRadiusMeters / 1000}km` : `${privacyRadiusMeters}m`;
}

/**
 * 共有に使う非表示設定が安全に解釈できるか判定する。
 *
 * 不正な半径を黙って無視すると共有画像に本来隠すべき経路が出るため、1件でも壊れて
 * いれば共有を停止する。半径nullの場所は描画を隠さないため座標を要求しない。
 */
export function hasValidStayPlacePrivacyConfiguration(stayPlaces: StayPlace[]): boolean {
  return stayPlaces.every((stayPlace) => {
    if (stayPlace.privacyRadiusMeters === null) {
      return true;
    }

    return isStayPlacePrivacyRadiusMeters(stayPlace.privacyRadiusMeters) && isValidCoordinate(stayPlace);
  });
}

/** 地図・距離判定で使える有限の緯度経度かを判定する。 */
function isValidCoordinate(coordinate: RouteCoordinate): boolean {
  return (
    Number.isFinite(coordinate.latitude) &&
    Number.isFinite(coordinate.longitude) &&
    coordinate.latitude >= -90 &&
    coordinate.latitude <= 90 &&
    coordinate.longitude >= -180 &&
    coordinate.longitude <= 180
  );
}
