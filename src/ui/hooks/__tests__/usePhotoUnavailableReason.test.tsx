import { isPhotoAssetAvailableAsync } from '@modules/photo-thumbnail';
import { act, renderHook } from '@testing-library/react-native';

import type { MapPhoto } from '@/features/photos/photoLibrary';
import { usePhotoUnavailableReason } from '@/ui/hooks/usePhotoUnavailableReason';

jest.mock('@modules/photo-thumbnail', () => ({
  isPhotoAssetAvailableAsync: jest.fn(),
}));

/**
 * テスト用の写真を作る。
 *
 * @param id - アセットID。
 * @param uri - サムネイルURI。サムネイルが出ている状況を再現する場合に渡す。
 * @returns 地図表示用写真。
 */
function createPhoto(id: string, uri: string | null = null): MapPhoto {
  return { id, uri, storedUri: `ph://${id}`, latitude: 35, longitude: 139, creationTime: 1, width: 10, height: 10 };
}

/** マイクロタスクを流し切って非同期stateの反映を待つ。 */
async function flushPromises(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 5; index += 1) {
      await Promise.resolve();
    }
  });
}

/** 既定の引数に差分を当ててフックを描画する。 */
function renderReason(overrides: Partial<Parameters<typeof usePhotoUnavailableReason>[0]> = {}) {
  const props = { photo: createPhoto('photo-1'), hasHighResolutionPreview: false, isLoadingPreview: false, ...overrides };

  return renderHook((currentProps: typeof props) => usePhotoUnavailableReason(currentProps), { initialProps: props });
}

describe('写真を表示できない理由hook usePhotoUnavailableReason', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isPhotoAssetAvailableAsync as jest.Mock).mockResolvedValue(true);
  });

  it('高解像度を取得できていれば案内を出さない', async () => {
    const { result } = renderReason({ hasHighResolutionPreview: true });
    await flushPromises();

    expect(result.current.photoUnavailableReason).toBeNull();
    expect(isPhotoAssetAvailableAsync).not.toHaveBeenCalled();
  });

  it('取得中は判定しない(結果を待つ)', async () => {
    const { result } = renderReason({ isLoadingPreview: true });
    await flushPromises();

    expect(result.current.photoUnavailableReason).toBeNull();
    expect(isPhotoAssetAvailableAsync).not.toHaveBeenCalled();
  });

  it('拡大表示を開いていなければ判定しない', async () => {
    const { result } = renderReason({ photo: null });
    await flushPromises();

    expect(result.current.photoUnavailableReason).toBeNull();
    expect(isPhotoAssetAvailableAsync).not.toHaveBeenCalled();
  });

  it('サムネイルが表示されていても高解像度を取得できなければ存在確認を行う', async () => {
    // 拡大表示はサムネイルへフォールバックするため、「何かが映っている」ことを条件にすると
    // 端末未ダウンロードの写真で案内が一切出なくなる(実機で確認した不具合の回帰テスト)
    const { result } = renderReason({ photo: createPhoto('photo-1', 'file:///caches/photo-1-512.jpg') });
    await flushPromises();

    expect(isPhotoAssetAvailableAsync).toHaveBeenCalledWith('ph://photo-1');
    expect(result.current.photoUnavailableReason).toBe('unavailable');
  });

  it('アセットが存在しない場合は削除済みとして扱う', async () => {
    (isPhotoAssetAvailableAsync as jest.Mock).mockResolvedValue(false);

    const { result } = renderReason();
    await flushPromises();

    expect(result.current.photoUnavailableReason).toBe('deleted');
  });

  it('存在確認には保存済みの安定URIを使う', async () => {
    renderReason();
    await flushPromises();

    // 旧い行では assetId が localIdentifier のみで ph:// を持たないため、storedUri の方を渡す
    expect(isPhotoAssetAvailableAsync).toHaveBeenCalledWith('ph://photo-1');
  });

  it('アセットが存在するのに取得できない場合は取得不可として扱う', async () => {
    const { result } = renderReason();
    await flushPromises();

    // オフラインでiCloudから落ちてこないだけの場合に「削除された」と案内すると誤情報になる
    expect(result.current.photoUnavailableReason).toBe('unavailable');
  });

  it('存在確認に失敗した場合は削除と断定しない', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (isPhotoAssetAvailableAsync as jest.Mock).mockRejectedValue(new Error('native module unavailable'));

    const { result } = renderReason();
    await flushPromises();

    expect(result.current.photoUnavailableReason).toBe('unavailable');
  });

  it('同じ写真について存在確認を繰り返さない', async () => {
    const { rerender } = renderReason();
    await flushPromises();

    await act(async () => {
      rerender({ photo: createPhoto('photo-1'), hasHighResolutionPreview: false, isLoadingPreview: false });
    });
    await flushPromises();

    expect(isPhotoAssetAvailableAsync).toHaveBeenCalledTimes(1);
  });

  it('閉じたあとは同じ写真で再表示しない', async () => {
    const { result } = renderReason();
    await flushPromises();
    expect(result.current.photoUnavailableReason).toBe('unavailable');

    await act(async () => {
      result.current.dismissPhotoDeletedDialog();
    });
    await flushPromises();

    expect(result.current.photoUnavailableReason).toBeNull();
  });

  it('別の写真を開いたら改めて判定する', async () => {
    const { result, rerender } = renderReason();
    await flushPromises();

    await act(async () => {
      result.current.dismissPhotoDeletedDialog();
    });
    (isPhotoAssetAvailableAsync as jest.Mock).mockResolvedValue(false);

    await act(async () => {
      rerender({ photo: createPhoto('photo-2'), hasHighResolutionPreview: false, isLoadingPreview: false });
    });
    await flushPromises();

    expect(result.current.photoUnavailableReason).toBe('deleted');
  });

  it('拡大表示を閉じたら案内も消す', async () => {
    const { result, rerender } = renderReason();
    await flushPromises();

    await act(async () => {
      rerender({ photo: null, hasHighResolutionPreview: false, isLoadingPreview: false });
    });
    await flushPromises();

    expect(result.current.photoUnavailableReason).toBeNull();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
