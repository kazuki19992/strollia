import { useEffect, useRef } from 'react';

import { reportPhotoMapDiagnostics } from '@/config/sentry';
import type { MapPhotoCluster } from '@/features/photos/photoClusters';
import type { MapPhoto } from '@/features/photos/photoLibrary';

/** `usePhotoMapClusterDiagnostics` フックの引数。 */
export type UsePhotoMapClusterDiagnosticsParams = {
  /** 写真表示が有効かどうか。false の間は送信しない。 */
  enabled: boolean;
  /** 写真読み込み中かどうか。読み込みが完了した後の結果だけを送るために使う。 */
  isLoadingPhotos: boolean;
  /** 読み込み済みのジオタグ付き写真一覧。 */
  photos: MapPhoto[];
  /** クラスタリング結果。 */
  clusters: MapPhotoCluster[];
};

/**
 * 写真クラスタリング結果の件数をSentryへ送る調査用フック。
 *
 * 実機でのみ再現する「写真が表示されない」不具合について、写真は読めているのに
 * クラスタが作られていないのかを切り分けるために使う。送るのは件数だけで、
 * 座標・アセットID・URIは含めない(AGENTS.md §5)。
 *
 * `usePhotoClusters` は2段の `useMemo` で構成された純粋なメモ化フックとして保つ必要があるため、
 * 副作用である計装はこの別フックへ分離している。
 *
 * 送信条件は「写真の読み込みが一度始まり、それが完了した後で `photos` の参照が前回送信時から
 * 変わったとき」だけ。ズーム変更でクラスタ半径のみが変わるケースまで送るとイベント数が膨らむため、
 * 写真一覧の更新を送信の起点にしている。
 *
 * 読み込み完了を待つのは、`usePhotoMapOverlay` の `photos` が初期値の空配列から始まり、読み込み後に
 * 新しい配列参照へ差し替わるため。待たずに送ると `enabled` が true になった最初のコミットで
 * `photoCount: 0` の偽イベントを送ってしまい、調査の判断を誤らせる。さらに `enabled` が false → true に
 * なった最初のコミットでは `isLoadingPhotos` はまだ false(`usePhotoMapOverlay` の effect はこの後に走る)
 * なので、`!isLoadingPhotos` だけでは弾けない。そのため「一度でも読み込み中を観測したか」を ref で覚える。
 *
 * `enabled` が false になったら両方の記録をクリアし、再度 ON にして読み込みが完了したときにまた送れるようにする。
 *
 * @param params - 有効フラグ・読み込み中フラグ・写真一覧・クラスタ一覧。
 */
export function usePhotoMapClusterDiagnostics({ enabled, isLoadingPhotos, photos, clusters }: UsePhotoMapClusterDiagnosticsParams): void {
  /** 直近で送信した写真一覧の参照。同一参照の再レンダーでは再送しないために保持する。 */
  const lastReportedPhotosRef = useRef<MapPhoto[] | null>(null);
  /** 今回の有効化以降に読み込み中を観測したか。読み込み前の空配列を送らないための判定に使う。 */
  const hasObservedLoadingRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      lastReportedPhotosRef.current = null;
      hasObservedLoadingRef.current = false;
      return;
    }

    if (isLoadingPhotos) {
      hasObservedLoadingRef.current = true;
      return;
    }

    // 読み込みを一度も観測していない = まだ読み込み前の初期値。結果ではないので送らない
    if (!hasObservedLoadingRef.current) {
      return;
    }

    if (lastReportedPhotosRef.current === photos) {
      return;
    }

    lastReportedPhotosRef.current = photos;
    reportPhotoMapDiagnostics('cluster', {
      photoCount: photos.length,
      clusterCount: clusters.length,
    });
  }, [clusters, enabled, isLoadingPhotos, photos]);
}
