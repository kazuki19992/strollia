import { Region } from 'react-native-maps';

import { MapPhoto } from './photoLibrary';
import { distanceMeters } from '@/utils/distance';

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

/** クラスタ詳細で1ページに表示する写真枚数。 */
export const PHOTO_CLUSTER_PAGE_SIZE = 9;

const FALLBACK_LATITUDE_DELTA = 0.01;

/** 写真クラスタ半径の1段階。 */
type PhotoClusterRadiusStage = {
  /** この段階で使う半径メートル。 */
  radiusMeters: number;
  /** この段階を使う latitudeDelta の上限(この値未満まで)。 */
  maxLatitudeDelta: number;
};

/**
 * 写真クラスタ半径の段階テーブル。連続値だった半径を離散段階へ丸めることで、
 * Web Mercator投影の緯度歪みによりパン時にlatitudeDeltaがbit単位で変化しても
 * メモ化(usePhotoClusters)がヒットしやすくなる。境界は旧来の連続式
 * (radius = latitudeDelta × METERS_PER_LATITUDE_DEGREE × REGION_CLUSTER_RATIO)の
 * 傾きに沿って選んでいるため、量子化以外の挙動変化を最小にしている。
 */
const PHOTO_CLUSTER_RADIUS_STAGES: PhotoClusterRadiusStage[] = [
  { radiusMeters: 10, maxLatitudeDelta: 0.003 },
  { radiusMeters: 30, maxLatitudeDelta: 0.009 },
  { radiusMeters: 75, maxLatitudeDelta: 0.0225 },
  { radiusMeters: 150, maxLatitudeDelta: 0.045 },
  { radiusMeters: 300, maxLatitudeDelta: 0.09 },
  { radiusMeters: 750, maxLatitudeDelta: 0.225 },
  { radiusMeters: 1500, maxLatitudeDelta: 0.45 },
  { radiusMeters: 3000, maxLatitudeDelta: 0.9 },
  { radiusMeters: 7500, maxLatitudeDelta: 2.25 },
  { radiusMeters: 15000, maxLatitudeDelta: 4.5 },
];

/**
 * 段階テーブルを超える広域表示(latitudeDelta >= 4.5)で使うフォールバック半径。
 * 世界地図相当の大きさにすることで、地図が表現できる現実的な範囲内では
 * 実質「上限なし」だった旧来の挙動と区別がつかないようにする。
 */
const PHOTO_CLUSTER_RADIUS_WORLD_FALLBACK_METERS = 3_000_000;

/** 段階境界のちらつき防止に使うヒステリシス比率。visited grid(GRID_OVERLAY_CONFIG)と同じ値を踏襲する。 */
const PHOTO_CLUSTER_RADIUS_HYSTERESIS_RATIO = 0.2;

/**
 * 表示範囲の広さから写真クラスタ半径の段階indexを選ぶ。
 *
 * @param latitudeDelta - 絶対値化済みのlatitudeDelta。
 * @returns 0始まりの段階index。定義済み範囲より広い場合は段階数(=フォールバックを示す)。
 */
function getPhotoClusterRadiusStageIndex(latitudeDelta: number): number {
  const stageIndex = PHOTO_CLUSTER_RADIUS_STAGES.findIndex((stage) => latitudeDelta < stage.maxLatitudeDelta);

  return stageIndex >= 0 ? stageIndex : PHOTO_CLUSTER_RADIUS_STAGES.length;
}

type MutablePhotoCluster = {
  seed: MapPhoto;
  photos: MapPhoto[];
};

/**
 * 表示範囲に応じて、同じ地点付近の写真だけをメートル距離ベースでまとめる。
 *
 * `clusterMapPhotosByRadius` に表示範囲から求めた半径を渡すだけの薄いラッパー。
 * 呼び出し側が半径を自前で保持してメモ化できるよう、半径計算とクラスタリングを分離している。
 *
 * @param photos - 地図上に表示するジオタグ付き写真一覧。
 * @param region - 現在の地図表示範囲。未取得の場合は近距離用の既定値を使う。
 * @returns 近接写真をまとめたクラスタ一覧。
 */
export function clusterMapPhotos(photos: MapPhoto[], region: Region | null): MapPhotoCluster[] {
  return clusterMapPhotosByRadius(photos, getPhotoClusterRadiusMeters(region));
}

/**
 * 指定した半径で、同じ地点付近の写真をメートル距離ベースでまとめる。
 *
 * クラスタ結果は「写真一覧」と「半径」だけで決まり、地図の中心座標には依存しない。
 * 表示範囲オブジェクトではなく半径を引数に取ることで、パン(中心移動のみ)では
 * 呼び出し側の `useMemo` が再計算をスキップできる。
 *
 * @param photos - 地図上に表示するジオタグ付き写真一覧。
 * @param clusterRadiusMeters - 同一クラスタとして扱う半径メートル。
 * @returns 近接写真をまとめたクラスタ一覧。
 */
export function clusterMapPhotosByRadius(photos: MapPhoto[], clusterRadiusMeters: number): MapPhotoCluster[] {
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
 * クラスタ内写真を横スワイプ表示用にページ分割する。
 *
 * @param photos - ページ分割する写真一覧。
 * @param pageSize - 1ページあたりの写真枚数。
 * @returns ページごとの写真配列。
 */
export function paginateMapPhotos(photos: MapPhoto[], pageSize = PHOTO_CLUSTER_PAGE_SIZE): MapPhoto[][] {
  if (pageSize <= 0) {
    return [];
  }

  const pages: MapPhoto[][] = [];

  for (let index = 0; index < photos.length; index += pageSize) {
    pages.push(photos.slice(index, index + pageSize));
  }

  return pages;
}

/**
 * 地図の表示範囲から写真クラスタ半径をメートル単位で求める(段階選択のみ、ヒステリシスなし)。
 *
 * @param region - 現在の地図表示範囲。未取得の場合は近距離用の既定値を使う。
 * @returns 段階選択されたクラスタ半径メートル。
 */
export function getPhotoClusterRadiusMeters(region: Region | null): number {
  const latitudeDelta = Math.abs(region?.latitudeDelta ?? FALLBACK_LATITUDE_DELTA);
  const stageIndex = getPhotoClusterRadiusStageIndex(latitudeDelta);

  return stageIndex < PHOTO_CLUSTER_RADIUS_STAGES.length
    ? PHOTO_CLUSTER_RADIUS_STAGES[stageIndex].radiusMeters
    : PHOTO_CLUSTER_RADIUS_WORLD_FALLBACK_METERS;
}

/**
 * 表示セルサイズの切替境界付近で直前の半径を維持し、ズーム操作中のちらつきと
 * パン時のメモ化ミスを抑える。gridAggregation.ts の getStableDisplayCellSizeMeters と
 * 同じヒステリシスパターンだが、写真クラスタ専用の段階テーブル・比率を使う。
 *
 * @param region - 現在の地図表示範囲。
 * @param previousRadiusMeters - 直前に使った半径。初回は null。
 * @returns ヒステリシスを加味した半径メートル。
 */
export function getStablePhotoClusterRadiusMeters(region: Region | null, previousRadiusMeters: number | null): number {
  const nextRadiusMeters = getPhotoClusterRadiusMeters(region);

  if (!previousRadiusMeters || previousRadiusMeters === nextRadiusMeters) {
    return nextRadiusMeters;
  }

  const radiusValues = [...PHOTO_CLUSTER_RADIUS_STAGES.map((stage) => stage.radiusMeters), PHOTO_CLUSTER_RADIUS_WORLD_FALLBACK_METERS];
  const previousIndex = radiusValues.indexOf(previousRadiusMeters);
  const nextIndex = radiusValues.indexOf(nextRadiusMeters);

  if (previousIndex < 0 || nextIndex < 0 || Math.abs(previousIndex - nextIndex) > 1) {
    return nextRadiusMeters;
  }

  const boundary = PHOTO_CLUSTER_RADIUS_STAGES[Math.min(previousIndex, nextIndex)]?.maxLatitudeDelta;

  if (!boundary) {
    return nextRadiusMeters;
  }

  const latitudeDelta = Math.abs(region?.latitudeDelta ?? FALLBACK_LATITUDE_DELTA);

  if (nextIndex > previousIndex && latitudeDelta < boundary * (1 + PHOTO_CLUSTER_RADIUS_HYSTERESIS_RATIO)) {
    return previousRadiusMeters;
  }

  if (nextIndex < previousIndex && latitudeDelta >= boundary * (1 - PHOTO_CLUSTER_RADIUS_HYSTERESIS_RATIO)) {
    return previousRadiusMeters;
  }

  return nextRadiusMeters;
}

/**
 * 写真を追加できる最寄りクラスタを探す。クラスタの代表写真との距離だけを見ることで、連鎖的な巨大クラスタ化を防ぐ。
 *
 * @param photo - 追加候補の写真。
 * @param clusters - 既存クラスタ一覧。
 * @param clusterRadiusMeters - 同一クラスタとして扱う半径メートル。
 * @returns 同一表示クラスタとして扱える最寄りクラスタ。見つからない場合はnull。
 */
function findNearestCluster(photo: MapPhoto, clusters: MutablePhotoCluster[], clusterRadiusMeters: number): MutablePhotoCluster | null {
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
