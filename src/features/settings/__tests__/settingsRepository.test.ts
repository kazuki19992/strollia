import { db } from '../../../db/database';
import { getStringSetting } from '../settingsRepository';

jest.mock('../../../db/database', () => ({
  db: {
    getFirstAsync: jest.fn(),
    runAsync: jest.fn(),
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
});
