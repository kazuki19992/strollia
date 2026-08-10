import { Region } from 'react-native-maps';

import { MapPhoto } from '@/features/photos/photoLibrary';
import {
  clusterMapPhotos,
  clusterMapPhotosByRadius,
  getPhotoClusterRadiusMeters,
  paginateMapPhotos,
} from '@/features/photos/photoClusters';

/**
 * テスト用の地図写真を最小プロパティで作る。
 *
 * @param id - 写真ID。
 * @param latitude - 緯度。
 * @param longitude - 経度。
 * @param creationTime - 撮影日時。
 * @returns テスト用MapPhoto。
 */
function createPhoto(id: string, latitude: number, longitude: number, creationTime: number): MapPhoto {
  return {
    id,
    uri: `file:///${id}.jpg`,
    latitude,
    longitude,
    creationTime,
    width: 100,
    height: 100,
  };
}

const region: Region = {
  latitude: 35,
  longitude: 139,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

describe('写真クラスタ半径 getPhotoClusterRadiusMeters', () => {
  it('拡大率が低いほどクラスタ範囲を広げる', () => {
    const zoomedIn = getPhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.001 });
    const zoomedOut = getPhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.08 });

    expect(zoomedOut).toBeGreaterThan(zoomedIn);
  });

  it('クラスタ範囲に下限を適用し、上限なしで広域ほど大きくする', () => {
    const veryZoomedIn = getPhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.00001 });
    const veryZoomedOut = getPhotoClusterRadiusMeters({ ...region, latitudeDelta: 5 });

    expect(veryZoomedIn).toBe(10);
    expect(veryZoomedOut).toBeCloseTo(16_650);
  });

  it('よく使うズーム範囲でもクラスタ範囲が十分変化する', () => {
    const closeRange = getPhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.001 });
    const neighborhoodRange = getPhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.01 });
    const wideRange = getPhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.08 });

    expect(closeRange).toBe(10);
    expect(neighborhoodRange).toBeGreaterThanOrEqual(30);
    expect(wideRange).toBeCloseTo(266.4);
  });

  it('表示範囲の高さに比例してクラスタ範囲を線形に広げる', () => {
    const rangeA = getPhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.02 });
    const rangeB = getPhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.04 });

    expect(rangeB).toBeCloseTo(rangeA * 2);
  });

  // パン(中心移動のみ)でクラスタを再計算しないメモ化は、この性質が前提になっている。
  it('中心座標だけが変わっても(パン)クラスタ範囲は変化しない', () => {
    const beforePan = getPhotoClusterRadiusMeters(region);
    const afterPan = getPhotoClusterRadiusMeters({ ...region, latitude: 40, longitude: -73 });

    expect(afterPan).toBe(beforePan);
  });
});

describe('半径指定の写真クラスタ clusterMapPhotosByRadius', () => {
  it('表示範囲から求めた半径を渡すとclusterMapPhotosと同じ結果になる', () => {
    const photos = [createPhoto('a', 35.0001, 139.0001, 1), createPhoto('b', 35.0007, 139.0001, 2)];

    expect(clusterMapPhotosByRadius(photos, getPhotoClusterRadiusMeters(region))).toEqual(clusterMapPhotos(photos, region));
  });

  it('中心座標が違っても半径が同じなら同じクラスタ結果を返す', () => {
    const photos = [createPhoto('a', 35.0001, 139.0001, 1), createPhoto('b', 35.00012, 139.00012, 2)];
    const pannedRegion: Region = { ...region, latitude: 40, longitude: -73 };

    expect(clusterMapPhotos(photos, pannedRegion)).toEqual(clusterMapPhotos(photos, region));
  });

  it('半径を広げるほど写真がまとまる', () => {
    const photos = [createPhoto('a', 35.0001, 139.0001, 1), createPhoto('b', 35.0007, 139.0001, 2)];

    expect(clusterMapPhotosByRadius(photos, 10)).toHaveLength(2);
    expect(clusterMapPhotosByRadius(photos, 300)).toHaveLength(1);
  });
});

describe('写真クラスタ clusterMapPhotos', () => {
  it('近い写真を1つのクラスタにまとめる', () => {
    const clusters = clusterMapPhotos([createPhoto('old', 35.0001, 139.0001, 1), createPhoto('new', 35.00012, 139.00012, 2)], region);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].photos.map((photo) => photo.id)).toEqual(['new', 'old']);
    expect(clusters[0].latitude).toBe(35.00012);
    expect(clusters[0].longitude).toBe(139.00012);
  });

  it('離れた写真は別クラスタに分ける', () => {
    const clusters = clusterMapPhotos([createPhoto('a', 35.0001, 139.0001, 1), createPhoto('b', 35.009, 139.009, 2)], region);

    expect(clusters).toHaveLength(2);
    expect(clusters.flatMap((cluster) => cluster.photos.map((photo) => photo.id)).sort()).toEqual(['a', 'b']);
  });

  it('グリッド境界をまたいだ近接写真も1つのクラスタにまとめる', () => {
    const clusters = clusterMapPhotos([createPhoto('a', 35.00049, 139.00099, 1), createPhoto('b', 35.00051, 139.00101, 2)], region);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].photos.map((photo) => photo.id)).toEqual(['b', 'a']);
  });

  it('同じ場所と言えない距離の写真は別クラスタに分ける', () => {
    const clusters = clusterMapPhotos([createPhoto('a', 35.0001, 139.0001, 1), createPhoto('b', 35.0007, 139.0001, 2)], region);

    expect(clusters).toHaveLength(2);
  });

  it('連鎖的に離れた写真を巨大クラスタにまとめない', () => {
    const clusters = clusterMapPhotos(
      [createPhoto('a', 35.0001, 139.0001, 3), createPhoto('b', 35.00035, 139.0001, 2), createPhoto('c', 35.0006, 139.0001, 1)],
      region,
    );

    expect(clusters.length).toBeGreaterThan(1);
  });

  it('表示範囲がない場合も安全にクラスタを作る', () => {
    const clusters = clusterMapPhotos([createPhoto('a', 35.0001, 139.0001, 1)], null);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].photos[0].id).toBe('a');
  });

  it('同じ写真間隔でも拡大時は分けて縮小時はまとめる', () => {
    const photos = [createPhoto('a', 35.0001, 139.0001, 1), createPhoto('b', 35.0007, 139.0001, 2)];
    const zoomedInClusters = clusterMapPhotos(photos, { ...region, latitudeDelta: 0.001 });
    const zoomedOutClusters = clusterMapPhotos(photos, { ...region, latitudeDelta: 0.08 });

    expect(zoomedInClusters).toHaveLength(2);
    expect(zoomedOutClusters).toHaveLength(1);
  });
});

describe('写真クラスタページ paginateMapPhotos', () => {
  it('写真を9枚ずつページ分割する', () => {
    const photos = Array.from({ length: 20 }, (_, index) => createPhoto(`photo-${index}`, 35, 139, index));
    const pages = paginateMapPhotos(photos);

    expect(pages).toHaveLength(3);
    expect(pages.map((page) => page.length)).toEqual([9, 9, 2]);
  });

  it('ページサイズが不正な場合は空配列を返す', () => {
    expect(paginateMapPhotos([createPhoto('a', 35, 139, 1)], 0)).toEqual([]);
  });
});
