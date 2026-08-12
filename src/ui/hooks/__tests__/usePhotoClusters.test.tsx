import { renderHook } from '@testing-library/react-native';
import type { Region } from 'react-native-maps';

import { clusterMapPhotosByRadius } from '@/features/photos/photoClusters';
import type { MapPhoto } from '@/features/photos/photoLibrary';
import { usePhotoClusters } from '@/ui/hooks/usePhotoClusters';

// 実装はそのまま使い、呼び出し回数だけを観測する。完全なモックにすると
// 「半径が変わったら再計算される」側の検証が空振りになるため。
jest.mock('@/features/photos/photoClusters', () => {
  const actual = jest.requireActual('@/features/photos/photoClusters');

  return {
    ...actual,
    clusterMapPhotosByRadius: jest.fn(actual.clusterMapPhotosByRadius),
  };
});

/**
 * テスト用の地図写真を最小プロパティで作る。
 *
 * @param id - 写真ID。
 * @returns テスト用MapPhoto。
 */
function createPhoto(id: string): MapPhoto {
  return { id, uri: `file:///${id}.jpg`, latitude: 35.0001, longitude: 139.0001, creationTime: 1, width: 100, height: 100 };
}

const baseRegion: Region = { latitude: 35, longitude: 139, latitudeDelta: 0.01, longitudeDelta: 0.01 };

describe('写真クラスタhook usePhotoClusters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('パン(中心移動のみ)ではクラスタを再計算しない', () => {
    const photos = [createPhoto('a')];
    const { rerender } = renderHook(({ region }: { region: Region }) => usePhotoClusters(photos, region), {
      initialProps: { region: baseRegion },
    });

    expect(clusterMapPhotosByRadius).toHaveBeenCalledTimes(1);

    // latitudeDelta は据え置き、中心だけを大きく動かす。
    rerender({ region: { ...baseRegion, latitude: 40, longitude: -73 } });

    expect(clusterMapPhotosByRadius).toHaveBeenCalledTimes(1);
  });

  it('ズーム(latitudeDelta変化)ではクラスタを再計算する', () => {
    const photos = [createPhoto('a')];
    const { rerender } = renderHook(({ region }: { region: Region }) => usePhotoClusters(photos, region), {
      initialProps: { region: baseRegion },
    });

    expect(clusterMapPhotosByRadius).toHaveBeenCalledTimes(1);

    rerender({ region: { ...baseRegion, latitudeDelta: 0.08 } });

    expect(clusterMapPhotosByRadius).toHaveBeenCalledTimes(2);
  });

  it('写真一覧が変わればクラスタを再計算する', () => {
    const { rerender } = renderHook(({ photos }: { photos: MapPhoto[] }) => usePhotoClusters(photos, baseRegion), {
      initialProps: { photos: [createPhoto('a')] },
    });

    expect(clusterMapPhotosByRadius).toHaveBeenCalledTimes(1);

    rerender({ photos: [createPhoto('a'), createPhoto('b')] });

    expect(clusterMapPhotosByRadius).toHaveBeenCalledTimes(2);
  });

  it('パンを繰り返しても初回の計算結果を返し続ける', () => {
    const photos = [createPhoto('a'), createPhoto('b')];
    const { result, rerender } = renderHook(({ region }: { region: Region }) => usePhotoClusters(photos, region), {
      initialProps: { region: baseRegion },
    });
    const firstResult = result.current;

    rerender({ region: { ...baseRegion, latitude: 36 } });
    rerender({ region: { ...baseRegion, latitude: 37 } });

    // 参照ごと同一であることまで確認する(再計算していれば新しい配列になる)。
    expect(result.current).toBe(firstResult);
  });

  it('ヒステリシス境界をわずかに超えるだけでは再計算せず、大きく超えると再計算する', () => {
    const photos = [createPhoto('a')];
    const { rerender } = renderHook(({ region }: { region: Region }) => usePhotoClusters(photos, region), {
      initialProps: { region: { ...baseRegion, latitudeDelta: 0.04 } }, // 段階3(150m)の範囲内
    });

    expect(clusterMapPhotosByRadius).toHaveBeenCalledTimes(1);

    // 段階境界(0.045)をわずかに超えるが、ヒステリシス帯(0.045 * 1.2 = 0.054)には収まる。
    rerender({ region: { ...baseRegion, latitudeDelta: 0.05 } });
    expect(clusterMapPhotosByRadius).toHaveBeenCalledTimes(1);

    // ヒステリシス帯を明確に超える。
    rerender({ region: { ...baseRegion, latitudeDelta: 0.06 } });
    expect(clusterMapPhotosByRadius).toHaveBeenCalledTimes(2);
  });
});
