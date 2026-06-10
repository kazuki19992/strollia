/** 現在地アイコンの表示スタイルID。 */
export type UserLocationIconId = 'default' | 'walker' | 'compass' | 'custom';

/** 現在地アイコンの選択肢。 */
export type UserLocationIconOption = {
  /** アイコンID。 */
  id: UserLocationIconId;
  /** 表示名。 */
  label: string;
  /** Strollia Plus限定の場合はtrue。 */
  premium: boolean;
};

/** 初期状態で使うOS標準の現在地アイコン。 */
export const DEFAULT_USER_LOCATION_ICON_ID: UserLocationIconId = 'default';

/** 現在地アイコン候補。 */
export const USER_LOCATION_ICON_OPTIONS: UserLocationIconOption[] = [
  { id: 'default', label: 'OS標準', premium: false },
  { id: 'walker', label: 'さんぽ', premium: true },
  { id: 'compass', label: 'コンパス', premium: true },
  { id: 'custom', label: 'カスタム', premium: true },
];

/**
 * 課金状態に応じて選べる項目だけを返す。
 *
 * @param options - premiumフラグを持つ選択肢一覧。
 * @param isPlusActive - Strollia Plusが有効かどうか。
 * @returns 無料またはPlus有効時に選べる項目一覧。
 */
export function getAvailableCustomizationOptions<T extends { premium: boolean }>(options: T[], isPlusActive: boolean): T[] {
  return options.filter((option) => isPlusActive || !option.premium);
}

/**
 * 現在地アイコンIDから設定を取得する。
 *
 * @param id - 取得したい現在地アイコンID。
 * @returns 対応するアイコン設定。見つからない場合はOS標準。
 */
export function getUserLocationIconOption(id: UserLocationIconId): UserLocationIconOption {
  return USER_LOCATION_ICON_OPTIONS.find((option) => option.id === id) ?? USER_LOCATION_ICON_OPTIONS[0];
}
