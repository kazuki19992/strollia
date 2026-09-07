import { Region } from 'react-native-maps';

import { applyResolvedPhotoUris } from './photoDisplayUri';
import type { MapPhoto } from './photoLibrary';
import { coordinateToGridCell, getGridWorldColumnCount } from '@/features/location/grid/gridCell';
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
 * メモ化(usePhotoClusters)がヒットしやすくなる。
 *
 * **半径は「その段階の表示範囲の高さの約1割」になるようにしている。**
 * 緯度1度は約111kmなので、段階の上限 latitudeDelta と半径の比はおよそ 1:10000 である
 * (例: 0.003 → 30m。0.003 × 111,000m = 333m の表示高さに対して約9%)。
 *
 * この比率にする理由は、**「マーカーが視覚的に重なるなら、まとまる」という一貫した基準にするため**である。
 * 地図上の写真マーカーは画面上で60〜70px、画面高さ700pxに対して約10%を占める。
 * 以前は半径が表示範囲の約3%しかなく、見た目には重なっているのにまとまらない状態だった
 * (もっと縮小してようやくまとまる)。半径を3倍にして視覚サイズと基準を揃えている。
 *
 * 境界(maxLatitudeDelta)ではなく半径の側を3倍にしたのは、境界を1/3にすると
 * フォールバック(50,000m)へ移る latitudeDelta まで1/3になり、最終段階からフォールバックへの
 * 飛びが 15,000m → 50,000m と大きくなってしまうためである。半径を3倍にすれば
 * 最終段階は45,000mとなり、等価性を保証できる上限(50,000m)を超えないまま滑らかに繋がる。
 */
const PHOTO_CLUSTER_RADIUS_STAGES: PhotoClusterRadiusStage[] = [
  { radiusMeters: 30, maxLatitudeDelta: 0.003 },
  { radiusMeters: 90, maxLatitudeDelta: 0.009 },
  { radiusMeters: 225, maxLatitudeDelta: 0.0225 },
  { radiusMeters: 450, maxLatitudeDelta: 0.045 },
  { radiusMeters: 900, maxLatitudeDelta: 0.09 },
  { radiusMeters: 2250, maxLatitudeDelta: 0.225 },
  { radiusMeters: 4500, maxLatitudeDelta: 0.45 },
  { radiusMeters: 9000, maxLatitudeDelta: 0.9 },
  { radiusMeters: 22500, maxLatitudeDelta: 2.25 },
  { radiusMeters: 45000, maxLatitudeDelta: 4.5 },
];

/**
 * 段階テーブルを超える広域表示(latitudeDelta >= 4.5)で使うフォールバック半径。
 *
 * 空間ハッシュの3セル探索(CLUSTER_SEARCH_CELL_RADIUS)による正当性は、
 * Web Mercatorのスケール係数(secant(緯度))がセル内でほぼ一定であることを前提にしている。
 * セルサイズが数千kmに達すると、緯度に関わらずこの前提が崩れ、現行O(N²)実装との
 * 出力一致(等価性)が保証できなくなる(検証: 50,000mまでは緯度70度程度まで等価性を確認済み、
 * 200,000mでは崩れることを確認済み)。そのため「世界地図相当で実質無制限」という
 * 当初の意図よりは小さいが、等価性が保証できる範囲で最大の値として50,000mを採用する。
 * この段階に到達するのは極端な広域ズーム時のみで、50kmという半径でも通常の
 * クラスタリング用途では十分「広く1つにまとめる」効果がある。
 */
const PHOTO_CLUSTER_RADIUS_WORLD_FALLBACK_METERS = 50_000;

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
  /** 古い全走査実装と同じ同距離時の採用順を保つ、クラスタ作成順。 */
  creationOrder: number;
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
 * クラスタ探索でチェックする隣接セルの半径(自セルを含め (2×3+1)² = 49セル)。
 *
 * セルサイズ = クラスタ半径のため、理論上は1セル分(9セル)で「半径内の全候補」を
 * 見つけられる。しかしこの空間ハッシュは Web Mercator 座標(coordinateToGridCell)を
 * 使っており、Web Mercator は緯度が上がるほど距離を実際より引き伸ばす
 * (緯度46度で最大約1.43倍、緯度70度で約2.92倍)。1セル分の探索だと、緯度によっては
 * 本来半径内にある写真をセル境界の外に見逃す可能性がある。3セル分に広げることで
 * スケール係数3倍(緯度70度相当)まで安全に候補を拾える。49はNに対して定数なので、
 * 全体の計算量は O(N) のまま変わらない。
 */
const CLUSTER_SEARCH_CELL_RADIUS = 3;

/**
 * X番号をワールド幅で循環させた、写真クラスタ用のセルIDを作る。
 *
 * Web MercatorのX座標は日付変更線の両側で連続しないため、通常のセルIDでは
 * +180度付近と-180度付近の近接写真を別の遠いセルとして扱ってしまう。Y番号は
 * 循環しないため、そのまま使う。
 *
 * @param cellSizeMeters - セルサイズ。単位はm。
 * @param x - Web Mercator基準のXセル番号。
 * @param y - Web Mercator基準のYセル番号。
 * @param worldColumnCount - X方向のワールド全体のセル数。
 * @returns 日付変更線をまたいでも一意なクラスタ索引用セルID。
 */
function createWrappedClusterCellId(cellSizeMeters: number, x: number, y: number, worldColumnCount: number): string {
  const wrappedX = ((x % worldColumnCount) + worldColumnCount) % worldColumnCount;

  return `${cellSizeMeters}:${wrappedX}:${y}`;
}

/**
 * 写真を追加できる最寄りクラスタを、空間ハッシュで候補を絞り込んで探す。
 * クラスタの代表写真との距離だけを見ることで、連鎖的な巨大クラスタ化を防ぐ(旧実装と同じ)。
 * 索引は候補の絞り込みにのみ使い、距離判定・採用基準は旧実装から変更しない。
 *
 * @param photo - 追加候補の写真。
 * @param clustersByCellId - セルIDごとのクラスタ索引。
 * @param clusterRadiusMeters - 同一クラスタとして扱う半径メートル(= セルサイズ)。
 * @returns 同一表示クラスタとして扱える最寄りクラスタ。見つからない場合はnull。
 */
function findNearestClusterViaGrid(
  photo: MapPhoto,
  clustersByCellId: Map<string, MutablePhotoCluster[]>,
  clusterRadiusMeters: number,
  worldColumnCount: number,
): MutablePhotoCluster | null {
  const cell = coordinateToGridCell(photo, clusterRadiusMeters);
  let nearestCluster: MutablePhotoCluster | null = null;
  let nearestDistanceMeters = Number.POSITIVE_INFINITY;

  for (let dx = -CLUSTER_SEARCH_CELL_RADIUS; dx <= CLUSTER_SEARCH_CELL_RADIUS; dx += 1) {
    for (let dy = -CLUSTER_SEARCH_CELL_RADIUS; dy <= CLUSTER_SEARCH_CELL_RADIUS; dy += 1) {
      const candidates = clustersByCellId.get(createWrappedClusterCellId(clusterRadiusMeters, cell.x + dx, cell.y + dy, worldColumnCount));

      if (!candidates) {
        continue;
      }

      for (const cluster of candidates) {
        const distanceToSeedMeters = distanceMeters(photo, cluster.seed);

        if (distanceToSeedMeters > clusterRadiusMeters || distanceToSeedMeters > nearestDistanceMeters) {
          continue;
        }

        // 旧実装は作成順に全クラスタを走査し、同距離なら先に作られたクラスタを維持していた。
        if (
          distanceToSeedMeters === nearestDistanceMeters &&
          nearestCluster !== null &&
          cluster.creationOrder > nearestCluster.creationOrder
        ) {
          continue;
        }

        nearestCluster = cluster;
        nearestDistanceMeters = distanceToSeedMeters;
      }
    }
  }

  return nearestCluster;
}

/**
 * 新規クラスタの seed を空間ハッシュへ登録する。
 *
 * @param cluster - 登録するクラスタ。
 * @param clustersByCellId - セルIDごとのクラスタ索引。
 * @param clusterRadiusMeters - セルサイズとして使う半径メートル。
 */
function registerClusterCell(
  cluster: MutablePhotoCluster,
  clustersByCellId: Map<string, MutablePhotoCluster[]>,
  clusterRadiusMeters: number,
  worldColumnCount: number,
): void {
  const cell = coordinateToGridCell(cluster.seed, clusterRadiusMeters);
  const cellId = createWrappedClusterCellId(clusterRadiusMeters, cell.x, cell.y, worldColumnCount);
  const existing = clustersByCellId.get(cellId);

  if (existing) {
    existing.push(cluster);
    return;
  }

  clustersByCellId.set(cellId, [cluster]);
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
  // セルID(coordinateToGridCellの cellId 形式)→ そのセルに seed を持つクラスタ一覧。
  // 空間ハッシュとして使い、距離判定そのものは変えず候補の絞り込みにのみ使う。
  const clustersByCellId = new Map<string, MutablePhotoCluster[]>();
  const worldColumnCount = getGridWorldColumnCount(clusterRadiusMeters);

  // 新しい写真を代表サムネイルと代表座標にし、平均化で別地点へ飛ばないようにする。
  for (const photo of [...photos].sort((a, b) => b.creationTime - a.creationTime)) {
    const nearestCluster = findNearestClusterViaGrid(photo, clustersByCellId, clusterRadiusMeters, worldColumnCount);

    if (!nearestCluster) {
      const newCluster: MutablePhotoCluster = { creationOrder: clusters.length, seed: photo, photos: [photo] };
      clusters.push(newCluster);
      registerClusterCell(newCluster, clustersByCellId, clusterRadiusMeters, worldColumnCount);
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
 * 各クラスタの代表写真(先頭)だけを取り出す。
 *
 * 地図に画像として出るのはクラスタの代表1枚だけである。表示用URIの解決対象をここへ絞ることで、
 * 解決回数が「画面上のマーカー数」に比例するようになり、ライブラリが何万枚あっても
 * 表示コストがほぼ一定になる(設計書 §4.8)。
 *
 * @param clusters - 地図上のクラスタ一覧。
 * @returns 各クラスタの代表写真。写真を持たないクラスタは含まない。
 */
export function getPhotoClusterRepresentativePhotos(clusters: readonly MapPhotoCluster[]): MapPhoto[] {
  return clusters.flatMap((cluster) => (cluster.photos.length > 0 ? [cluster.photos[0]] : []));
}

/**
 * 解決済みの表示用URIをクラスタ内の写真へ反映する。
 *
 * クラスタのID・座標は変えない。マーカーの位置とまとまり方は解決前後で同じであるべきで、
 * ここが変わるとネイティブ地図側のマーカーが作り直されてしまう。
 *
 * 反映する対応が無いときは**入力配列の参照をそのまま返す**。写真が差し替わったクラスタだけを
 * 作り直し、変わらないクラスタは参照ごと保つ。クラスタは参照の同一性でメモ化しているため、
 * 内容が変わらないのに新しいオブジェクトを作ると不要な再描画を招く。
 *
 * 解決結果が空でなくても、現在のクラスタに一致する写真が1枚も無いことはある(非同期の解決中に
 * 地図を動かした場合)。件数ではなく、実際に差し替わったかどうかで判定する。
 *
 * @param clusters - 反映対象のクラスタ一覧。
 * @param resolvedUris - アセットID → 表示用URI の対応。
 * @returns 表示用URIを反映したクラスタ一覧。反映する対応が無い場合は入力そのもの。
 */
export function applyResolvedPhotoUrisToClusters(
  clusters: readonly MapPhotoCluster[],
  resolvedUris: ReadonlyMap<string, string | null>,
): MapPhotoCluster[] {
  if (resolvedUris.size === 0) {
    return clusters as MapPhotoCluster[];
  }

  let hasAppliedUri = false;
  const appliedClusters = clusters.map((cluster) => {
    const appliedPhotos = applyResolvedPhotoUris(cluster.photos, resolvedUris);

    // `applyResolvedPhotoUris` は差し替えが無ければ入力の参照を返す。参照比較で変化を見分けられる
    if (appliedPhotos === cluster.photos) {
      return cluster;
    }

    hasAppliedUri = true;

    return { ...cluster, photos: appliedPhotos };
  });

  return hasAppliedUri ? appliedClusters : (clusters as MapPhotoCluster[]);
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
 * ネイティブMapに渡しても扱いやすい短いクラスタIDを作る。
 *
 * @param cluster - ID化するクラスタ。
 * @param index - クラスタ配列内の位置。
 * @returns 短いクラスタID。
 */
function createClusterId(cluster: MutablePhotoCluster, index: number): string {
  return `cluster-${index}-${cluster.seed.id}-${cluster.photos.length}`;
}
