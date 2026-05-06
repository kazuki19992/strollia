import { Region } from 'react-native-maps';

import { MapPhoto } from './photoLibrary';
import { distanceMeters } from '../../utils/distance';

/** 地図上で近接写真をまとめた表示単位。 */
export type MapPhotoCluster = {
  /** クラスタを安定して描画するための短いID。 */
  id: string;
  /** クラスタ内写真の代表緯度。 */
  latitude: number;
  /** クラスタ内写真の代表経度。 */
  longitude: number;
  /** この吹き出しに含まれる写真。新しい写真が先頭に来る。 */
  photos: MapPhoto[];
};

const FALLBACK_LATITUDE_DELTA = 0.01;
const METERS_PER_LATITUDE_DEGREE = 111_000;
/** 同じ地点で撮った写真をまとめるための最小半径。広げすぎると別地点まで1クラスタになる。 */
const MINIMUM_CLUSTER_RADIUS_METERS = 18;
/** ズームアウト時に画面上で重なる写真だけ少し広めにまとめる。 */
const REGION_CLUSTER_RATIO = 0.008;
/** 別スポットの写真が一緒にまとまらないよう、クラスタ半径は控えめに上限を置く。 */
const MAXIMUM_CLUSTER_RADIUS_METERS = 45;

type MutablePhotoCluster = {
  seed: MapPhoto;
  photos: MapPhoto[];
};

/**
 * 表示範囲に応じて、同じ地点付近の写真だけをメートル距離ベースでまとめる。
 *
 * @param photos - 地図上に表示するジオタグ付き写真一覧。
 * @param region - 現在の地図表示範囲。未取得の場合は近距離用の既定値を使う。
 * @returns 近接写真をまとめたクラスタ一覧。
 */
export function clusterMapPhotos(photos: MapPhoto[], region: Region | null): MapPhotoCluster[] {
  const clusterRadiusMeters = getClusterRadiusMeters(region);
  const clusters: MutablePhotoCluster[] = [];

  // 新しい写真を代表サムネイルと代表座標にし、平均化で別地点へ飛ばないようにする。
  for (const photo of [...photos].sort((a, b) => b.creationTime - a.creationTime)) {
    const nearestCluster = findNearestCluster(photo, clusters, clusterRadiusMeters);

    if (!nearestCluster) {
      clusters.push({ seed: photo, photos: [photo] });
      continue;
    }

    nearestCluster.photos.push(photo);
  }

  return clusters.map((cluster, index) => ({
    id: createClusterId(cluster, index),
    latitude: cluster.seed.latitude,
    longitude: cluster.seed.longitude,
    photos: cluster.photos,
  }));
}

/**
 * 地図の表示範囲から写真クラスタ半径をメートル単位で求める。
 *
 * @param region - 現在の地図表示範囲。
 * @returns クラスタ判定に使う半径メートル。
 */
function getClusterRadiusMeters(region: Region | null): number {
  const visibleHeightMeters = Math.abs(region?.latitudeDelta ?? FALLBACK_LATITUDE_DELTA) * METERS_PER_LATITUDE_DEGREE;
  const dynamicRadiusMeters = visibleHeightMeters * REGION_CLUSTER_RATIO;

  return Math.min(Math.max(dynamicRadiusMeters, MINIMUM_CLUSTER_RADIUS_METERS), MAXIMUM_CLUSTER_RADIUS_METERS);
}

/**
 * 写真を追加できる最寄りクラスタを探す。クラスタの代表写真との距離だけを見ることで、連鎖的な巨大クラスタ化を防ぐ。
 *
 * @param photo - 追加候補の写真。
 * @param clusters - 既存クラスタ一覧。
 * @param clusterRadiusMeters - 同一クラスタとして扱う半径メートル。
 * @returns 同一表示クラスタとして扱える最寄りクラスタ。見つからない場合はnull。
 */
function findNearestCluster(
  photo: MapPhoto,
  clusters: MutablePhotoCluster[],
  clusterRadiusMeters: number,
): MutablePhotoCluster | null {
  let nearestCluster: MutablePhotoCluster | null = null;
  let nearestDistanceMeters = Number.POSITIVE_INFINITY;

  for (const cluster of clusters) {
    const distanceToSeedMeters = distanceMeters(photo, cluster.seed);

    if (distanceToSeedMeters > clusterRadiusMeters || distanceToSeedMeters >= nearestDistanceMeters) {
      continue;
    }

    nearestCluster = cluster;
    nearestDistanceMeters = distanceToSeedMeters;
  }

  return nearestCluster;
}

/**
 * ネイティブMapに渡しても扱いやすい短いクラスタIDを作る。
 *
 * @param cluster - ID化するクラスタ。
 * @param index - クラスタ配列内の位置。
 * @returns 短いクラスタID。
 */
function createClusterId(cluster: MutablePhotoCluster, index: number): string {
  return `cluster-${index}-${cluster.seed.id}-${cluster.photos.length}`;
}
