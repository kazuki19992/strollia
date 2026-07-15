import { db, withExclusiveTransaction } from '@/db/database';
import { getStringSetting, setSettings } from '@/features/settings/settingsRepository';

const mockTxn = {
  runAsync: jest.fn(),
};

jest.mock('@/db/database', () => ({
  db: {
    getFirstAsync: jest.fn(),
    runAsync: jest.fn(),
    withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => callback()),
  },
  withExclusiveTransaction: jest.fn(async (callback: (txn: typeof mockTxn) => Promise<void>) => callback(mockTxn)),
}));

describe('設定リポジトリ settingsRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('文字列設定が保存されている場合はその値を返す', async () => {
    (db.getFirstAsync as jest.Mock).mockResolvedValue({ value: JSON.stringify('custom') });

    await expect(getStringSetting('sampleSetting', 'default')).resolves.toBe('custom');
  });

  it('文字列設定が壊れている場合はfallbackを返す', async () => {
    (db.getFirstAsync as jest.Mock).mockResolvedValue({ value: '{broken' });

    await expect(getStringSetting('sampleSetting', 'default')).resolves.toBe('default');
  });

  it('文字列以外が保存されている場合はfallbackを返す', async () => {
    (db.getFirstAsync as jest.Mock).mockResolvedValue({ value: JSON.stringify(true) });

    await expect(getStringSetting('sampleSetting', 'default')).resolves.toBe('default');
  });

  it('複数の設定を1つのトランザクション内で共通の更新日時を使って保存する', async () => {
    await setSettings([
      { key: 'customIconUri', value: 'file:///icon.png' },
      { key: 'selectedIcon', value: 'custom' },
    ]);

    expect(withExclusiveTransaction).toHaveBeenCalledTimes(1);
    expect(db.withTransactionAsync).not.toHaveBeenCalled();
    expect(db.runAsync).not.toHaveBeenCalled();
    expect(mockTxn.runAsync).toHaveBeenCalledTimes(2);

    const firstCall = mockTxn.runAsync.mock.calls[0];
    const secondCall = mockTxn.runAsync.mock.calls[1];
    expect(firstCall.slice(1, 3)).toEqual(['customIconUri', JSON.stringify('file:///icon.png')]);
    expect(secondCall.slice(1, 3)).toEqual(['selectedIcon', JSON.stringify('custom')]);

    const firstTimestamp = firstCall[3];
    const secondTimestamp = secondCall[3];
    expect(typeof firstTimestamp).toBe('string');
    expect(typeof secondTimestamp).toBe('string');
    expect(new Date(firstTimestamp).toISOString()).toBe(firstTimestamp);
    expect(new Date(secondTimestamp).toISOString()).toBe(secondTimestamp);
    expect(firstCall[3]).toBe(secondCall[3]);
  });

  it('保存対象が空の場合はトランザクションも書き込みも実行しない', async () => {
    await setSettings([]);

    expect(withExclusiveTransaction).not.toHaveBeenCalled();
    expect(db.withTransactionAsync).not.toHaveBeenCalled();
    expect(db.runAsync).not.toHaveBeenCalled();
    expect(mockTxn.runAsync).not.toHaveBeenCalled();
  });
});
