import { useEffect } from 'react';

import { loadGeotaggedPhotos, MapPhoto } from '@/features/photos/photoLibrary';
import { PhotoMapOverlayState, usePhotoMapOverlay } from '@/app/hooks/usePhotoMapOverlay';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

jest.mock('@/features/photos/photoLibrary', () => ({
  loadGeotaggedPhotos: jest.fn(),
}));

type HookProbeProps = {
  enabled: boolean;
  onState: (state: PhotoMapOverlayState) => void;
};

/**
 * hookの状態をテストへ渡すための最小コンポーネント。
 *
 * @param props - hookへ渡すenabledと、状態通知コールバック。
 * @returns 描画要素は不要なのでnull。
 */
function HookProbe({ enabled, onState }: HookProbeProps) {
  const state = usePhotoMapOverlay(enabled);

  useEffect(() => {
    onState(state);
  }, [onState, state]);

  return null;
}

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
    const states: PhotoMapOverlayState[] = [];
    (loadGeotaggedPhotos as jest.Mock).mockResolvedValue([photo]);

    await act(async () => {
      ReactTestRenderer.create(<HookProbe enabled onState={(state) => states.push(state)} />);
    });

    expect(loadGeotaggedPhotos).toHaveBeenCalledTimes(1);
    expect(states.at(-1)?.photos).toEqual([photo]);
  });

  it('無効な場合は写真を読み込まず表示状態を空にする', async () => {
    const states: PhotoMapOverlayState[] = [];

    await act(async () => {
      ReactTestRenderer.create(<HookProbe enabled={false} onState={(state) => states.push(state)} />);
    });

    expect(loadGeotaggedPhotos).not.toHaveBeenCalled();
    expect(states.at(-1)?.photos).toEqual([]);
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
    const states: PhotoMapOverlayState[] = [];
    let resolvePhotos: (photos: MapPhoto[]) => void = () => undefined;
    (loadGeotaggedPhotos as jest.Mock).mockReturnValue(
      new Promise<MapPhoto[]>((resolve) => {
        resolvePhotos = resolve;
      }),
    );

    let renderer: any;

    await act(async () => {
      renderer = ReactTestRenderer.create(<HookProbe enabled onState={(state) => states.push(state)} />);
    });

    await act(async () => {
      renderer.update(<HookProbe enabled={false} onState={(state) => states.push(state)} />);
    });

    await act(async () => {
      resolvePhotos([photo]);
    });

    expect(states.at(-1)?.photos).toEqual([]);
    expect(states.at(-1)?.isLoadingPhotos).toBe(false);
  });
});
