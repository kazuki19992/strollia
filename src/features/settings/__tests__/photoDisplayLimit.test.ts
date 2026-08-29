import {
  DEFAULT_PHOTO_DISPLAY_LIMIT_ID,
  getPhotoDisplayLimit,
  getPhotoDisplayLimitId,
  PHOTO_DISPLAY_LIMIT_OPTIONS,
  PHOTO_DISPLAY_LIMIT_SETTING_KEY,
  resolvePhotoDisplayLimit,
  savePhotoDisplayLimitId,
  toPhotoDisplayLimitId,
} from '@/features/settings/photoDisplayLimit';
import { getStringSetting, setSetting } from '@/features/settings/settingsRepository';

jest.mock('@/features/settings/settingsRepository', () => ({
  getStringSetting: jest.fn(),
  setSetting: jest.fn().mockResolvedValue(undefined),
}));

describe('地図に表示する写真の選択肢 PHOTO_DISPLAY_LIMIT_OPTIONS', () => {
  it('すべてを既定とし、新しい順の件数を選べる', () => {
    expect(DEFAULT_PHOTO_DISPLAY_LIMIT_ID).toBe('all');
    expect(PHOTO_DISPLAY_LIMIT_OPTIONS.map((option) => option.id)).toEqual(['all', '200', '1000', '3000', '10000']);
    expect(PHOTO_DISPLAY_LIMIT_OPTIONS.map((option) => option.label)).toEqual([
      'すべて',
      '最新200件',
      '最新1000件',
      '最新3000件',
      '最新10000件',
    ]);
  });
});

describe('表示上限の解決 resolvePhotoDisplayLimit', () => {
  it('件数指定の場合はSQLのLIMITに使う件数を返す', () => {
    expect(resolvePhotoDisplayLimit('200')).toBe(200);
    expect(resolvePhotoDisplayLimit('10000')).toBe(10000);
  });

  it('すべての場合は上限なし(null)を返す', () => {
    expect(resolvePhotoDisplayLimit('all')).toBeNull();
  });
});

describe('表示上限IDの正規化 toPhotoDisplayLimitId', () => {
  it('選択肢に含まれる値はそのまま返す', () => {
    expect(toPhotoDisplayLimitId('1000')).toBe('1000');
  });

  it('選択肢に無い値は既定(すべて)へ倒す', () => {
    expect(toPhotoDisplayLimitId('500')).toBe(DEFAULT_PHOTO_DISPLAY_LIMIT_ID);
    expect(toPhotoDisplayLimitId('')).toBe(DEFAULT_PHOTO_DISPLAY_LIMIT_ID);
  });
});

describe('表示上限設定の読み書き', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('保存済みの選択肢を読み込む', async () => {
    (getStringSetting as jest.Mock).mockResolvedValue('3000');

    await expect(getPhotoDisplayLimitId()).resolves.toBe('3000');
    expect(getStringSetting).toHaveBeenCalledWith(PHOTO_DISPLAY_LIMIT_SETTING_KEY, DEFAULT_PHOTO_DISPLAY_LIMIT_ID);
  });

  it('未知の値が保存されていた場合は既定(すべて)として扱う', async () => {
    (getStringSetting as jest.Mock).mockResolvedValue('9999');

    await expect(getPhotoDisplayLimitId()).resolves.toBe(DEFAULT_PHOTO_DISPLAY_LIMIT_ID);
  });

  it('件数として読み込む場合はSQLのLIMIT値へ変換して返す', async () => {
    (getStringSetting as jest.Mock).mockResolvedValue('200');

    await expect(getPhotoDisplayLimit()).resolves.toBe(200);
  });

  it('選択肢を保存する', async () => {
    await savePhotoDisplayLimitId('1000');

    expect(setSetting).toHaveBeenCalledWith(PHOTO_DISPLAY_LIMIT_SETTING_KEY, '1000');
  });
});
