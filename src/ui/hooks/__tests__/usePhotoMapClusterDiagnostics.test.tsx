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
    storedUri: `ph://${id}`,
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

/** フックへ渡す引数の型。rerender で読み込み状態と写真一覧を差し替えるために使う。 */
type DiagnosticsProps = {
  enabled: boolean;
  isLoadingPhotos: boolean;
  photos: MapPhoto[];
  clusters: MapPhotoCluster[];
};

describe('写真クラスタ診断フック usePhotoMapClusterDiagnostics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enabled が false のときは送らない', () => {
    const photos = [createPhoto('asset-1')];
    const clusters = [createCluster('cluster-1', photos)];

    renderHook(() => usePhotoMapClusterDiagnostics({ enabled: false, isLoadingPhotos: false, photos, clusters }));

    expect(reportPhotoMapDiagnostics).not.toHaveBeenCalled();
  });

  it('enabled が true になった直後の空配列(読み込み開始前)では送らない', () => {
    // usePhotoMapOverlay の読み込み effect が走る前のコミット。photoCount: 0 の偽イベントを避ける
    renderHook(() => usePhotoMapClusterDiagnostics({ enabled: true, isLoadingPhotos: false, photos: [], clusters: [] }));

    expect(reportPhotoMapDiagnostics).not.toHaveBeenCalled();
  });

  it('写真の読み込み中は送らない', () => {
    const { rerender } = renderHook((props: DiagnosticsProps) => usePhotoMapClusterDiagnostics(props), {
      initialProps: { enabled: true, isLoadingPhotos: false, photos: [], clusters: [] },
    });

    rerender({ enabled: true, isLoadingPhotos: true, photos: [], clusters: [] });

    expect(reportPhotoMapDiagnostics).not.toHaveBeenCalled();
  });

  it('読み込み完了後に写真件数とクラスタ件数を1回だけ送る', () => {
    const { rerender } = renderHook((props: DiagnosticsProps) => usePhotoMapClusterDiagnostics(props), {
      initialProps: { enabled: true, isLoadingPhotos: false, photos: [], clusters: [] },
    });

    rerender({ enabled: true, isLoadingPhotos: true, photos: [], clusters: [] });

    const loadedPhotos = [createPhoto('asset-1'), createPhoto('asset-2')];
    const loadedClusters = [createCluster('cluster-1', loadedPhotos)];
    rerender({ enabled: true, isLoadingPhotos: false, photos: loadedPhotos, clusters: loadedClusters });

    expect(reportPhotoMapDiagnostics).toHaveBeenCalledTimes(1);
    expect(reportPhotoMapDiagnostics).toHaveBeenCalledWith('cluster', {
      photoCount: 2,
      clusterCount: 1,
    });
  });

  it('写真0件で読み込みが完了した場合も件数として1回送り、写真そのものは送らない', () => {
    const { rerender } = renderHook((props: DiagnosticsProps) => usePhotoMapClusterDiagnostics(props), {
      initialProps: { enabled: true, isLoadingPhotos: false, photos: [], clusters: [] },
    });

    rerender({ enabled: true, isLoadingPhotos: true, photos: [], clusters: [] });
    // 「読み込んだ結果0件」は原因切り分けに必要な診断なので送る。ただし送るのは件数だけ(AGENTS.md §5)
    rerender({ enabled: true, isLoadingPhotos: false, photos: [], clusters: [] });

    expect(reportPhotoMapDiagnostics).toHaveBeenCalledTimes(1);
    expect(reportPhotoMapDiagnostics).toHaveBeenCalledWith('cluster', { photoCount: 0, clusterCount: 0 });
  });

  it('photos の参照が同じままなら clusters だけ変わっても再送しない', () => {
    const loadedPhotos = [createPhoto('asset-1')];
    const { rerender } = renderHook((props: DiagnosticsProps) => usePhotoMapClusterDiagnostics(props), {
      initialProps: { enabled: true, isLoadingPhotos: false, photos: [], clusters: [] },
    });

    rerender({ enabled: true, isLoadingPhotos: true, photos: [], clusters: [] });
    rerender({ enabled: true, isLoadingPhotos: false, photos: loadedPhotos, clusters: [createCluster('cluster-1', loadedPhotos)] });

    // ズーム変更でクラスタ半径だけが変わるケース。イベントが増えすぎるため送らない
    rerender({
      enabled: true,
      isLoadingPhotos: false,
      photos: loadedPhotos,
      clusters: [createCluster('cluster-1', loadedPhotos), createCluster('cluster-2', loadedPhotos)],
    });

    expect(reportPhotoMapDiagnostics).toHaveBeenCalledTimes(1);
  });

  it('再読み込みで photos の参照が変わったら再送する', () => {
    const firstPhotos = [createPhoto('asset-1')];
    const { rerender } = renderHook((props: DiagnosticsProps) => usePhotoMapClusterDiagnostics(props), {
      initialProps: { enabled: true, isLoadingPhotos: false, photos: [], clusters: [] },
    });

    rerender({ enabled: true, isLoadingPhotos: true, photos: [], clusters: [] });
    rerender({ enabled: true, isLoadingPhotos: false, photos: firstPhotos, clusters: [createCluster('cluster-1', firstPhotos)] });

    const secondPhotos = [createPhoto('asset-1'), createPhoto('asset-2')];
    rerender({ enabled: true, isLoadingPhotos: false, photos: secondPhotos, clusters: [createCluster('cluster-1', secondPhotos)] });

    expect(reportPhotoMapDiagnostics).toHaveBeenCalledTimes(2);
    expect(reportPhotoMapDiagnostics).toHaveBeenLastCalledWith('cluster', {
      photoCount: 2,
      clusterCount: 1,
    });
  });

  it('enabled を false へ落としてから true へ戻すと、次の読み込み完了後にまた送る', () => {
    const firstPhotos = [createPhoto('asset-1')];
    const { rerender } = renderHook((props: DiagnosticsProps) => usePhotoMapClusterDiagnostics(props), {
      initialProps: { enabled: true, isLoadingPhotos: false, photos: [], clusters: [] },
    });

    rerender({ enabled: true, isLoadingPhotos: true, photos: [], clusters: [] });
    rerender({ enabled: true, isLoadingPhotos: false, photos: firstPhotos, clusters: [createCluster('cluster-1', firstPhotos)] });

    rerender({ enabled: false, isLoadingPhotos: false, photos: [], clusters: [] });

    const secondPhotos = [createPhoto('asset-2')];
    rerender({ enabled: true, isLoadingPhotos: true, photos: [], clusters: [] });
    rerender({ enabled: true, isLoadingPhotos: false, photos: secondPhotos, clusters: [createCluster('cluster-1', secondPhotos)] });

    expect(reportPhotoMapDiagnostics).toHaveBeenCalledTimes(2);
  });

  it('enabled が true へ戻った直後、再読み込みが始まる前には送らない', () => {
    const firstPhotos = [createPhoto('asset-1')];
    const { rerender } = renderHook((props: DiagnosticsProps) => usePhotoMapClusterDiagnostics(props), {
      initialProps: { enabled: true, isLoadingPhotos: false, photos: [], clusters: [] },
    });

    rerender({ enabled: true, isLoadingPhotos: true, photos: [], clusters: [] });
    rerender({ enabled: true, isLoadingPhotos: false, photos: firstPhotos, clusters: [createCluster('cluster-1', firstPhotos)] });
    rerender({ enabled: false, isLoadingPhotos: false, photos: [], clusters: [] });

    // OFF で写真がクリアされた直後の空配列。読み込みを観測していないので送らない
    rerender({ enabled: true, isLoadingPhotos: false, photos: [], clusters: [] });

    expect(reportPhotoMapDiagnostics).toHaveBeenCalledTimes(1);
  });
});
