import { Region } from 'react-native-maps';

import { MapPhoto } from '@/features/photos/photoLibrary';
import {
  clusterMapPhotos,
  clusterMapPhotosByRadius,
  getPhotoClusterRadiusMeters,
  getStablePhotoClusterRadiusMeters,
  MapPhotoCluster,
  paginateMapPhotos,
} from '@/features/photos/photoClusters';
import { distanceMeters } from '@/utils/distance';

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

/**
 * テスト用の決定的疑似乱数生成器(mulberry32)。Math.randomを使うとCI環境間で
 * 結果が変わりテストの再現性が失われるため、シード固定の軽量PRNGを使う。
 *
 * @param seed - シード値。
 * @returns 呼ぶたびに0以上1未満の疑似乱数を返す関数。
 */
function createSeededRandom(seed: number): () => number {
  let state = seed;

  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 現行実装(空間ハッシュ)との等価性検証に使う、素朴な全走査のO(N^2)参照実装。
 * clusterMapPhotosByRadius の旧実装(空間ハッシュ導入前)をテスト内に保存したもの。
 *
 * @param photos - クラスタ対象の写真一覧。
 * @param clusterRadiusMeters - 同一クラスタとして扱う半径メートル。
 * @returns 近接写真をまとめたクラスタ一覧。
 */
function referenceClusterMapPhotosByRadius(photos: MapPhoto[], clusterRadiusMeters: number): MapPhotoCluster[] {
  type MutableCluster = { seed: MapPhoto; photos: MapPhoto[] };
  const clusters: MutableCluster[] = [];

  for (const photo of [...photos].sort((a, b) => b.creationTime - a.creationTime)) {
    let nearestCluster: MutableCluster | null = null;
    let nearestDistanceMeters = Number.POSITIVE_INFINITY;

    for (const cluster of clusters) {
      const distanceToSeedMeters = distanceMeters(photo, cluster.seed);

      if (distanceToSeedMeters > clusterRadiusMeters || distanceToSeedMeters >= nearestDistanceMeters) {
        continue;
      }

      nearestCluster = cluster;
      nearestDistanceMeters = distanceToSeedMeters;
    }

    if (!nearestCluster) {
      clusters.push({ seed: photo, photos: [photo] });
      continue;
    }

    nearestCluster.photos.push(photo);
  }

  return clusters.map((cluster, index) => ({
    id: `ref-${index}-${cluster.seed.id}-${cluster.photos.length}`,
    latitude: cluster.seed.latitude,
    longitude: cluster.seed.longitude,
    photos: cluster.photos,
  }));
}

/**
 * クラスタ比較用に、順序に依存しない形へ正規化する。id は実装(空間ハッシュ版/参照版)で
 * 形式が異なるため比較対象から外し、内容(座標・含まれる写真ID集合)だけを比較する。
 *
 * @param clusters - 正規化するクラスタ一覧。
 * @returns 座標順に並べ替えた比較用データ。
 */
function normalizeClustersForComparison(clusters: MapPhotoCluster[]): Array<{ latitude: number; longitude: number; photoIds: string[] }> {
  return clusters
    .map((cluster) => ({
      latitude: cluster.latitude,
      longitude: cluster.longitude,
      photoIds: cluster.photos.map((photo) => photo.id).sort(),
    }))
    .sort((a, b) => (a.photoIds[0] ?? '').localeCompare(b.photoIds[0] ?? ''));
}

describe('新実装(空間ハッシュ)と参照実装(O(N^2))の等価性', () => {
  it('多様な緯度・経度に散らばる写真でも現行実装と同じクラスタリング結果になる', () => {
    const random = createSeededRandom(20260811);
    const photos: MapPhoto[] = Array.from({ length: 300 }, (_, index) => {
      const latitude = random() * 160 - 80; // -80〜80度
      const longitude = random() * 360 - 180; // -180〜180度
      return createPhoto(`photo-${index}`, latitude, longitude, index);
    });

    for (const clusterRadiusMeters of [10, 75, 300, 1500, 7500]) {
      const actual = normalizeClustersForComparison(clusterMapPhotosByRadius(photos, clusterRadiusMeters));
      const expected = normalizeClustersForComparison(referenceClusterMapPhotosByRadius(photos, clusterRadiusMeters));

      expect(actual).toEqual(expected);
    }
  });

  it('高緯度に密集した写真でも現行実装と同じクラスタリング結果になる', () => {
    // 緯度60〜70度(3セル探索で正当性を保証する上限付近、design docの70度に対応)に密集させ、
    // Web Mercatorの緯度歪みが大きい状況で空間ハッシュの候補絞り込みが正しく機能することを確認する。
    const random = createSeededRandom(20260812);
    const photos: MapPhoto[] = Array.from({ length: 200 }, (_, index) => {
      const latitude = 60 + random() * 10; // 60〜70度
      const longitude = random() * 4 - 2; // 狭い経度範囲に密集させ近接ペアを増やす
      return createPhoto(`photo-${index}`, latitude, longitude, index);
    });

    for (const clusterRadiusMeters of [75, 300, 1500]) {
      const actual = normalizeClustersForComparison(clusterMapPhotosByRadius(photos, clusterRadiusMeters));
      const expected = normalizeClustersForComparison(referenceClusterMapPhotosByRadius(photos, clusterRadiusMeters));

      expect(actual).toEqual(expected);
    }
  });
});
