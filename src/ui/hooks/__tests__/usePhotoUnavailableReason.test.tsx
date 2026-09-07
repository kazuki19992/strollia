import { isPhotoAssetAvailableAsync } from '@modules/photo-thumbnail';
import { act, renderHook } from '@testing-library/react-native';

import type { MapPhoto } from '@/features/photos/photoLibrary';
import { usePhotoUnavailableReason } from '@/ui/hooks/usePhotoUnavailableReason';

jest.mock('@modules/photo-thumbnail', () => ({
  isPhotoAssetAvailableAsync: jest.fn(),
}));

/** フックへ渡す引数。実機の取得状況の遷移を再現するために都度組み立てる。 */
type ReasonProps = {
  photo: MapPhoto | null;
  hasHighResolutionPreview: boolean;
  isLoadingPreview: boolean;
};

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

/** 既定の引数に差分を当ててフックを描画する。取得状況を遷移させない静的なケース用。 */
function renderReason(overrides: Partial<ReasonProps> = {}) {
  const props: ReasonProps = { photo: createPhoto('photo-1'), hasHighResolutionPreview: false, isLoadingPreview: false, ...overrides };

  return renderHook((currentProps: ReasonProps) => usePhotoUnavailableReason(currentProps), { initialProps: props });
}

/**
 * 実機と同じ順序(開く → 取得中 → 取得完了)で取得状況を遷移させる。
 *
 * 拡大表示を開いた最初のコミットでは `isLoadingPreview` がまだ false である点まで含めて再現する。
 * **各遷移のあいだで await しないのが要点。** 実機では `usePhotoPreviewUri` の effect が同じコミット内で
 * `setIsLoadingPreview(true)` するため、存在確認のpromiseが解決する前に再レンダーが起きる。
 *
 * @param view - `renderReason` の戻り値。
 * @param photo - 遷移させる対象の写真。
 * @param hasHighResolutionPreview - 取得完了後に高解像度を得られたかどうか。
 */
async function advanceThroughPreviewAttempt(
  view: ReturnType<typeof renderReason>,
  photo: MapPhoto,
  hasHighResolutionPreview = false,
): Promise<void> {
  view.rerender({ photo, hasHighResolutionPreview: false, isLoadingPreview: true });
  await flushPromises();

  view.rerender({ photo, hasHighResolutionPreview, isLoadingPreview: false });
  await flushPromises();
}

describe('写真を表示できない理由hook usePhotoUnavailableReason', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isPhotoAssetAvailableAsync as jest.Mock).mockResolvedValue(true);
  });

  it('実機の順序(開く→取得中→取得失敗)でも案内を出す', async () => {
    // 機内モードで未ダウンロードの写真を開くと案内が出なかった不具合の回帰テスト。
    // 最初のコミットで存在確認を撃つと、直後の isLoadingPreview 変化で結果が破棄され案内が出なくなる
    const photo = createPhoto('photo-1', 'file:///caches/photo-1-512.jpg');
    const view = renderReason({ photo });

    await advanceThroughPreviewAttempt(view, photo);

    expect(view.result.current.photoUnavailableReason).toBe('unavailable');
  });

  it('取得を試みる前の最初のコミットでは存在確認を撃たない', async () => {
    // 判定材料が揃う前に撃つと、その結果が破棄されたうえ「確認済み」だけが残ってしまう
    renderReason();
    await flushPromises();

    expect(isPhotoAssetAvailableAsync).not.toHaveBeenCalled();
  });

  it('高解像度を取得できていれば案内を出さない', async () => {
    const photo = createPhoto('photo-1');
    const view = renderReason({ photo });

    await advanceThroughPreviewAttempt(view, photo, true);

    expect(view.result.current.photoUnavailableReason).toBeNull();
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
    const photo = createPhoto('photo-1', 'file:///caches/photo-1-512.jpg');
    const view = renderReason({ photo });

    await advanceThroughPreviewAttempt(view, photo);

    expect(isPhotoAssetAvailableAsync).toHaveBeenCalledWith('ph://photo-1');
    expect(view.result.current.photoUnavailableReason).toBe('unavailable');
  });

  it('アセットが存在しない場合は削除済みとして扱う', async () => {
    (isPhotoAssetAvailableAsync as jest.Mock).mockResolvedValue(false);

    const photo = createPhoto('photo-1');
    const view = renderReason({ photo });

    await advanceThroughPreviewAttempt(view, photo);

    expect(view.result.current.photoUnavailableReason).toBe('deleted');
  });

  it('存在確認には保存済みの安定URIを使う', async () => {
    const photo = createPhoto('photo-1');
    const view = renderReason({ photo });

    await advanceThroughPreviewAttempt(view, photo);

    // 旧い行では assetId が localIdentifier のみで ph:// を持たないため、storedUri の方を渡す
    expect(isPhotoAssetAvailableAsync).toHaveBeenCalledWith('ph://photo-1');
  });

  it('アセットが存在するのに取得できない場合は取得不可として扱う', async () => {
    const photo = createPhoto('photo-1');
    const view = renderReason({ photo });

    await advanceThroughPreviewAttempt(view, photo);

    // オフラインでiCloudから落ちてこないだけの場合に「削除された」と案内すると誤情報になる
    expect(view.result.current.photoUnavailableReason).toBe('unavailable');
  });

  it('存在確認に失敗した場合は削除と断定しない', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (isPhotoAssetAvailableAsync as jest.Mock).mockRejectedValue(new Error('native module unavailable'));

    const photo = createPhoto('photo-1');
    const view = renderReason({ photo });

    await advanceThroughPreviewAttempt(view, photo);

    expect(view.result.current.photoUnavailableReason).toBe('unavailable');
  });

  it('同じ写真について存在確認を繰り返さない', async () => {
    const photo = createPhoto('photo-1');
    const view = renderReason({ photo });

    await advanceThroughPreviewAttempt(view, photo);

    await act(async () => {
      view.rerender({ photo: createPhoto('photo-1'), hasHighResolutionPreview: false, isLoadingPreview: false });
    });
    await flushPromises();

    expect(isPhotoAssetAvailableAsync).toHaveBeenCalledTimes(1);
  });

  it('閉じたあとは同じ写真で再表示しない', async () => {
    const photo = createPhoto('photo-1');
    const view = renderReason({ photo });

    await advanceThroughPreviewAttempt(view, photo);
    expect(view.result.current.photoUnavailableReason).toBe('unavailable');

    await act(async () => {
      view.result.current.dismissPhotoDeletedDialog();
    });
    await flushPromises();

    expect(view.result.current.photoUnavailableReason).toBeNull();
    expect(isPhotoAssetAvailableAsync).toHaveBeenCalledTimes(1);
  });

  it('別の写真を開いたら改めて判定する', async () => {
    const firstPhoto = createPhoto('photo-1');
    const view = renderReason({ photo: firstPhoto });

    await advanceThroughPreviewAttempt(view, firstPhoto);

    await act(async () => {
      view.result.current.dismissPhotoDeletedDialog();
    });
    (isPhotoAssetAvailableAsync as jest.Mock).mockResolvedValue(false);

    await advanceThroughPreviewAttempt(view, createPhoto('photo-2'));

    expect(view.result.current.photoUnavailableReason).toBe('deleted');
  });

  it('拡大表示を閉じたら案内も消す', async () => {
    const photo = createPhoto('photo-1');
    const view = renderReason({ photo });

    await advanceThroughPreviewAttempt(view, photo);

    await act(async () => {
      view.rerender({ photo: null, hasHighResolutionPreview: false, isLoadingPreview: false });
    });
    await flushPromises();

    expect(view.result.current.photoUnavailableReason).toBeNull();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
