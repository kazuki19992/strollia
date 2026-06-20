import {
  deleteManagedCustomIcon,
  persistCustomIconImage,
} from './customIconStorage';
import type { StoredCustomIcon } from './customIconStorage';

/** カスタム画像を安全に置き換えるための入力。 */
export type ReplaceCustomIconSelectionOptions = {
  sourceUri: string;
  previousReference: string;
  persistSelection: (reference: string) => Promise<void>;
};

/** 新しい画像と選択設定を保存できた場合だけ、以前の管理画像を削除する。 */
export async function replaceCustomIconSelection({
  sourceUri,
  previousReference,
  persistSelection,
}: ReplaceCustomIconSelectionOptions): Promise<StoredCustomIcon> {
  const replacement = await persistCustomIconImage(sourceUri);

  try {
    await persistSelection(replacement.reference);
  } catch (error: unknown) {
    await deleteManagedCustomIcon(replacement.reference).catch(() => undefined);
    throw error;
  }

  await deleteManagedCustomIcon(previousReference).catch((error: unknown) => {
    console.warn('Failed to delete previous custom icon:', error);
  });

  return replacement;
}
