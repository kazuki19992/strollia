import { act, renderHook } from '@testing-library/react-native';

import type { MapPhoto } from '@/features/photos/photoLibrary';
import { resolvePhotoPreviewUri } from '@/features/photos/photoPreviewUri';
import { usePhotoPreviewUri } from '@/ui/hooks/usePhotoPreviewUri';

jest.mock('@/features/photos/photoPreviewUri', () => ({
  resolvePhotoPreviewUri: jest.fn(),
}));

/**
 * テスト用の地図写真を作る。
 *
 * @param id - アセットID。
 * @param uri - マーカー用に解決済みのサムネイルURI。
 * @returns 地図表示用写真。
 */
function createPhoto(id: string, uri: string | null): MapPhoto {
  return { id, uri, storedUri: `ph://${id}`, latitude: 35, longitude: 139, creationTime: 0, width: 100, height: 80 };
}

/** マイクロタスクを流し切って非同期stateの反映を待つ。 */
const flushPromises = async () => {
  await act(async () => {
    for (let index = 0; index < 5; index += 1) {
      await Promise.resolve();
    }
  });
};

describe('拡大表示用URLフック usePhotoPreviewUri', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('写真を開いた直後は手元のサムネイルを返し、取得中であることを伝える', () => {
    (resolvePhotoPreviewUri as jest.Mock).mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => usePhotoPreviewUri(createPhoto('asset-1', 'file:///caches/asset-1-512.jpg')));

    expect(result.current.previewUri).toBe('file:///caches/asset-1-512.jpg');
    expect(result.current.isLoadingPreview).toBe(true);
  });

  it('高解像度を取得できたら表示を差し替える', async () => {
    (resolvePhotoPreviewUri as jest.Mock).mockResolvedValue('file:///caches/asset-1-preview.jpg');

    const { result } = renderHook(() => usePhotoPreviewUri(createPhoto('asset-1', 'file:///caches/asset-1-512.jpg')));
    await flushPromises();

    expect(result.current.previewUri).toBe('file:///caches/asset-1-preview.jpg');
    expect(result.current.isLoadingPreview).toBe(false);
  });

  it('高解像度を取得できなくてもサムネイルのまま表示を続ける(真っ黒にしない)', async () => {
    (resolvePhotoPreviewUri as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => usePhotoPreviewUri(createPhoto('asset-1', 'file:///caches/asset-1-512.jpg')));
    await flushPromises();

    expect(result.current.previewUri).toBe('file:///caches/asset-1-512.jpg');
    expect(result.current.isLoadingPreview).toBe(false);
  });

  it('取得が失敗しても例外にせずサムネイルのまま表示を続ける', async () => {
    // 失敗時の console.warn はテスト出力を汚すだけなので握りつぶす
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (resolvePhotoPreviewUri as jest.Mock).mockRejectedValue(new Error('download failed'));

    const { result } = renderHook(() => usePhotoPreviewUri(createPhoto('asset-1', 'file:///caches/asset-1-512.jpg')));
    await flushPromises();

    expect(result.current.previewUri).toBe('file:///caches/asset-1-512.jpg');
    expect(result.current.isLoadingPreview).toBe(false);
  });

  it('写真を閉じている間は取得せず、URIも持たない', () => {
    const { result } = renderHook(() => usePhotoPreviewUri(null));

    expect(result.current.previewUri).toBeNull();
    expect(result.current.isLoadingPreview).toBe(false);
    expect(resolvePhotoPreviewUri).not.toHaveBeenCalled();
  });

  it('別の写真へ切り替えたあとに前の写真の結果が届いても反映しない', async () => {
    (resolvePhotoPreviewUri as jest.Mock).mockImplementation((assetId: string) =>
      assetId === 'asset-1'
        ? new Promise((resolve) => setTimeout(() => resolve('file:///caches/asset-1-preview.jpg'), 10))
        : Promise.resolve(null),
    );
    jest.useFakeTimers();

    const { result, rerender } = renderHook(({ photo }: { photo: MapPhoto }) => usePhotoPreviewUri(photo), {
      initialProps: { photo: createPhoto('asset-1', 'file:///caches/asset-1-512.jpg') },
    });

    act(() => {
      rerender({ photo: createPhoto('asset-2', 'file:///caches/asset-2-512.jpg') });
    });
    await act(async () => {
      jest.runAllTimers();
    });

    expect(result.current.previewUri).toBe('file:///caches/asset-2-512.jpg');
    jest.useRealTimers();
  });

  it('サムネイルすら無い写真でも高解像度を取得できれば表示する', async () => {
    (resolvePhotoPreviewUri as jest.Mock).mockResolvedValue('file:///caches/asset-1-preview.jpg');

    const { result } = renderHook(() => usePhotoPreviewUri(createPhoto('asset-1', null)));
    await flushPromises();

    expect(result.current.previewUri).toBe('file:///caches/asset-1-preview.jpg');
  });

  it('写真を切り替えた直後のレンダーで、前の写真の高解像度URIを返さない', async () => {
    // 本番では useEffect がコミット後に走るため、切替直後のレンダー結果がそのまま描画されうる。
    // 高解像度URIを assetId と切り離して保持すると、その1フレームだけ前の写真が出てしまう。
    // rerender は act() で effect まで流し切ってしまうので、レンダー本体で値を記録して中間状態を見る
    const renderedUris: (string | null)[] = [];

    (resolvePhotoPreviewUri as jest.Mock).mockResolvedValue('file:///caches/asset-1-preview.jpg');

    const { rerender } = renderHook(
      ({ photo }: { photo: MapPhoto }) => {
        const state = usePhotoPreviewUri(photo);
        renderedUris.push(state.previewUri);
        return state;
      },
      { initialProps: { photo: createPhoto('asset-1', 'file:///caches/asset-1-512.jpg') } },
    );
    await flushPromises();

    (resolvePhotoPreviewUri as jest.Mock).mockReturnValue(new Promise(() => undefined));
    const switchedAtIndex = renderedUris.length;
    rerender({ photo: createPhoto('asset-2', 'file:///caches/asset-2-512.jpg') });

    // 切替後のどのレンダーでも、写真1の高解像度URIが出てはいけない
    expect(renderedUris.slice(switchedAtIndex)).not.toContain('file:///caches/asset-1-preview.jpg');
  });
});
