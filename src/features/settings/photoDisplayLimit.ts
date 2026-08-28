import { getStringSetting, setSetting } from '@/features/settings/settingsRepository';

/**
 * 地図に表示する写真の上限を表す設定値。
 *
 * **走査対象ではなく表示対象の上限である。** 走査は常にライブラリ全体を見て `photo_assets` を
 * 最新化し、この設定は「そのうち何件を地図に出すか」だけを決める(設計書 §4.1)。
 * `photo_assets` にはジオタグ付き写真しか入らないため、`ORDER BY taken_at DESC LIMIT N` が
 * そのまま「最新N件のジオタグ写真」になる。
 */
export type PhotoDisplayLimitId = 'all' | '200' | '1000' | '3000' | '10000';

/** 地図に表示する写真の選択肢。 */
export type PhotoDisplayLimitOption = {
  /** 選択肢ID。 */
  id: PhotoDisplayLimitId;
  /** 設定画面に出す表示名。 */
  label: string;
};

/** 「地図に表示する写真」の設定キー。 */
export const PHOTO_DISPLAY_LIMIT_SETTING_KEY = 'photoDisplayLimit';

/**
 * 既定の表示上限。
 *
 * 上限なしを既定にできるのは、ビューポート検索側に内部の安全上限
 * (`PHOTO_VIEWPORT_SAFETY_LIMIT`)があるため(設計書 §4.6 / §4.7)。
 */
export const DEFAULT_PHOTO_DISPLAY_LIMIT_ID: PhotoDisplayLimitId = 'all';

/**
 * 地図に表示する写真の選択肢。
 *
 * 基準は**全体の最新N件**であり、表示範囲ごとのN件ではない。ラベルと挙動を一致させるためで、
 * 古い場所へ移動すると何も表示されないという副作用は、設定した本人には理解できる挙動である。
 */
export const PHOTO_DISPLAY_LIMIT_OPTIONS: PhotoDisplayLimitOption[] = [
  { id: 'all', label: 'すべて' },
  { id: '200', label: '最新200件' },
  { id: '1000', label: '最新1000件' },
  { id: '3000', label: '最新3000件' },
  { id: '10000', label: '最新10000件' },
];

/**
 * 設定値をSQLの `LIMIT` に使う件数へ変換する。
 *
 * @param id - 表示上限の設定値。
 * @returns 表示する最大件数。上限なしの場合はnull。
 */
export function resolvePhotoDisplayLimit(id: PhotoDisplayLimitId): number | null {
  return id === 'all' ? null : Number(id);
}

/**
 * 保存値を表示上限IDとして正規化する。
 *
 * 選択肢が増減した後の古い保存値や壊れた値でも表示が止まらないよう、未知の値は既定へ倒す。
 *
 * @param value - 保存されていた文字列。
 * @returns 選択肢に含まれる表示上限ID。含まれない場合は既定。
 */
export function toPhotoDisplayLimitId(value: string): PhotoDisplayLimitId {
  return PHOTO_DISPLAY_LIMIT_OPTIONS.some((option) => option.id === value)
    ? (value as PhotoDisplayLimitId)
    : DEFAULT_PHOTO_DISPLAY_LIMIT_ID;
}

/**
 * 保存済みの表示上限設定を読み込む。
 *
 * @returns 表示上限ID。未保存・不正値の場合は既定(すべて)。
 */
export async function getPhotoDisplayLimitId(): Promise<PhotoDisplayLimitId> {
  return toPhotoDisplayLimitId(await getStringSetting(PHOTO_DISPLAY_LIMIT_SETTING_KEY, DEFAULT_PHOTO_DISPLAY_LIMIT_ID));
}

/**
 * 保存済みの表示上限設定を、SQLの `LIMIT` に使う件数として読み込む。
 *
 * 表示側は件数しか使わないため、ID変換を呼び出しごとに書かなくて済むようにまとめている。
 *
 * @returns 表示する最大件数。上限なしの場合はnull。
 */
export async function getPhotoDisplayLimit(): Promise<number | null> {
  return resolvePhotoDisplayLimit(await getPhotoDisplayLimitId());
}

/**
 * 表示上限設定を保存する。
 *
 * @param id - 保存する表示上限ID。
 * @returns なし。
 */
export async function savePhotoDisplayLimitId(id: PhotoDisplayLimitId): Promise<void> {
  await setSetting(PHOTO_DISPLAY_LIMIT_SETTING_KEY, id);
}
