import { renderHook } from '@testing-library/react-native';

import { reportPhotoMapDiagnostics } from '@/config/sentry';
import type { MapPhotoCluster } from '@/features/photos/photoClusters';
import type { MapPhoto } from '@/features/photos/photoLibrary';
import { usePhotoMapClusterDiagnostics } from '@/ui/hooks/usePhotoMapClusterDiagnostics';

jest.mock('@/config/sentry', () => ({
  reportPhotoMapDiagnostics: jest.fn(),
}));

/**
 * テスト用のジオタグ付き写真を作る。
 *
 * @param id - アセットID。
 * @returns MapPhoto相当のテストデータ。
 */
function createPhoto(id: string): MapPhoto {
  return {
    id,
    uri: `file:///${id}.jpg`,
    latitude: 35,
    longitude: 139,
    creationTime: 1,
    width: 100,
    height: 80,
  };
}

/**
 * テスト用の写真クラスタを作る。
 *
 * @param id - クラスタID。
 * @param photos - クラスタに含まれる写真。
 * @returns MapPhotoCluster相当のテストデータ。
 */
function createCluster(id: string, photos: MapPhoto[]): MapPhotoCluster {
  return {
    id,
    latitude: 35,
    longitude: 139,
    photos,
  };
}

describe('写真クラスタ診断フック usePhotoMapClusterDiagnostics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enabled が false のときは送らない', () => {
    const photos = [createPhoto('asset-1')];
    const clusters = [createCluster('cluster-1', photos)];

    renderHook(() => usePhotoMapClusterDiagnostics({ enabled: false, photos, clusters }));

    expect(reportPhotoMapDiagnostics).not.toHaveBeenCalled();
  });

  it('enabled が true のとき初回に写真件数とクラスタ件数を1回だけ送る', () => {
    const photos = [createPhoto('asset-1'), createPhoto('asset-2')];
    const clusters = [createCluster('cluster-1', photos)];

    renderHook(() => usePhotoMapClusterDiagnostics({ enabled: true, photos, clusters }));

    expect(reportPhotoMapDiagnostics).toHaveBeenCalledTimes(1);
    expect(reportPhotoMapDiagnostics).toHaveBeenCalledWith('cluster', {
      photoCount: 2,
      clusterCount: 1,
    });
  });

  it('photos の参照が同じままなら clusters だけ変わっても再送しない', () => {
    const photos = [createPhoto('asset-1')];
    const { rerender } = renderHook(
      ({ clusters }: { clusters: MapPhotoCluster[] }) => usePhotoMapClusterDiagnostics({ enabled: true, photos, clusters }),
      { initialProps: { clusters: [createCluster('cluster-1', photos)] } },
    );

    // ズーム変更でクラスタ半径だけが変わるケース。イベントが増えすぎるため送らない
    rerender({ clusters: [createCluster('cluster-1', photos), createCluster('cluster-2', photos)] });

    expect(reportPhotoMapDiagnostics).toHaveBeenCalledTimes(1);
  });

  it('photos の参照が変わったら再送する', () => {
    const initialPhotos = [createPhoto('asset-1')];
    const { rerender } = renderHook(
      ({ photos }: { photos: MapPhoto[] }) =>
        usePhotoMapClusterDiagnostics({ enabled: true, photos, clusters: [createCluster('cluster-1', photos)] }),
      { initialProps: { photos: initialPhotos } },
    );

    rerender({ photos: [createPhoto('asset-1'), createPhoto('asset-2')] });

    expect(reportPhotoMapDiagnostics).toHaveBeenCalledTimes(2);
    expect(reportPhotoMapDiagnostics).toHaveBeenLastCalledWith('cluster', {
      photoCount: 2,
      clusterCount: 1,
    });
  });

  it('enabled を false へ落としてから true へ戻すと同じ photos でも再送する', () => {
    const photos = [createPhoto('asset-1')];
    const clusters = [createCluster('cluster-1', photos)];
    const { rerender } = renderHook(({ enabled }: { enabled: boolean }) => usePhotoMapClusterDiagnostics({ enabled, photos, clusters }), {
      initialProps: { enabled: true },
    });

    rerender({ enabled: false });
    rerender({ enabled: true });

    expect(reportPhotoMapDiagnostics).toHaveBeenCalledTimes(2);
  });

  it('写真が0件でも件数として送り、写真そのものは送らない', () => {
    const photos: MapPhoto[] = [];

    renderHook(() => usePhotoMapClusterDiagnostics({ enabled: true, photos, clusters: [] }));

    // ローカルファースト方針(AGENTS.md §5)により、送るのは件数だけ
    expect(reportPhotoMapDiagnostics).toHaveBeenCalledWith('cluster', { photoCount: 0, clusterCount: 0 });
  });
});
