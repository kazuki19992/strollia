import * as FileSystem from 'expo-file-system/legacy';

const CUSTOM_ICON_DIRECTORY_NAME = 'strollia-custom-icons/';
const MANAGED_REFERENCE_PREFIX = 'managed:';
const DEFAULT_EXTENSION = 'jpg';
const RECOGNIZED_IMAGE_EXTENSIONS = new Set(['bmp', 'gif', 'heic', 'heif', 'jpeg', 'jpg', 'png', 'webp']);

/** 永続領域で管理するカスタム画像の保存情報。 */
export type StoredCustomIcon = {
  reference: string;
  uri: string;
};

/** 保存済み参照の解決結果。従来URIから移行したかどうかを含む。 */
export type ResolvedCustomIcon = StoredCustomIcon & {
  migrated: boolean;
  migrationFailed?: boolean;
};

type IdFactory = () => string;

/** 選択された画像をアプリ専用の永続領域へコピーする。 */
export async function persistCustomIconImage(sourceUri: string, idFactory: IdFactory = createUniqueId): Promise<StoredCustomIcon> {
  const directoryUri = getCustomIconDirectoryUri();
  const filename = `${sanitizeId(idFactory())}.${getImageExtension(sourceUri)}`;
  const uri = `${directoryUri}${filename}`;

  await FileSystem.makeDirectoryAsync(directoryUri, { intermediates: true });
  const destinationInfo = await FileSystem.getInfoAsync(uri);
  if (destinationInfo.exists) {
    throw new Error('同じ保存先のカスタム画像が既に存在します。');
  }

  try {
    await FileSystem.copyAsync({ from: sourceUri, to: uri });
  } catch (copyError) {
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch (cleanupError) {
      console.warn('カスタム画像の部分ファイルを削除できませんでした。', cleanupError);
    }
    throw copyError;
  }

  return {
    reference: `${MANAGED_REFERENCE_PREFIX}${filename}`,
    uri,
  };
}

/** 保存済み参照を現在の端末上のURIへ解決し、必要なら従来URIを移行する。 */
export async function resolveCustomIconReference(reference: string, idFactory?: IdFactory): Promise<ResolvedCustomIcon | null> {
  if (reference.length === 0) {
    return null;
  }

  const managedFilename = getManagedFilename(reference);
  if (managedFilename !== null) {
    const uri = `${getCustomIconDirectoryUri()}${managedFilename}`;
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && !info.isDirectory ? { reference, uri, migrated: false } : null;
  }

  if (!isAbsoluteUri(reference)) {
    return null;
  }

  const legacyInfo = await FileSystem.getInfoAsync(reference);
  if (!legacyInfo.exists || legacyInfo.isDirectory) {
    return null;
  }

  try {
    const stored = await persistCustomIconImage(reference, idFactory);
    return { ...stored, migrated: true };
  } catch (error: unknown) {
    console.warn('カスタム画像の移行に失敗したため旧URIを使用します。', error);
    return { reference, uri: reference, migrated: false, migrationFailed: true };
  }
}

/** 管理参照が指す画像だけを削除する。従来の絶対URIには触れない。 */
export async function deleteManagedCustomIcon(reference: string): Promise<void> {
  const managedFilename = getManagedFilename(reference);
  if (managedFilename === null) {
    return;
  }

  await FileSystem.deleteAsync(`${getCustomIconDirectoryUri()}${managedFilename}`, {
    idempotent: true,
  });
}

/** documentDirectoryは再インストール等で変わり得るため、利用時に毎回組み立てる。 */
function getCustomIconDirectoryUri(): string {
  if (FileSystem.documentDirectory === null) {
    throw new Error('カスタム画像の保存先を利用できません。');
  }

  return `${FileSystem.documentDirectory}${CUSTOM_ICON_DIRECTORY_NAME}`;
}

/** 管理参照を安全な単一ファイル名として検証する。 */
function getManagedFilename(reference: string): string | null {
  if (!reference.startsWith(MANAGED_REFERENCE_PREFIX)) {
    return null;
  }

  const filename = reference.slice(MANAGED_REFERENCE_PREFIX.length);
  const match = filename.match(/^([A-Za-z0-9][A-Za-z0-9_-]*)\.([A-Za-z0-9]+)$/);
  const extension = match?.[2].toLowerCase();
  if (extension === undefined || !RECOGNIZED_IMAGE_EXTENSIONS.has(extension)) {
    return null;
  }

  return filename;
}

/** ファイルURIから対応画像の拡張子だけを引き継ぐ。 */
function getImageExtension(uri: string): string {
  const path = uri.split(/[?#]/, 1)[0];
  const match = path.match(/\.([A-Za-z0-9]+)$/);
  const extension = match?.[1].toLowerCase();
  return extension !== undefined && RECOGNIZED_IMAGE_EXTENSIONS.has(extension) ? extension : DEFAULT_EXTENSION;
}

/** ID生成元にパス文字が含まれても保存ディレクトリ外へ出ない名前へ変換する。 */
function sanitizeId(id: string): string {
  const sanitized = id.replace(/[^A-Za-z0-9_-]/g, '-').replace(/^-+|-+$/g, '');
  return sanitized.length > 0 ? sanitized : createUniqueId();
}

/** 外部依存なしで衝突しにくいファイルIDを生成する。 */
function createUniqueId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** 旧バージョンが保存した絶対URI形式かどうかを返す。 */
export function isLegacyCustomIconReference(reference: string): boolean {
  return isAbsoluteUri(reference);
}

/** 管理参照でない値のうち、従来形式として扱える絶対URIだけを許可する。 */
function isAbsoluteUri(value: string): boolean {
  return /^[A-Za-z][A-Za-z\d+.-]*:\/\//.test(value);
}
