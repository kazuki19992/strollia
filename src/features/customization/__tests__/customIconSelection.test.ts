import { deleteManagedCustomIcon, persistCustomIconImage } from '@/features/customization/customIconStorage';
import { replaceCustomIconSelection } from '@/features/customization/customIconSelection';

jest.mock('@/features/customization/customIconStorage', () => ({
  deleteManagedCustomIcon: jest.fn(),
  persistCustomIconImage: jest.fn(),
}));

const deleteManagedCustomIconMock = deleteManagedCustomIcon as jest.MockedFunction<typeof deleteManagedCustomIcon>;
const persistCustomIconImageMock = persistCustomIconImage as jest.MockedFunction<typeof persistCustomIconImage>;

describe('カスタム現在地アイコンの安全な置き換え', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    persistCustomIconImageMock.mockResolvedValue({
      reference: 'managed:new.jpg',
      uri: 'file:///documents/strollia-custom-icons/new.jpg',
    });
    deleteManagedCustomIconMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('新規ファイルと設定を順に保存してから旧ファイルを削除し保存結果を返す', async () => {
    const persistSelection = jest.fn().mockResolvedValue(undefined);

    await expect(
      replaceCustomIconSelection({
        sourceUri: 'file:///cache/new.jpg',
        previousReference: 'managed:old.jpg',
        persistSelection,
      }),
    ).resolves.toEqual({
      reference: 'managed:new.jpg',
      uri: 'file:///documents/strollia-custom-icons/new.jpg',
    });

    expect(persistCustomIconImage).toHaveBeenCalledWith('file:///cache/new.jpg');
    expect(persistSelection).toHaveBeenCalledWith('managed:new.jpg');
    expect(deleteManagedCustomIcon).toHaveBeenCalledWith('managed:old.jpg');
    expect(persistCustomIconImageMock.mock.invocationCallOrder[0]).toBeLessThan(persistSelection.mock.invocationCallOrder[0]);
    expect(persistSelection.mock.invocationCallOrder[0]).toBeLessThan(deleteManagedCustomIconMock.mock.invocationCallOrder[0]);
  });

  it('設定保存に失敗した場合は新規ファイルだけを削除して元のエラーを返す', async () => {
    const persistenceError = new Error('DB error');
    const persistSelection = jest.fn().mockRejectedValue(persistenceError);

    await expect(
      replaceCustomIconSelection({
        sourceUri: 'file:///cache/new.jpg',
        previousReference: 'managed:old.jpg',
        persistSelection,
      }),
    ).rejects.toBe(persistenceError);

    expect(deleteManagedCustomIcon).toHaveBeenCalledTimes(1);
    expect(deleteManagedCustomIcon).toHaveBeenCalledWith('managed:new.jpg');
    expect(deleteManagedCustomIcon).not.toHaveBeenCalledWith('managed:old.jpg');
  });

  it('設定保存失敗後の新規ファイル削除にも失敗した場合は警告して設定保存エラーを優先する', async () => {
    const persistenceError = new Error('DB error');
    const cleanupError = new Error('cleanup error');
    const persistSelection = jest.fn().mockRejectedValue(persistenceError);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    deleteManagedCustomIconMock.mockRejectedValue(cleanupError);

    await expect(
      replaceCustomIconSelection({
        sourceUri: 'file:///cache/new.jpg',
        previousReference: 'managed:old.jpg',
        persistSelection,
      }),
    ).rejects.toBe(persistenceError);

    expect(warnSpy).toHaveBeenCalledWith('Failed to delete unpersisted custom icon:', cleanupError);
    expect(deleteManagedCustomIcon).toHaveBeenCalledTimes(1);
    expect(deleteManagedCustomIcon).toHaveBeenCalledWith('managed:new.jpg');
  });

  it('保存後の参照が以前と同じ場合は現在のファイルを削除しない', async () => {
    const persistSelection = jest.fn().mockResolvedValue(undefined);
    persistCustomIconImageMock.mockResolvedValue({
      reference: 'managed:same.jpg',
      uri: 'file:///documents/strollia-custom-icons/same.jpg',
    });

    await expect(
      replaceCustomIconSelection({
        sourceUri: 'file:///cache/same.jpg',
        previousReference: 'managed:same.jpg',
        persistSelection,
      }),
    ).resolves.toEqual({
      reference: 'managed:same.jpg',
      uri: 'file:///documents/strollia-custom-icons/same.jpg',
    });

    expect(persistSelection).toHaveBeenCalledWith('managed:same.jpg');
    expect(deleteManagedCustomIcon).not.toHaveBeenCalled();
  });

  it('設定保存失敗時に新旧参照が同じ場合は現在のファイルを削除しない', async () => {
    const persistenceError = new Error('DB error');
    const persistSelection = jest.fn().mockRejectedValue(persistenceError);
    persistCustomIconImageMock.mockResolvedValue({
      reference: 'managed:same.jpg',
      uri: 'file:///documents/strollia-custom-icons/same.jpg',
    });

    await expect(
      replaceCustomIconSelection({
        sourceUri: 'file:///cache/same.jpg',
        previousReference: 'managed:same.jpg',
        persistSelection,
      }),
    ).rejects.toBe(persistenceError);

    expect(deleteManagedCustomIcon).not.toHaveBeenCalled();
  });

  it('設定保存後の旧ファイル削除に失敗しても警告して置き換えを成功させる', async () => {
    const deletionError = new Error('delete error');
    const persistSelection = jest.fn().mockResolvedValue(undefined);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    deleteManagedCustomIconMock.mockRejectedValue(deletionError);

    await expect(
      replaceCustomIconSelection({
        sourceUri: 'file:///cache/new.jpg',
        previousReference: 'managed:old.jpg',
        persistSelection,
      }),
    ).resolves.toEqual({
      reference: 'managed:new.jpg',
      uri: 'file:///documents/strollia-custom-icons/new.jpg',
    });

    expect(warnSpy).toHaveBeenCalledWith('Failed to delete previous custom icon:', deletionError);
  });

  it('新規ファイルの保存に失敗した場合は設定保存もファイル削除も行わない', async () => {
    const storageError = new Error('storage error');
    const persistSelection = jest.fn();
    persistCustomIconImageMock.mockRejectedValue(storageError);

    await expect(
      replaceCustomIconSelection({
        sourceUri: 'file:///cache/new.jpg',
        previousReference: 'managed:old.jpg',
        persistSelection,
      }),
    ).rejects.toBe(storageError);

    expect(persistSelection).not.toHaveBeenCalled();
    expect(deleteManagedCustomIcon).not.toHaveBeenCalled();
  });
});
