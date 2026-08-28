import { act, renderHook } from '@testing-library/react-native';

import { getPhotoDisplayLimitId, savePhotoDisplayLimitId } from '@/features/settings/photoDisplayLimit';
import { usePhotoDisplayLimitSetting } from '@/ui/hooks/usePhotoDisplayLimitSetting';

// 純粋関数(resolvePhotoDisplayLimit など)は実物を使い、SQLiteへ触れる2つだけ差し替える
jest.mock('@/features/settings/photoDisplayLimit', () => {
  const actual = jest.requireActual<typeof import('@/features/settings/photoDisplayLimit')>('@/features/settings/photoDisplayLimit');

  return { ...actual, getPhotoDisplayLimitId: jest.fn(), savePhotoDisplayLimitId: jest.fn() };
});

jest.mock('@/features/settings/settingsRepository', () => ({
  getStringSetting: jest.fn(),
  setSetting: jest.fn(),
}));

/** マイクロタスクを流し切って非同期stateの反映を待つ。 */
async function flushPromises(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 5; index += 1) {
      await Promise.resolve();
    }
  });
}

describe('地図に表示する写真の上限設定hook usePhotoDisplayLimitSetting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getPhotoDisplayLimitId as jest.Mock).mockResolvedValue('all');
    (savePhotoDisplayLimitId as jest.Mock).mockResolvedValue(undefined);
  });

  it('保存済みの設定を読み込んで件数へ変換する', async () => {
    (getPhotoDisplayLimitId as jest.Mock).mockResolvedValue('1000');

    const { result } = renderHook(() => usePhotoDisplayLimitSetting());
    await flushPromises();

    expect(result.current.photoDisplayLimitId).toBe('1000');
    expect(result.current.photoDisplayLimit).toBe(1000);
  });

  it('上限なしの設定では件数をnullにする', async () => {
    const { result } = renderHook(() => usePhotoDisplayLimitSetting());
    await flushPromises();

    expect(result.current.photoDisplayLimit).toBeNull();
  });

  it('読み込みに失敗しても既定値で表示を続ける', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (getPhotoDisplayLimitId as jest.Mock).mockRejectedValue(new Error('database is locked'));

    const { result } = renderHook(() => usePhotoDisplayLimitSetting());
    await flushPromises();

    expect(result.current.photoDisplayLimitId).toBe('all');
  });

  it('選択を保存して状態へ反映する', async () => {
    const { result } = renderHook(() => usePhotoDisplayLimitSetting());
    await flushPromises();

    await act(async () => {
      await result.current.updatePhotoDisplayLimitId('200');
    });

    expect(savePhotoDisplayLimitId).toHaveBeenCalledWith('200');
    expect(result.current.photoDisplayLimit).toBe(200);
  });

  it('保存に失敗した場合は選択を巻き戻して呼び出し側へ伝える', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (savePhotoDisplayLimitId as jest.Mock).mockRejectedValue(new Error('disk full'));

    const { result } = renderHook(() => usePhotoDisplayLimitSetting());
    await flushPromises();

    await act(async () => {
      await expect(result.current.updatePhotoDisplayLimitId('3000')).rejects.toThrow('disk full');
    });

    expect(result.current.photoDisplayLimitId).toBe('all');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
