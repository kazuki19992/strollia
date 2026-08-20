import { useEffect, useRef } from 'react';

import { reportPhotoMapDiagnostics } from '@/config/sentry';
import type { MapPhotoCluster } from '@/features/photos/photoClusters';
import type { MapPhoto } from '@/features/photos/photoLibrary';

/** `usePhotoMapClusterDiagnostics` フックの引数。 */
export type UsePhotoMapClusterDiagnosticsParams = {
  /** 写真表示が有効かどうか。false の間は送信しない。 */
  enabled: boolean;
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
 * 送信条件は「`photos` の参照が前回送信時から変わったとき」だけ。ズーム変更でクラスタ半径のみが
 * 変わるケースまで送るとイベント数が膨らむため、写真一覧の更新を送信の起点にしている。
 * `enabled` が false になったら記録をクリアし、再度 ON にしたときにまた送れるようにする。
 *
 * @param params - 有効フラグ・写真一覧・クラスタ一覧。
 */
export function usePhotoMapClusterDiagnostics({ enabled, photos, clusters }: UsePhotoMapClusterDiagnosticsParams): void {
  /** 直近で送信した写真一覧の参照。同一参照の再レンダーでは再送しないために保持する。 */
  const lastReportedPhotosRef = useRef<MapPhoto[] | null>(null);

  useEffect(() => {
    if (!enabled) {
      lastReportedPhotosRef.current = null;
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
  }, [clusters, enabled, photos]);
}
