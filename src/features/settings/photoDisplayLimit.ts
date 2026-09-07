import {
  DEFAULT_PHOTO_DISPLAY_LIMIT_ID,
  resolvePhotoDisplayLimit,
  toPhotoDisplayLimitId,
  type PhotoDisplayLimitId,
} from '@/features/settings/photoDisplayLimitOptions';
import { getStringSetting, setSetting } from '@/features/settings/settingsRepository';

/**
 * 選択肢と解釈は `photoDisplayLimitOptions.ts` にある。
 *
 * 既存の import 経路を保つためここから再エクスポートする(UIは選択肢モジュールを直接読むこと)。
 */
export {
  DEFAULT_PHOTO_DISPLAY_LIMIT_ID,
  PHOTO_DISPLAY_LIMIT_OPTIONS,
  resolvePhotoDisplayLimit,
  toPhotoDisplayLimitId,
  type PhotoDisplayLimitId,
  type PhotoDisplayLimitOption,
} from '@/features/settings/photoDisplayLimitOptions';

/** 「地図に表示する写真」の設定キー。 */
export const PHOTO_DISPLAY_LIMIT_SETTING_KEY = 'photoDisplayLimit';

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
