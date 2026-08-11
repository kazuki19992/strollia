import { useMemo } from 'react';
import type { Region } from 'react-native-maps';

import { clusterMapPhotosByRadius, getPhotoClusterRadiusMeters } from '@/features/photos/photoClusters';
import type { MapPhotoCluster } from '@/features/photos/photoClusters';
import type { MapPhoto } from '@/features/photos/photoLibrary';

/**
 * 表示範囲に応じた写真クラスタを、パン時の再計算を避けつつ算出する。
 *
 * クラスタ結果は「写真一覧」と「クラスタ半径」だけで決まり、地図の中心座標には依存しない。
 * そして半径は `latitudeDelta` のみから決まる。したがって表示範囲オブジェクトをそのまま
 * 依存配列に入れると、結果が同一になるパン(中心移動のみ)でも O(N^2) のクラスタリングが
 * 走ってしまう。
 *
 * これを避けるため、半径の算出(O(1))とクラスタリング(写真数に対して重い)を
 * 別々の `useMemo` に分け、重い側は数値の半径だけに依存させている。
 * この2段構成が本フックの存在理由であり、1つの `useMemo` に戻してはいけない。
 *
 * @param photos - 地図上に表示するジオタグ付き写真一覧。
 * @param visibleRegion - 現在の地図表示範囲。未取得の場合は近距離用の既定値が使われる。
 * @returns 近接写真をまとめたクラスタ一覧。
 */
export function usePhotoClusters(photos: MapPhoto[], visibleRegion: Region | null): MapPhotoCluster[] {
  const clusterRadiusMeters = useMemo(() => getPhotoClusterRadiusMeters(visibleRegion), [visibleRegion]);

  return useMemo(() => clusterMapPhotosByRadius(photos, clusterRadiusMeters), [photos, clusterRadiusMeters]);
}
