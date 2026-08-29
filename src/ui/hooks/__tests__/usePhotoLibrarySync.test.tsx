import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { loadGeotaggedPhotos, type PhotoScanOptions } from '@/features/photos/photoLibrary';
import { usePhotoLibrarySync } from '@/ui/hooks/usePhotoLibrarySync';

jest.mock('@/features/photos/photoLibrary', () => ({
  loadGeotaggedPhotos: jest.fn(),
}));

/** テスト用の走査計測値。 */
const metrics = {
  scannedAssetCount: 3,
  geotaggedPhotoCount: 2,
  locationRejectedCount: 0,
  metadataDurationMs: 1,
  locationDurationMs: 1,
  saveDurationMs: 1,
  totalDurationMs: 3,
};

/** マイクロタスクを流し切って非同期stateの反映を待つ。 */
async function flushPromises(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 5; index += 1) {
      await Promise.resolve();
    }
  });
}

describe('写真ライブラリの全件再読み込みhook usePhotoLibrarySync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (loadGeotaggedPhotos as jest.Mock).mockResolvedValue({ photos: [], isCacheSaved: true, metrics, mode: 'full' });
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('全件モードで走査する', async () => {
    const { result } = renderHook(() => usePhotoLibrarySync());

    await act(async () => {
      await result.current.startPhotoLibrarySync();
    });

    expect((loadGeotaggedPhotos as jest.Mock).mock.calls[0][0]).toMatchObject({ mode: 'full' });
  });

  it('計測用の走査上限を上書きしない(既定の解決に任せる)', async () => {
    const { result } = renderHook(() => usePhotoLibrarySync());

    await act(async () => {
      await result.current.startPhotoLibrarySync();
    });

    // EXPO_PUBLIC_PHOTO_SCAN_LIMIT での計測を続けられるよう、limit は渡さない
    expect((loadGeotaggedPhotos as jest.Mock).mock.calls[0][0]).not.toHaveProperty('limit');
  });

  it('走査中は実行中フラグを立て、完了で下ろす', async () => {
    let resolveScan: () => void = () => undefined;
    (loadGeotaggedPhotos as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveScan = () => resolve({ photos: [], isCacheSaved: true, metrics, mode: 'full' });
      }),
    );

    const { result } = renderHook(() => usePhotoLibrarySync());

    act(() => {
      void result.current.startPhotoLibrarySync();
    });
    await flushPromises();
    expect(result.current.isSyncingPhotoLibrary).toBe(true);

    await act(async () => {
      resolveScan();
    });
    await flushPromises();

    expect(result.current.isSyncingPhotoLibrary).toBe(false);
  });

  it('総数が分かるまで進捗はnullにする', async () => {
    (loadGeotaggedPhotos as jest.Mock).mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => usePhotoLibrarySync());

    act(() => {
      void result.current.startPhotoLibrarySync();
    });
    await flushPromises();

    // exeForMetadata() が終わるまでは件数が分からないので、不定形の表示にさせる
    expect(result.current.photoLibrarySyncProgress).toBeNull();
  });

  it('走査の進捗を「総数と処理済み件数」として公開する', async () => {
    (loadGeotaggedPhotos as jest.Mock).mockImplementation(async ({ onProgress }: PhotoScanOptions) => {
      onProgress?.({ totalAssetCount: 100, processedAssetCount: 0 });
      onProgress?.({ totalAssetCount: 100, processedAssetCount: 100 });

      return new Promise(() => undefined);
    });

    const { result } = renderHook(() => usePhotoLibrarySync());

    act(() => {
      void result.current.startPhotoLibrarySync();
    });
    await flushPromises();

    expect(result.current.photoLibrarySyncProgress).toEqual({ totalAssetCount: 100, processedAssetCount: 100 });
  });

  it('進捗の反映は間引き、最後の1件は必ず反映する', async () => {
    // 走査側の通知を1件ずつ手で送り、状態へ反映される刻みを直接見る。
    // 通知を同期ループで撃つとReactが1回の再レンダーへまとめてしまい、間引きの有無を見分けられない
    let notifyProgress: (progress: { totalAssetCount: number; processedAssetCount: number }) => void = () => undefined;
    (loadGeotaggedPhotos as jest.Mock).mockImplementation(async ({ onProgress }: PhotoScanOptions) => {
      notifyProgress = (progress) => onProgress?.(progress);

      return new Promise(() => undefined);
    });

    // 再レンダー数は**対象hookと同じroot**で数える。別のrenderHookで数えると、進捗stateの更新で
    // 再レンダーされるのは対象hook側だけなので、そもそも数えられない
    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount += 1;

      return usePhotoLibrarySync();
    });

    act(() => {
      void result.current.startPhotoLibrarySync();
    });
    await flushPromises();
    const renderCountBeforeProgress = renderCount;

    // 総数1000件なら1%刻み(10件ごと)。刻みに満たない通知は状態へ反映せず、再レンダーもさせない
    await act(async () => {
      notifyProgress({ totalAssetCount: 1000, processedAssetCount: 0 });
    });
    await act(async () => {
      notifyProgress({ totalAssetCount: 1000, processedAssetCount: 5 });
    });

    // 刻みに届くまでは不定形の表示(null)のまま。再レンダーも起きない
    expect(result.current.photoLibrarySyncProgress).toBeNull();
    expect(renderCount).toBe(renderCountBeforeProgress);

    await act(async () => {
      notifyProgress({ totalAssetCount: 1000, processedAssetCount: 10 });
    });

    expect(result.current.photoLibrarySyncProgress).toEqual({ totalAssetCount: 1000, processedAssetCount: 10 });

    // 最後の1件だけは間引かない。取りこぼすと「あと少し」で止まって見える
    await act(async () => {
      notifyProgress({ totalAssetCount: 1000, processedAssetCount: 1000 });
    });

    expect(result.current.photoLibrarySyncProgress).toEqual({ totalAssetCount: 1000, processedAssetCount: 1000 });
  });

  it('完了したら呼び出し側へ通知する(地図の表示を最新化させるため)', async () => {
    const onCompleted = jest.fn();
    const { result } = renderHook(() => usePhotoLibrarySync({ onCompleted }));

    await act(async () => {
      await result.current.startPhotoLibrarySync();
    });

    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it('完了通知には走査結果を渡す(キャッシュ保存の成否を呼び出し側が判断できるようにする)', async () => {
    const scannedPhotos = [
      { id: 'photo-1', uri: null, storedUri: 'ph://photo-1', latitude: 35, longitude: 139, creationTime: 1, width: 10, height: 10 },
    ];
    (loadGeotaggedPhotos as jest.Mock).mockResolvedValue({ photos: scannedPhotos, isCacheSaved: false, metrics, mode: 'full' });
    const onCompleted = jest.fn();
    const { result } = renderHook(() => usePhotoLibrarySync({ onCompleted }));

    await act(async () => {
      await result.current.startPhotoLibrarySync();
    });

    // 全件走査でもキャッシュ保存は失敗しうる。地図側はこの結果でフォールバック表示を張り替える
    expect(onCompleted).toHaveBeenCalledWith(expect.objectContaining({ isCacheSaved: false, photos: scannedPhotos }));
  });

  it('走査に失敗した場合は通知し、完了コールバックを呼ばない', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (loadGeotaggedPhotos as jest.Mock).mockRejectedValue(new Error('database is locked'));
    const onCompleted = jest.fn();

    const { result } = renderHook(() => usePhotoLibrarySync({ onCompleted }));

    await act(async () => {
      await result.current.startPhotoLibrarySync();
    });

    expect(Alert.alert).toHaveBeenCalled();
    expect(onCompleted).not.toHaveBeenCalled();
    expect(result.current.isSyncingPhotoLibrary).toBe(false);
  });

  it('実行中に再度呼ばれても走査を二重に走らせない', async () => {
    (loadGeotaggedPhotos as jest.Mock).mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => usePhotoLibrarySync());

    act(() => {
      void result.current.startPhotoLibrarySync();
      void result.current.startPhotoLibrarySync();
    });
    await flushPromises();

    expect(loadGeotaggedPhotos).toHaveBeenCalledTimes(1);
  });
});
