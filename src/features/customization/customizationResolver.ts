import {
  DEFAULT_ROUTE_LINE_STYLE_ID,
  DEFAULT_USER_LOCATION_ICON_ID,
  getRouteLineStyleOption,
  getUserLocationIconOption,
  RouteLineStyleId,
  UserLocationIconId,
} from './customizationOptions';

/** Polyline描画に渡す解決済みルート線スタイル。 */
export type ResolvedRouteLineStyle = {
  /** 実際に描画する線色。 */
  color: string;
  /** 実際に描画する線幅。 */
  width: number;
  /** 発光風の下敷き線を描画する場合はtrue。 */
  glow: boolean;
};

/** 現在地アイコン描画方式の判定結果。 */
export type ResolvedUserLocationIcon = {
  /** OS標準の現在地表示を使う場合はtrue。 */
  useNativeUserLocation: boolean;
  /** 独自Markerで描画する場合のアイコンID。 */
  customIconId: Exclude<UserLocationIconId, 'default'> | null;
};

/**
 * 課金状態を考慮してルート線スタイルを解決する。
 *
 * @param selectedId - ユーザーが選択したルート線スタイルID。
 * @param isPlusActive - Strollia Plusが有効かどうか。
 * @param defaultColor - 無料クラシック表示で使う現在テーマの線色。
 * @returns Polylineに反映する解決済みスタイル。
 */
export function resolveRouteLineStyle(
  selectedId: RouteLineStyleId,
  isPlusActive: boolean,
  defaultColor: string,
): ResolvedRouteLineStyle {
  const selectedOption = getRouteLineStyleOption(selectedId);
  const effectiveOption = selectedOption.premium && !isPlusActive ? getRouteLineStyleOption(DEFAULT_ROUTE_LINE_STYLE_ID) : selectedOption;

  return {
    color: effectiveOption.color ?? defaultColor,
    width: effectiveOption.width,
    glow: effectiveOption.glow && isPlusActive,
  };
}

/**
 * 課金状態を考慮して現在地アイコン描画方式を解決する。
 *
 * @param selectedId - ユーザーが選択した現在地アイコンID。
 * @param isPlusActive - Strollia Plusが有効かどうか。
 * @returns OS標準表示または独自Marker表示の判定結果。
 */
export function resolveUserLocationIcon(selectedId: UserLocationIconId, isPlusActive: boolean): ResolvedUserLocationIcon {
  const selectedOption = getUserLocationIconOption(selectedId);

  if (selectedOption.id === DEFAULT_USER_LOCATION_ICON_ID || (selectedOption.premium && !isPlusActive)) {
    return { useNativeUserLocation: true, customIconId: null };
  }


  if (selectedOption.id === 'walker' || selectedOption.id === 'compass') {
    return { useNativeUserLocation: false, customIconId: selectedOption.id };
  }

  return { useNativeUserLocation: true, customIconId: null };
}
