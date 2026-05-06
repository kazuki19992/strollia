/** ルート線の表示スタイルID。 */
export type RouteLineStyleId = 'classic' | 'glow' | 'bold';

/** 現在地アイコンの表示スタイルID。 */
export type UserLocationIconId = 'default' | 'walker' | 'compass';

/** ルート線の見た目設定。 */
export type RouteLineStyleOption = {
  /** スタイルID。 */
  id: RouteLineStyleId;
  /** 表示名。 */
  label: string;
  /** Plusスタイルで使う線色。classicはテーマ色を使うためnull。 */
  color: string | null;
  /** 線幅。 */
  width: number;
  /** 発光風の描画を行うか。 */
  glow: boolean;
  /** Strollia Plus限定の場合はtrue。 */
  premium: boolean;
};

/** 現在地アイコンの選択肢。 */
export type UserLocationIconOption = {
  /** アイコンID。 */
  id: UserLocationIconId;
  /** 表示名。 */
  label: string;
  /** Strollia Plus限定の場合はtrue。 */
  premium: boolean;
};

/** 初期状態で使う無料ルート線スタイル。 */
export const DEFAULT_ROUTE_LINE_STYLE_ID: RouteLineStyleId = 'classic';
/** 初期状態で使うOS標準の現在地アイコン。 */
export const DEFAULT_USER_LOCATION_ICON_ID: UserLocationIconId = 'default';

/** 課金で開放予定のルート線スタイル候補。 */
export const ROUTE_LINE_STYLE_OPTIONS: RouteLineStyleOption[] = [
  { id: 'classic', label: 'クラシック', color: null, width: 5, glow: false, premium: false },
  { id: 'glow', label: 'グロー', color: '#73c7a2', width: 6, glow: true, premium: true },
  { id: 'bold', label: 'ボールド', color: '#f2a65a', width: 8, glow: false, premium: true },
];

/** 課金で開放予定の現在地アイコン候補。 */
export const USER_LOCATION_ICON_OPTIONS: UserLocationIconOption[] = [
  { id: 'default', label: 'OS標準', premium: false },
  { id: 'walker', label: 'さんぽ', premium: true },
  { id: 'compass', label: 'コンパス', premium: true },
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
 * ルート線スタイルIDから設定を取得する。
 *
 * @param id - 取得したいルート線スタイルID。
 * @returns 対応するスタイル。見つからない場合はクラシック。
 */
export function getRouteLineStyleOption(id: RouteLineStyleId): RouteLineStyleOption {
  return ROUTE_LINE_STYLE_OPTIONS.find((option) => option.id === id) ?? ROUTE_LINE_STYLE_OPTIONS[0];
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
