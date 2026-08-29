import { act, renderHook } from '@testing-library/react-native';

import { clearPhotoDisplayUriCache, resolvePhotoDisplayUriMap } from '@/features/photos/photoDisplayUri';
import type { MapPhoto } from '@/features/photos/photoLibrary';
import { usePhotoDisplayUris } from '@/ui/hooks/usePhotoDisplayUris';

jest.mock('@/features/photos/photoDisplayUri', () => ({
  clearPhotoDisplayUriCache: jest.fn(),
  resolvePhotoDisplayUriMap: jest.fn(),
}));

/**
 * テスト用の表示用URI未解決の写真を作る。
 *
 * @param id - アセットID。
 * @returns 表示用URI未解決の地図表示用写真。
 */
function createPhoto(id: string): MapPhoto {
  return { id, uri: null, storedUri: `ph://${id}`, latitude: 35, longitude: 139, creationTime: 1, width: 10, height: 10 };
}

/** マイクロタスクを流し切って非同期stateの反映を待つ。 */
async function flushPromises(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 5; index += 1) {
      await Promise.resolve();
    }
  });
}

describe('写真の表示用URI解決hook usePhotoDisplayUris', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (resolvePhotoDisplayUriMap as jest.Mock).mockResolvedValue(new Map([['photo-1', 'file:///tmp/photo-1.jpg']]));
  });

  it('要求された写真の表示用URIを解決して公開する', async () => {
    const { result } = renderHook(() => usePhotoDisplayUris());

    await act(async () => {
      result.current.requestPhotoDisplayUris([createPhoto('photo-1')]);
    });
    await flushPromises();

    expect(result.current.resolvedPhotoUris.get('photo-1')).toBe('file:///tmp/photo-1.jpg');
  });

  it('解決済みの写真は問い合わせ直さない', async () => {
    const { result } = renderHook(() => usePhotoDisplayUris());

    await act(async () => {
      result.current.requestPhotoDisplayUris([createPhoto('photo-1')]);
    });
    await flushPromises();

    await act(async () => {
      result.current.requestPhotoDisplayUris([createPhoto('photo-1')]);
    });
    await flushPromises();

    expect(resolvePhotoDisplayUriMap).toHaveBeenCalledTimes(1);
  });

  it('未解決の写真だけを問い合わせる', async () => {
    const { result } = renderHook(() => usePhotoDisplayUris());

    await act(async () => {
      result.current.requestPhotoDisplayUris([createPhoto('photo-1')]);
    });
    await flushPromises();

    (resolvePhotoDisplayUriMap as jest.Mock).mockResolvedValue(new Map([['photo-2', 'file:///tmp/photo-2.jpg']]));
    await act(async () => {
      result.current.requestPhotoDisplayUris([createPhoto('photo-1'), createPhoto('photo-2')]);
    });
    await flushPromises();

    expect((resolvePhotoDisplayUriMap as jest.Mock).mock.calls[1][0].map((photo: MapPhoto) => photo.id)).toEqual(['photo-2']);
  });

  it('解決できなかった写真は次の機会に再試行する', async () => {
    (resolvePhotoDisplayUriMap as jest.Mock).mockResolvedValue(new Map([['photo-1', null]]));
    const { result } = renderHook(() => usePhotoDisplayUris());

    await act(async () => {
      result.current.requestPhotoDisplayUris([createPhoto('photo-1')]);
    });
    await flushPromises();

    await act(async () => {
      result.current.requestPhotoDisplayUris([createPhoto('photo-1')]);
    });
    await flushPromises();

    // 「iCloudからまだ落ちてきていない」等は一時的な失敗なので、解決失敗はキャッシュしない
    expect(resolvePhotoDisplayUriMap).toHaveBeenCalledTimes(2);
  });

  it('解決に失敗しても例外を投げず、次の要求で再試行できる', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (resolvePhotoDisplayUriMap as jest.Mock).mockRejectedValueOnce(new Error('native module unavailable'));
    const { result } = renderHook(() => usePhotoDisplayUris());

    await act(async () => {
      result.current.requestPhotoDisplayUris([createPhoto('photo-1')]);
    });
    await flushPromises();

    (resolvePhotoDisplayUriMap as jest.Mock).mockResolvedValue(new Map([['photo-1', 'file:///tmp/photo-1.jpg']]));
    await act(async () => {
      result.current.requestPhotoDisplayUris([createPhoto('photo-1')]);
    });
    await flushPromises();

    expect(result.current.resolvedPhotoUris.get('photo-1')).toBe('file:///tmp/photo-1.jpg');
  });

  it('リセットすると解決結果とサムネイルのメモリキャッシュを捨てる', async () => {
    const { result } = renderHook(() => usePhotoDisplayUris());

    await act(async () => {
      result.current.requestPhotoDisplayUris([createPhoto('photo-1')]);
    });
    await flushPromises();

    await act(async () => {
      result.current.resetPhotoDisplayUris();
    });

    // 削除された写真のサムネイルが残り続けないよう、全件再読み込みでは解決結果ごと捨てる
    expect(result.current.resolvedPhotoUris.size).toBe(0);
    expect(clearPhotoDisplayUriCache).toHaveBeenCalled();

    await act(async () => {
      result.current.requestPhotoDisplayUris([createPhoto('photo-1')]);
    });
    await flushPromises();

    expect(resolvePhotoDisplayUriMap).toHaveBeenCalledTimes(2);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
