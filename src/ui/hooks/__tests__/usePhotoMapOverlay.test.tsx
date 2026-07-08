import { act, renderHook } from '@testing-library/react-native';

import { loadGeotaggedPhotos, MapPhoto } from '@/features/photos/photoLibrary';
import { usePhotoMapOverlay } from '@/ui/hooks/usePhotoMapOverlay';

jest.mock('@/features/photos/photoLibrary', () => ({
  loadGeotaggedPhotos: jest.fn(),
}));

describe('写真マップ表示hook usePhotoMapOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('有効な場合はジオタグ付き写真を読み込む', async () => {
    const photo: MapPhoto = {
      id: 'photo-1',
      uri: 'file:///photo-1.jpg',
      latitude: 35,
      longitude: 139,
      creationTime: 1,
      width: 100,
      height: 100,
    };
    (loadGeotaggedPhotos as jest.Mock).mockResolvedValue([photo]);

    const { result } = renderHook(() => usePhotoMapOverlay(true));

    await act(async () => {
      await Promise.resolve();
    });

    expect(loadGeotaggedPhotos).toHaveBeenCalledTimes(1);
    expect(result.current.photos).toEqual([photo]);
  });

  it('無効な場合は写真を読み込まず表示状態を空にする', async () => {
    const { result } = renderHook(() => usePhotoMapOverlay(false));

    await act(async () => {
      await Promise.resolve();
    });

    expect(loadGeotaggedPhotos).not.toHaveBeenCalled();
    expect(result.current.photos).toEqual([]);
  });

  it('読み込み中に無効化された場合は古い読み込み結果を反映しない', async () => {
    const photo: MapPhoto = {
      id: 'photo-1',
      uri: 'file:///photo-1.jpg',
      latitude: 35,
      longitude: 139,
      creationTime: 1,
      width: 100,
      height: 100,
    };
    let resolvePhotos: (photos: MapPhoto[]) => void = () => undefined;
    (loadGeotaggedPhotos as jest.Mock).mockReturnValue(
      new Promise<MapPhoto[]>((resolve) => {
        resolvePhotos = resolve;
      }),
    );

    const { result, rerender } = renderHook(({ enabled }: { enabled: boolean }) => usePhotoMapOverlay(enabled), {
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
});
