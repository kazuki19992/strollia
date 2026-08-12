import { useMemo, useRef } from 'react';
import type { Region } from 'react-native-maps';

import { clusterMapPhotosByRadius, getStablePhotoClusterRadiusMeters } from '@/features/photos/photoClusters';
import type { MapPhotoCluster } from '@/features/photos/photoClusters';
import type { MapPhoto } from '@/features/photos/photoLibrary';

/**
 * 表示範囲に応じた写真クラスタを、パン時の再計算を避けつつ算出する。
 *
 * クラスタ結果は「写真一覧」と「クラスタ半径」だけで決まり、地図の中心座標には依存しない。
 * そして半径は `latitudeDelta` から段階選択される(`getStablePhotoClusterRadiusMeters`)。
 * したがって表示範囲オブジェクトをそのまま依存配列に入れると、結果が同一になるパン
 * (中心移動のみ)でも O(N) のクラスタリングが走ってしまう。
 *
 * これを避けるため、半径の算出(O(1))とクラスタリング(写真数に対して重い)を
 * 別々の `useMemo` に分け、重い側は数値の半径だけに依存させている。
 * この2段構成が本フックの存在理由であり、1つの `useMemo` に戻してはいけない。
 *
 * 半径算出には段階境界のちらつき・パン時のメモ化ミスを防ぐヒステリシスがかかっており、
 * 直前の半径を `previousRadiusRef` で保持して次回の算出へ渡す。「前回値をrefに保持して
 * 次回計算へ渡す」という考え方自体は useVisitedGridOverlay.ts の visitedGridDisplayCellSizeRef
 * と共通だが、あちらは `useEffect` 内でrefを更新するのに対し、本フックは `useMemo` 内で更新する。
 * これが安全なのは `getStablePhotoClusterRadiusMeters` が自身の出力を前回値として再入力しても
 * 同じ結果を返す(冪等)ためで、StrictModeや破棄されたレンダーによる二重実行があってもrefが
 * 新規レンダーの計算結果とズレない。
 *
 * @param photos - 地図上に表示するジオタグ付き写真一覧。
 * @param visibleRegion - 現在の地図表示範囲。未取得の場合は近距離用の既定値が使われる。
 * @returns 近接写真をまとめたクラスタ一覧。
 */
export function usePhotoClusters(photos: MapPhoto[], visibleRegion: Region | null): MapPhotoCluster[] {
  const previousRadiusRef = useRef<number | null>(null);

  const clusterRadiusMeters = useMemo(() => {
    const stableRadius = getStablePhotoClusterRadiusMeters(visibleRegion, previousRadiusRef.current);
    previousRadiusRef.current = stableRadius;
    return stableRadius;
  }, [visibleRegion]);

  return useMemo(() => clusterMapPhotosByRadius(photos, clusterRadiusMeters), [photos, clusterRadiusMeters]);
}
