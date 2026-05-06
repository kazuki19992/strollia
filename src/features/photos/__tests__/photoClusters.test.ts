import { Region } from 'react-native-maps';

import { MapPhoto } from '../photoLibrary';
import { clusterMapPhotos } from '../photoClusters';

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

describe('写真クラスタ clusterMapPhotos', () => {
  it('近い写真を1つのクラスタにまとめる', () => {
    const clusters = clusterMapPhotos(
      [createPhoto('old', 35.0001, 139.0001, 1), createPhoto('new', 35.00012, 139.00012, 2)],
      region,
    );

    expect(clusters).toHaveLength(1);
    expect(clusters[0].photos.map((photo) => photo.id)).toEqual(['new', 'old']);
    expect(clusters[0].latitude).toBe(35.00012);
    expect(clusters[0].longitude).toBe(139.00012);
  });

  it('離れた写真は別クラスタに分ける', () => {
    const clusters = clusterMapPhotos(
      [createPhoto('a', 35.0001, 139.0001, 1), createPhoto('b', 35.009, 139.009, 2)],
      region,
    );

    expect(clusters).toHaveLength(2);
    expect(clusters.flatMap((cluster) => cluster.photos.map((photo) => photo.id)).sort()).toEqual(['a', 'b']);
  });

  it('グリッド境界をまたいだ近接写真も1つのクラスタにまとめる', () => {
    const clusters = clusterMapPhotos(
      [createPhoto('a', 35.00049, 139.00099, 1), createPhoto('b', 35.00051, 139.00101, 2)],
      region,
    );

    expect(clusters).toHaveLength(1);
    expect(clusters[0].photos.map((photo) => photo.id)).toEqual(['b', 'a']);
  });

  it('同じ場所と言えない距離の写真は別クラスタに分ける', () => {
    const clusters = clusterMapPhotos(
      [createPhoto('a', 35.0001, 139.0001, 1), createPhoto('b', 35.0007, 139.0001, 2)],
      region,
    );

    expect(clusters).toHaveLength(2);
  });

  it('連鎖的に離れた写真を巨大クラスタにまとめない', () => {
    const clusters = clusterMapPhotos(
      [
        createPhoto('a', 35.0001, 139.0001, 3),
        createPhoto('b', 35.00035, 139.0001, 2),
        createPhoto('c', 35.0006, 139.0001, 1),
      ],
      region,
    );

    expect(clusters.length).toBeGreaterThan(1);
  });

  it('表示範囲がない場合も安全にクラスタを作る', () => {
    const clusters = clusterMapPhotos([createPhoto('a', 35.0001, 139.0001, 1)], null);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].photos[0].id).toBe('a');
  });
});
