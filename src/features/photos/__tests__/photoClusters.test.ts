import { Region } from 'react-native-maps';

import { MapPhoto } from '@/features/photos/photoLibrary';
import {
  clusterMapPhotos,
  clusterMapPhotosByRadius,
  getPhotoClusterRadiusMeters,
  getStablePhotoClusterRadiusMeters,
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
  it('各段階の境界でちょうど切り替わる', () => {
    // 境界未満は手前の段階、境界以上は次の段階になる。
    expect(getPhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.0029 })).toBe(10);
    expect(getPhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.003 })).toBe(30);
    expect(getPhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.0089 })).toBe(30);
    expect(getPhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.009 })).toBe(75);
  });

  it('極端に狭い表示範囲では最小段階(10m)になる', () => {
    expect(getPhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.00001 })).toBe(10);
  });

  it('最終段階(15000m, 境界4.5)を超える広域表示では世界地図相当のフォールバック値になる', () => {
    expect(getPhotoClusterRadiusMeters({ ...region, latitudeDelta: 4.5 })).toBe(3_000_000);
    expect(getPhotoClusterRadiusMeters({ ...region, latitudeDelta: 180 })).toBe(3_000_000);
  });

  it('表示範囲がない場合は近距離用の既定値(latitudeDelta=0.01相当)を使う', () => {
    expect(getPhotoClusterRadiusMeters(null)).toBe(75);
  });

  // パン(中心移動のみ)でクラスタを再計算しないメモ化は、この性質が前提になっている。
  it('中心座標だけが変わっても(パン)クラスタ範囲は変化しない', () => {
    const beforePan = getPhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.08 });
    const afterPan = getPhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.08, latitude: 40, longitude: -73 });

    expect(afterPan).toBe(beforePan);
  });
});

describe('写真クラスタ半径のヒステリシス getStablePhotoClusterRadiusMeters', () => {
  it('前回値がない場合は段階選択した値をそのまま返す', () => {
    expect(getStablePhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.04 }, null)).toBe(150);
  });

  it('段階境界をわずかに超えるだけならヒステリシス帯の範囲内で前回値を維持する', () => {
    // 段階3(150m)→4(300m)の境界は0.045。ヒステリシス比率0.2により、
    // 0.045 * 1.2 = 0.054 未満なら前回値を維持する。
    const stableRadius = getStablePhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.05 }, 150);

    expect(stableRadius).toBe(150);
  });

  it('ヒステリシス帯を明確に超えたら次の段階へ切り替える', () => {
    const stableRadius = getStablePhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.06 }, 150);

    expect(stableRadius).toBe(300);
  });

  it('段階を縮小方向にまたぐときも同じヒステリシスが働く', () => {
    // 境界0.045未満、かつヒステリシス帯の下限(0.045 * 0.8 = 0.036)以上なら前回値(300)を維持する。
    const stableWithinBand = getStablePhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.04 }, 300);
    expect(stableWithinBand).toBe(300);

    const stableBelowBand = getStablePhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.03 }, 300);
    expect(stableBelowBand).toBe(150);
  });

  it('2段階以上離れた変化ではヒステリシスを無視して即座に切り替える', () => {
    const stableRadius = getStablePhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.08 }, 75);

    expect(stableRadius).toBe(300);
  });

  it('前回値が段階テーブルに存在しない場合は素直に段階選択した値を返す', () => {
    const stableRadius = getStablePhotoClusterRadiusMeters({ ...region, latitudeDelta: 0.05 }, 999);

    expect(stableRadius).toBe(300);
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
    // 緯度差0.0009°(約100m)。段階量子化後の既定半径(75m)より明確に離す。
    const clusters = clusterMapPhotos([createPhoto('a', 35.0001, 139.0001, 1), createPhoto('b', 35.001, 139.0001, 2)], region);

    expect(clusters).toHaveLength(2);
  });

  it('連鎖的に離れた写真を巨大クラスタにまとめない', () => {
    // a-b、b-cはそれぞれ約50m(新半径75m以内で直接隣接可能。境界から25m の余裕)だが、
    // a-c間は約100m(新半径75mを25m超える)。b経由で連鎖してもseedはaのまま動かないため、
    // cはaとの直接距離で判定され別クラスタになる(連鎖防止の検証)。
    const clusters = clusterMapPhotos(
      [createPhoto('a', 35.0001, 139.0001, 3), createPhoto('b', 35.00055, 139.0001, 2), createPhoto('c', 35.001, 139.0001, 1)],
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
