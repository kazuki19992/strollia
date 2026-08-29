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
    (loadGeotaggedPhotos as jest.Mock).mockImplementation(async ({ onProgress }: PhotoScanOptions) => {
      for (let processed = 0; processed <= 1000; processed += 1) {
        onProgress?.({ totalAssetCount: 1000, processedAssetCount: processed });
      }

      return new Promise(() => undefined);
    });

    const { result } = renderHook(() => usePhotoLibrarySync());
    let renderCount = 0;
    renderHook(() => {
      renderCount += 1;
    });

    act(() => {
      void result.current.startPhotoLibrarySync();
    });
    await flushPromises();

    // 1件ごとに再レンダーすると走査そのものを遅くする。最終値だけは取りこぼさない
    expect(result.current.photoLibrarySyncProgress).toEqual({ totalAssetCount: 1000, processedAssetCount: 1000 });
    expect(renderCount).toBeLessThan(1000);
  });

  it('完了したら呼び出し側へ通知する(地図の表示を最新化させるため)', async () => {
    const onCompleted = jest.fn();
    const { result } = renderHook(() => usePhotoLibrarySync({ onCompleted }));

    await act(async () => {
      await result.current.startPhotoLibrarySync();
    });

    expect(onCompleted).toHaveBeenCalledTimes(1);
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
