import {
  DEFAULT_USER_LOCATION_ICON_ID,
  getUserLocationIconOption,
  UserLocationIconId,
} from './customizationOptions';

/** 現在地アイコン描画方式の判定結果。 */
export type ResolvedUserLocationIcon = {
  /** OS標準の現在地表示を使う場合はtrue。 */
  useNativeUserLocation: boolean;
  /** walker/compassアイコンで描画する場合のID。 */
  customIconId: 'walker' | 'compass' | null;
  /** カスタム画像URIで描画する場合のURI。 */
  customImageUri: string | null;
};

/**
 * 課金状態を考慮して現在地アイコン描画方式を解決する。
 *
 * @param selectedId - ユーザーが選択した現在地アイコンID。
 * @param isPlusActive - Strollia Plusが有効かどうか。
 * @param customImageUri - カスタム画像URI（'custom'選択時のみ使用）。
 * @returns OS標準表示・アイコン表示・カスタム画像表示のいずれかの判定結果。
 */
export function resolveUserLocationIcon(
  selectedId: UserLocationIconId,
  isPlusActive: boolean,
  customImageUri: string | null,
): ResolvedUserLocationIcon {
  const selectedOption = getUserLocationIconOption(selectedId);

  if (selectedOption.id === DEFAULT_USER_LOCATION_ICON_ID || (selectedOption.premium && !isPlusActive)) {
    return { useNativeUserLocation: true, customIconId: null, customImageUri: null };
  }

  if (selectedOption.id === 'custom') {
    if (!customImageUri) {
      return { useNativeUserLocation: true, customIconId: null, customImageUri: null };
    }
    return { useNativeUserLocation: false, customIconId: null, customImageUri };
  }

  if (selectedOption.id === 'walker' || selectedOption.id === 'compass') {
    return { useNativeUserLocation: false, customIconId: selectedOption.id, customImageUri: null };
  }

  return { useNativeUserLocation: true, customIconId: null, customImageUri: null };
}
