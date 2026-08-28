import {
  getPhotoScanBaselineMs,
  PHOTO_SCAN_BASELINE_SETTING_KEY,
  resolveNextPhotoScanBaselineMs,
  savePhotoScanBaselineMs,
} from '@/features/photos/photoScanState';
import { getStringSetting, setSetting } from '@/features/settings/settingsRepository';

jest.mock('@/features/settings/settingsRepository', () => ({
  getStringSetting: jest.fn(),
  setSetting: jest.fn().mockResolvedValue(undefined),
}));

describe('差分走査の基準時刻の算出 resolveNextPhotoScanBaselineMs', () => {
  it('走査したアセットの最新の撮影日時を次回の基準時刻にする', () => {
    expect(resolveNextPhotoScanBaselineMs([{ creationTime: 1000 }, { creationTime: 3000 }, { creationTime: 2000 }], null)).toBe(3000);
  });

  it('前回の基準時刻より古い結果でも基準時刻を巻き戻さない', () => {
    // 巻き戻すと、すでに走査済みの範囲を毎回走り直すことになる
    expect(resolveNextPhotoScanBaselineMs([{ creationTime: 1000 }], 5000)).toBe(5000);
  });

  it('走査結果が空の場合は前回の基準時刻を保つ', () => {
    expect(resolveNextPhotoScanBaselineMs([], 5000)).toBe(5000);
  });

  it('走査結果が空で前回の基準時刻も無い場合はnullを返す', () => {
    expect(resolveNextPhotoScanBaselineMs([], null)).toBeNull();
  });

  it('撮影日時が不明なアセットは基準時刻の算出に使わない', () => {
    // 撮影日時を持たないアセットは iOS に実在する。時刻として信用できないため除外する
    expect(resolveNextPhotoScanBaselineMs([{ creationTime: null }, { creationTime: undefined }, { creationTime: 2000 }], null)).toBe(2000);
  });

  it('0以下や非有限の撮影日時は基準時刻の算出に使わない', () => {
    expect(resolveNextPhotoScanBaselineMs([{ creationTime: 0 }, { creationTime: -1 }, { creationTime: Number.NaN }], null)).toBeNull();
  });
});

describe('差分走査の基準時刻の読み込み getPhotoScanBaselineMs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('保存済みのISO 8601文字列をUnixミリ秒として返す', async () => {
    (getStringSetting as jest.Mock).mockResolvedValue('2026-08-29T00:00:00.000Z');

    await expect(getPhotoScanBaselineMs()).resolves.toBe(Date.parse('2026-08-29T00:00:00.000Z'));
    expect(getStringSetting).toHaveBeenCalledWith(PHOTO_SCAN_BASELINE_SETTING_KEY, '');
  });

  it('未保存(初回)の場合はnullを返す', async () => {
    (getStringSetting as jest.Mock).mockResolvedValue('');

    // 呼び出し側は基準時刻が無い場合に全件走査へフォールバックする
    await expect(getPhotoScanBaselineMs()).resolves.toBeNull();
  });

  it('日時として解釈できない値が保存されていた場合はnullを返す', async () => {
    (getStringSetting as jest.Mock).mockResolvedValue('broken');

    await expect(getPhotoScanBaselineMs()).resolves.toBeNull();
  });

  it('読み込みに失敗した場合は全件走査へ倒せるようnullを返す', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (getStringSetting as jest.Mock).mockRejectedValue(new Error('database is locked'));

    await expect(getPhotoScanBaselineMs()).resolves.toBeNull();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});

describe('差分走査の基準時刻の保存 savePhotoScanBaselineMs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Unixミリ秒をISO 8601文字列として保存する', async () => {
    await savePhotoScanBaselineMs(Date.parse('2026-08-29T00:00:00.000Z'));

    expect(setSetting).toHaveBeenCalledWith(PHOTO_SCAN_BASELINE_SETTING_KEY, '2026-08-29T00:00:00.000Z');
  });

  it('0以下や非有限の値は時刻として信用できないため保存しない', async () => {
    await savePhotoScanBaselineMs(0);
    await savePhotoScanBaselineMs(Number.NaN);

    expect(setSetting).not.toHaveBeenCalled();
  });
});
