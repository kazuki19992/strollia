import {
  DEFAULT_USER_LOCATION_ICON_ID,
  getUserLocationIconOption,
  UserLocationIconId,
} from './customizationOptions';

/** 現在地アイコン描画方式の判定結果。 */
export type ResolvedUserLocationIcon = {
  /** OS標準の現在地表示を使う場合はtrue。 */
  useNativeUserLocation: boolean;
  /** 独自Markerで描画する場合のアイコンID。 */
  customIconId: Exclude<UserLocationIconId, 'default'> | null;
};

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
