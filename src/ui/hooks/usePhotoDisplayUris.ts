import { useCallback, useRef, useState } from 'react';

import { clearPhotoDisplayUriCache, resolvePhotoDisplayUriMap } from '@/features/photos/photoDisplayUri';
import type { MapPhoto } from '@/features/photos/photoLibrary';

/** 写真の表示用URI解決の状態と操作。 */
export type PhotoDisplayUriState = {
  /** アセットID → 表示用URI。解決できなかった写真の値はnull。 */
  resolvedPhotoUris: ReadonlyMap<string, string | null>;
  /** 指定した写真の表示用URIを解決する。まだ問い合わせていない写真だけを対象にする。 */
  requestPhotoDisplayUris: (photos: readonly MapPhoto[]) => void;
  /** 解決結果とサムネイルのメモリキャッシュを捨てる。 */
  resetPhotoDisplayUris: () => void;
};

/**
 * 地図に実際に出る写真だけ、表示用URIを解決して保持する。
 *
 * ビューポート検索の結果は全件が未解決(`uri: null`)で返る。解決には1枚ごとにサムネイルの書き出しが
 * 伴うため、地図に画像として出る**クラスタの代表写真**と、**ユーザーが開いたクラスタの写真**だけを
 * 呼び出し側が要求する(設計書 §4.8)。
 *
 * 解決できなかった写真は「要求済み」として記録しない。iCloudから本体がまだ落ちてきていない等の
 * 一時的な失敗が多く、`resolvePhotoDisplayUri` 側も失敗をキャッシュしないため、次の機会に
 * 再試行できるようにしておく。
 *
 * @returns 解決済みURIの対応表、解決の要求関数、リセット関数。
 */
export function usePhotoDisplayUris(): PhotoDisplayUriState {
  const [resolvedPhotoUris, setResolvedPhotoUris] = useState<ReadonlyMap<string, string | null>>(() => new Map());
  /**
   * すでに解決を問い合わせたアセットID。
   *
   * 同じ写真の解決を地図のパン・ズームのたびに投げ直さないための重複除去。stateではなくrefなのは、
   * 「問い合わせたかどうか」は描画に影響しない実行時の記録であり、更新で再レンダーする必要がないため。
   */
  const requestedAssetIdsRef = useRef<Set<string>>(new Set());

  const requestPhotoDisplayUris = useCallback((photos: readonly MapPhoto[]): void => {
    const pendingPhotos = photos.filter((photo) => photo.uri === null && !requestedAssetIdsRef.current.has(photo.id));

    if (pendingPhotos.length === 0) {
      return;
    }

    for (const photo of pendingPhotos) {
      requestedAssetIdsRef.current.add(photo.id);
    }

    resolvePhotoDisplayUriMap(pendingPhotos)
      .then((resolved) => {
        for (const [assetId, uri] of resolved) {
          // 解決失敗は一時的なことが多いので記録を消し、次の要求で再試行させる
          if (uri === null) {
            requestedAssetIdsRef.current.delete(assetId);
          }
        }

        setResolvedPhotoUris((previous) => new Map([...previous, ...resolved]));
      })
      .catch((error: unknown) => {
        // 解決できないこと自体は表示を止める理由にならない(画像なしのマーカーとして描ける)
        console.warn('Failed to resolve photo display uris:', error);

        for (const photo of pendingPhotos) {
          requestedAssetIdsRef.current.delete(photo.id);
        }
      });
  }, []);

  const resetPhotoDisplayUris = useCallback((): void => {
    requestedAssetIdsRef.current = new Set();
    setResolvedPhotoUris(new Map());
    // 削除された写真の古いサムネイルを表示し続けないよう、モジュール側のキャッシュも捨てる
    clearPhotoDisplayUriCache();
  }, []);

  return { resolvedPhotoUris, requestPhotoDisplayUris, resetPhotoDisplayUris };
}
