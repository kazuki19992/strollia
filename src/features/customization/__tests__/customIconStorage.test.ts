import * as FileSystem from 'expo-file-system/legacy';

import {
  deleteManagedCustomIcon,
  isLegacyCustomIconReference,
  persistCustomIconImage,
  resolveCustomIconReference,
} from '../customIconStorage';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  makeDirectoryAsync: jest.fn(),
  copyAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

const makeDirectoryAsync = FileSystem.makeDirectoryAsync as jest.Mock;
const copyAsync = FileSystem.copyAsync as jest.Mock;
const getInfoAsync = FileSystem.getInfoAsync as jest.Mock;
const deleteAsync = FileSystem.deleteAsync as jest.Mock;

describe('カスタム画像の永続ファイル管理', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    makeDirectoryAsync.mockResolvedValue(undefined);
    copyAsync.mockResolvedValue(undefined);
    getInfoAsync.mockResolvedValue({ exists: false });
    deleteAsync.mockResolvedValue(undefined);
    Object.defineProperty(FileSystem, 'documentDirectory', {
      configurable: true,
      value: 'file:///documents/',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('従来の絶対URIだけを旧参照として判定する', () => {
    expect(isLegacyCustomIconReference('file:///legacy/photo.jpg')).toBe(true);
    expect(isLegacyCustomIconReference('ph://asset-id')).toBe(true);
    expect(isLegacyCustomIconReference('managed:saved.jpg')).toBe(false);
    expect(isLegacyCustomIconReference('')).toBe(false);
  });

  it('画像を専用領域へコピーし相対的な管理参照と表示URIを返す', async () => {
    await expect(
      persistCustomIconImage('file:///picker/photo.PNG?edited=1', () => 'fixed-id'),
    ).resolves.toEqual({
      reference: 'managed:fixed-id.png',
      uri: 'file:///documents/strollia-custom-icons/fixed-id.png',
    });
    expect(makeDirectoryAsync).toHaveBeenCalledWith(
      'file:///documents/strollia-custom-icons/',
      { intermediates: true },
    );
    expect(copyAsync).toHaveBeenCalledWith({
      from: 'file:///picker/photo.PNG?edited=1',
      to: 'file:///documents/strollia-custom-icons/fixed-id.png',
    });
  });

  it('拡張子を判別できない画像はjpgとして保存する', async () => {
    await expect(persistCustomIconImage('file:///picker/photo', () => 'image-id')).resolves.toEqual({
      reference: 'managed:image-id.jpg',
      uri: 'file:///documents/strollia-custom-icons/image-id.jpg',
    });
  });

  it('クエリやフラグメント内の文字列を画像拡張子として扱わない', async () => {
    await expect(
      persistCustomIconImage('file:///picker/photo.jpeg?format=.png#preview.webp', () => 'image-id'),
    ).resolves.toEqual({
      reference: 'managed:image-id.jpeg',
      uri: 'file:///documents/strollia-custom-icons/image-id.jpeg',
    });
  });

  it('パスに拡張子がなくクエリにだけ拡張子らしい文字列がある場合はjpgにする', async () => {
    await expect(
      persistCustomIconImage('file:///picker/photo?format=.png', () => 'image-id'),
    ).resolves.toEqual({
      reference: 'managed:image-id.jpg',
      uri: 'file:///documents/strollia-custom-icons/image-id.jpg',
    });
  });

  it('保存先が既に存在する場合は既存ファイルに触れずエラーにする', async () => {
    getInfoAsync.mockResolvedValue({ exists: true, isDirectory: false });

    await expect(
      persistCustomIconImage('file:///picker/photo.jpg', () => 'collision'),
    ).rejects.toThrow('同じ保存先のカスタム画像が既に存在します。');
    expect(copyAsync).not.toHaveBeenCalled();
    expect(deleteAsync).not.toHaveBeenCalled();
  });

  it('コピー失敗時は生成された可能性がある部分ファイルを削除して元のエラーを投げる', async () => {
    const copyError = new Error('copy failed');
    copyAsync.mockRejectedValue(copyError);

    await expect(
      persistCustomIconImage('file:///picker/photo.jpg', () => 'partial'),
    ).rejects.toBe(copyError);
    expect(deleteAsync).toHaveBeenCalledWith(
      'file:///documents/strollia-custom-icons/partial.jpg',
      { idempotent: true },
    );
  });

  it('部分ファイルの削除にも失敗した場合は警告してコピー元のエラーを保つ', async () => {
    const copyError = new Error('copy failed');
    const cleanupError = new Error('cleanup failed');
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    copyAsync.mockRejectedValue(copyError);
    deleteAsync.mockRejectedValue(cleanupError);

    await expect(
      persistCustomIconImage('file:///picker/photo.jpg', () => 'partial'),
    ).rejects.toBe(copyError);
    expect(warnSpy).toHaveBeenCalledWith(
      'カスタム画像の部分ファイルを削除できませんでした。',
      cleanupError,
    );

    warnSpy.mockRestore();
  });

  it('管理参照から現在のdocumentDirectoryのURIを復元する', async () => {
    getInfoAsync.mockResolvedValue({ exists: true, isDirectory: false });

    await expect(resolveCustomIconReference('managed:saved.webp')).resolves.toEqual({
      reference: 'managed:saved.webp',
      uri: 'file:///documents/strollia-custom-icons/saved.webp',
      migrated: false,
    });
    expect(getInfoAsync).toHaveBeenCalledWith(
      'file:///documents/strollia-custom-icons/saved.webp',
    );
  });

  it('読み取れる従来の絶対URIを専用領域へ移行する', async () => {
    getInfoAsync
      .mockResolvedValueOnce({ exists: true, isDirectory: false })
      .mockResolvedValueOnce({ exists: false });

    await expect(
      resolveCustomIconReference('file:///legacy/custom.heic', () => 'migrated-id'),
    ).resolves.toEqual({
      reference: 'managed:migrated-id.heic',
      uri: 'file:///documents/strollia-custom-icons/migrated-id.heic',
      migrated: true,
    });
    expect(getInfoAsync).toHaveBeenCalledWith('file:///legacy/custom.heic');
    expect(copyAsync).toHaveBeenCalledWith({
      from: 'file:///legacy/custom.heic',
      to: 'file:///documents/strollia-custom-icons/migrated-id.heic',
    });
  });

  it('読み取れる従来URIの移行コピーに失敗した場合は旧URIを表示用に返す', async () => {
    getInfoAsync
      .mockResolvedValueOnce({ exists: true, isDirectory: false })
      .mockResolvedValueOnce({ exists: false });
    copyAsync.mockRejectedValue(new Error('copy failed'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(resolveCustomIconReference('file:///legacy/custom.jpg', () => 'partial')).resolves.toEqual({
      reference: 'file:///legacy/custom.jpg',
      uri: 'file:///legacy/custom.jpg',
      migrated: false,
      migrationFailed: true,
    });
    expect(warnSpy).toHaveBeenCalledWith('カスタム画像の移行に失敗したため旧URIを使用します。', expect.any(Error));
  });

  it('存在しない従来URIは削除せずnullを返す', async () => {
    getInfoAsync.mockResolvedValue({ exists: false });

    await expect(resolveCustomIconReference('file:///legacy/missing.jpg')).resolves.toBeNull();
    expect(copyAsync).not.toHaveBeenCalled();
    expect(deleteAsync).not.toHaveBeenCalled();
  });

  it('空の参照はファイル操作せずnullを返す', async () => {
    await expect(resolveCustomIconReference('')).resolves.toBeNull();
    expect(getInfoAsync).not.toHaveBeenCalled();
  });

  it('管理参照だけを冪等に削除し従来URIは無視する', async () => {
    await deleteManagedCustomIcon('managed:old.jpg');
    await deleteManagedCustomIcon('file:///legacy/old.jpg');

    expect(deleteAsync).toHaveBeenCalledTimes(1);
    expect(deleteAsync).toHaveBeenCalledWith(
      'file:///documents/strollia-custom-icons/old.jpg',
      { idempotent: true },
    );
  });

  it('走査パスや管理形式に合わない参照はファイル操作せず拒否する', async () => {
    const invalidReferences = [
      'managed:../outside.jpg',
      'managed:file',
      'managed:file.exe',
      'managed:file.',
    ];

    for (const reference of invalidReferences) {
      await expect(resolveCustomIconReference(reference)).resolves.toBeNull();
      await deleteManagedCustomIcon(reference);
    }

    expect(getInfoAsync).not.toHaveBeenCalled();
    expect(deleteAsync).not.toHaveBeenCalled();
  });

  it('documentDirectoryを利用できない場合は明確なエラーにする', async () => {
    Object.defineProperty(FileSystem, 'documentDirectory', {
      configurable: true,
      value: null,
    });

    await expect(persistCustomIconImage('file:///picker/photo.jpg')).rejects.toThrow(
      'カスタム画像の保存先を利用できません。',
    );
  });
});
