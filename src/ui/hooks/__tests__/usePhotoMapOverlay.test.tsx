import { act, renderHook } from '@testing-library/react-native';
import type { Region } from 'react-native-maps';

import { loadGeotaggedPhotos, loadGeotaggedPhotosInBounds, MapPhoto } from '@/features/photos/photoLibrary';
import { usePhotoMapOverlay } from '@/ui/hooks/usePhotoMapOverlay';

jest.mock('@/features/photos/photoLibrary', () => ({
  loadGeotaggedPhotos: jest.fn(),
  loadGeotaggedPhotosInBounds: jest.fn(),
}));

/** テスト用の表示範囲。 */
const baseRegion: Region = { latitude: 35, longitude: 139, latitudeDelta: 0.1, longitudeDelta: 0.1 };

/** テスト用のジオタグ付き写真。 */
const photo: MapPhoto = {
  id: 'photo-1',
  uri: 'ph://photo-1',
  latitude: 35,
  longitude: 139,
  creationTime: 1,
  width: 100,
  height: 100,
};

/** マイクロタスクを流し切って非同期stateの反映を待つ。 */
async function flushPromises(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 5; index += 1) {
      await Promise.resolve();
    }
  });
}

describe('写真マップ表示hook usePhotoMapOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (loadGeotaggedPhotos as jest.Mock).mockResolvedValue([]);
    (loadGeotaggedPhotosInBounds as jest.Mock).mockResolvedValue([]);
  });

  it('有効な場合は表示範囲に含まれる保存済み写真を読み込む', async () => {
    (loadGeotaggedPhotosInBounds as jest.Mock).mockResolvedValue([photo]);

    const { result } = renderHook(() => usePhotoMapOverlay(true, baseRegion));
    await flushPromises();

    expect(result.current.photos).toEqual([photo]);
    expect(result.current.isLoadingPhotos).toBe(false);
  });

  it('検索範囲は表示範囲の外側へ余白を持たせる', async () => {
    renderHook(() => usePhotoMapOverlay(true, baseRegion));
    await flushPromises();

    const bounds = (loadGeotaggedPhotosInBounds as jest.Mock).mock.calls[0][0];
    // latitudeDelta 0.1 の半分 0.05 に余白比率0.5を足した 0.075 が半径になる
    expect(bounds.minLatitude).toBeCloseTo(34.925, 10);
    expect(bounds.maxLatitude).toBeCloseTo(35.075, 10);
  });

  it('写真ライブラリを走査してphoto_assetsへ反映してから検索する', async () => {
    const callOrder: string[] = [];
    (loadGeotaggedPhotos as jest.Mock).mockImplementation(async () => {
      callOrder.push('scan');
      return [];
    });
    (loadGeotaggedPhotosInBounds as jest.Mock).mockImplementation(async () => {
      callOrder.push('search');
      return [];
    });

    renderHook(() => usePhotoMapOverlay(true, baseRegion));
    await flushPromises();

    expect(callOrder).toEqual(['scan', 'search']);
  });

  it('無効な場合は走査も検索もせず表示状態を空にする', async () => {
    const { result } = renderHook(() => usePhotoMapOverlay(false, baseRegion));
    await flushPromises();

    expect(loadGeotaggedPhotos).not.toHaveBeenCalled();
    expect(loadGeotaggedPhotosInBounds).not.toHaveBeenCalled();
    expect(result.current.photos).toEqual([]);
  });

  it('余白の内側に収まる小さなパンでは再検索しない', async () => {
    const { rerender } = renderHook(({ region }: { region: Region }) => usePhotoMapOverlay(true, region), {
      initialProps: { region: baseRegion },
    });
    await flushPromises();

    expect(loadGeotaggedPhotosInBounds).toHaveBeenCalledTimes(1);

    await act(async () => {
      rerender({ region: { ...baseRegion, longitude: 139.01 } });
    });
    await flushPromises();

    expect(loadGeotaggedPhotosInBounds).toHaveBeenCalledTimes(1);
  });

  it('余白の外へ出た場合は再検索する', async () => {
    const { rerender } = renderHook(({ region }: { region: Region }) => usePhotoMapOverlay(true, region), {
      initialProps: { region: baseRegion },
    });
    await flushPromises();

    await act(async () => {
      rerender({ region: { ...baseRegion, longitude: 139.5 } });
    });
    await flushPromises();

    expect(loadGeotaggedPhotosInBounds).toHaveBeenCalledTimes(2);
    // 表示範囲が変わっても写真ライブラリの再走査(重いデコード)は繰り返さない
    expect(loadGeotaggedPhotos).toHaveBeenCalledTimes(1);
  });

  it('読み込み中に無効化された場合は古い読み込み結果を反映しない', async () => {
    let resolvePhotos: (photos: MapPhoto[]) => void = () => undefined;
    (loadGeotaggedPhotosInBounds as jest.Mock).mockReturnValue(
      new Promise<MapPhoto[]>((resolve) => {
        resolvePhotos = resolve;
      }),
    );

    const { result, rerender } = renderHook(({ enabled }: { enabled: boolean }) => usePhotoMapOverlay(enabled, baseRegion), {
      initialProps: { enabled: true },
    });

    await act(async () => {
      rerender({ enabled: false });
    });

    await act(async () => {
      resolvePhotos([photo]);
    });

    expect(result.current.photos).toEqual([]);
    expect(result.current.isLoadingPhotos).toBe(false);
  });

  it('検索に失敗した場合はエラーメッセージを表示して写真を空にする', async () => {
    (loadGeotaggedPhotosInBounds as jest.Mock).mockRejectedValue(new Error('database is locked'));

    const { result } = renderHook(() => usePhotoMapOverlay(true, baseRegion));
    await flushPromises();

    expect(result.current.photos).toEqual([]);
    expect(result.current.photoErrorMessage).toBe('database is locked');
    expect(result.current.isLoadingPhotos).toBe(false);
  });

  it('reloadPhotosは写真ライブラリの走査からやり直す', async () => {
    const { result } = renderHook(() => usePhotoMapOverlay(true, baseRegion));
    await flushPromises();

    await act(async () => {
      await result.current.reloadPhotos();
    });

    expect(loadGeotaggedPhotos).toHaveBeenCalledTimes(2);
    expect(loadGeotaggedPhotosInBounds).toHaveBeenCalledTimes(2);
  });

  it('無効化してから再度有効にすると写真ライブラリを走査し直す', async () => {
    const { rerender } = renderHook(({ enabled }: { enabled: boolean }) => usePhotoMapOverlay(enabled, baseRegion), {
      initialProps: { enabled: true },
    });
    await flushPromises();

    await act(async () => {
      rerender({ enabled: false });
    });
    await flushPromises();

    await act(async () => {
      rerender({ enabled: true });
    });
    await flushPromises();

    expect(loadGeotaggedPhotos).toHaveBeenCalledTimes(2);
  });
});
