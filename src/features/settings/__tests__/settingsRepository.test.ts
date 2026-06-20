import { db } from '../../../db/database';
import { getStringSetting, setSettings } from '../settingsRepository';

jest.mock('../../../db/database', () => ({
  db: {
    getFirstAsync: jest.fn(),
    runAsync: jest.fn(),
    withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => callback()),
  },
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
    let isInTransaction = false;
    const transactionStates: boolean[] = [];
    (db.withTransactionAsync as jest.Mock).mockImplementation(async (callback: () => Promise<void>) => {
      isInTransaction = true;
      try {
        await callback();
      } finally {
        isInTransaction = false;
      }
    });
    (db.runAsync as jest.Mock).mockImplementation(async () => {
      transactionStates.push(isInTransaction);
    });

    await setSettings([
      { key: 'customIconUri', value: 'file:///icon.png' },
      { key: 'selectedIcon', value: 'custom' },
    ]);

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(db.runAsync).toHaveBeenCalledTimes(2);
    expect(transactionStates).toEqual([true, true]);

    const firstCall = (db.runAsync as jest.Mock).mock.calls[0];
    const secondCall = (db.runAsync as jest.Mock).mock.calls[1];
    expect(firstCall.slice(1, 3)).toEqual(['customIconUri', JSON.stringify('file:///icon.png')]);
    expect(secondCall.slice(1, 3)).toEqual(['selectedIcon', JSON.stringify('custom')]);
    expect(firstCall[3]).toBe(secondCall[3]);
  });
});
