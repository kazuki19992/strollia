import { isPhotoAssetAvailableAsync } from '@modules/photo-thumbnail';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { MapPhoto } from '@/features/photos/photoLibrary';

/**
 * 写真の画像を表示できない理由。
 *
 * **区別しないと誤案内になる。** 「削除された」は再読み込みで解決するが、「iCloudにあり端末に本体が無い」は
 * 再読み込みでは解決しない。オフラインのユーザーへ「削除されています」と出さないために分ける(設計書 §4.5)。
 *
 * 出し方も分ける。削除済みはモーダルで止めるが、取得不可は拡大表示の中の控えめな案内にする。
 * 未ダウンロードの写真を開くたびにモーダルが出ると操作の邪魔になるためである。
 */
export type PhotoUnavailableReason =
  /** 写真ライブラリから削除されたと確認できた。 */
  | 'deleted'
  /** アセットは存在するが高解像度を取得できない(iCloud未ダウンロードなど)。 */
  | 'unavailable';

/** `usePhotoUnavailableReason` の引数。 */
export type UsePhotoUnavailableReasonParams = {
  /** 拡大表示中の写真。閉じている場合はnull。 */
  photo: MapPhoto | null;
  /**
   * 高解像度を取得できているかどうか。
   *
   * サムネイルの有無ではなくこちらを見る。拡大表示はサムネイルへフォールバックするため、
   * 「何かが映っている」ことを条件にすると端末未ダウンロードの写真を検知できない。
   */
  hasHighResolutionPreview: boolean;
  /** 高解像度の取得中かどうか。 */
  isLoadingPreview: boolean;
};

/** 写真を表示できない理由の状態と操作。 */
export type PhotoUnavailableReasonState = {
  /** 案内すべき理由。案内不要な場合はnull。 */
  photoUnavailableReason: PhotoUnavailableReason | null;
  /** 削除済み写真のモーダルを閉じる。同じ写真では再表示しない。 */
  dismissPhotoDeletedDialog: () => void;
};

/**
 * 拡大表示で高解像度を出せなかったときに、その理由を存在確認で切り分ける。
 *
 * 判定するのは「拡大表示を開いていて」「高解像度の取得を実際に試みたあとで」「それでも高解像度が無い」ときである。
 * **サムネイルが出ているかどうかは条件に含めない。** サムネイルは残っていても本体が端末に無い
 * (iCloud未ダウンロード)状況こそ案内したい対象で、これを除外すると案内が一切出なくなる。
 *
 * **「取得を試みたか」を見るのは競合状態を避けるためで、必須である(実機の機内モードで再現した不具合)。**
 * 写真を開いた最初のコミットでは `usePhotoPreviewUri` の `isLoadingPreview` はまだ初期値の false で、
 * その effect(`setIsLoadingPreview(true)`)は同じコミットのあとに走る。そのため `!isLoadingPreview` だけを
 * 条件にすると、判定材料が揃う前の最初のコミットで存在確認を撃ってしまう。直後に `isLoadingPreview` が
 * true へ変わって effect が再実行され、クリーンアップでその確認結果が破棄される。取得が終わって
 * false に戻っても「確認済み」の記録が残っているため二度と確認されず、案内が永久に出なくなる。
 * `usePhotoMapClusterDiagnostics` と同じく「一度でも取得中を観測したか」を ref で覚えて回避する。
 * あわせて、破棄された確認は「確認済み」として残さず、再確認できる状態へ戻す。
 *
 * 存在確認は `PHAsset.fetchAssets(withLocalIdentifiers:)` の結果を見るだけで、画像のI/Oもデコードも伴わない。
 * **判定できない場合は必ず「取得不可」へ倒す。** `isPhotoAssetAvailableAsync` はモジュール未解決時に
 * true を返す設計で、ここでも例外は削除と扱わない。断定的な案内は削除が確認できたときだけにする。
 *
 * @param params - 拡大表示中の写真と、その取得状況。
 * @returns 案内すべき理由と、モーダルを閉じる関数。
 */
export function usePhotoUnavailableReason({
  photo,
  hasHighResolutionPreview,
  isLoadingPreview,
}: UsePhotoUnavailableReasonParams): PhotoUnavailableReasonState {
  const [photoUnavailableReason, setPhotoUnavailableReason] = useState<PhotoUnavailableReason | null>(null);
  /**
   * すでに存在確認を行った(または閉じられた)写真のアセットID。
   *
   * 拡大表示は再レンダーのたびに同じ条件を満たすため、記録しておかないと存在確認を撃ち続ける。
   * 閉じたときにも記録を残すことで、同じ写真で案内が復活しないようにする。
   */
  const checkedAssetIdRef = useRef<string | null>(null);
  /**
   * 現在の写真について、高解像度の取得中を一度でも観測したか。
   *
   * 写真を開いた最初のコミットでは `isLoadingPreview` がまだ false のため、これが無いと
   * 「取得を試みる前」と「取得に失敗したあと」を区別できない(JSDoc本文の競合状態を参照)。
   */
  const hasObservedLoadingRef = useRef(false);
  /** `hasObservedLoadingRef` がどの写真についての観測かを示すアセットID。写真の切り替えで観測を捨てるために持つ。 */
  const observedAssetIdRef = useRef<string | null>(null);

  const assetId = photo?.id ?? null;
  const storedUri = photo?.storedUri ?? null;

  useEffect(() => {
    if (assetId === null) {
      checkedAssetIdRef.current = null;
      hasObservedLoadingRef.current = false;
      observedAssetIdRef.current = null;
      setPhotoUnavailableReason(null);
      return;
    }

    // 別の写真へ切り替わったら、前の写真についての観測は判定材料にならないので捨てる
    if (observedAssetIdRef.current !== assetId) {
      observedAssetIdRef.current = assetId;
      hasObservedLoadingRef.current = false;
    }

    if (isLoadingPreview) {
      hasObservedLoadingRef.current = true;
      return;
    }

    // 取得中を一度も観測していない = まだ取得を試みる前。高解像度が無いのは結果ではないので判定しない
    if (!hasObservedLoadingRef.current) {
      return;
    }

    // 高解像度を出せている場合は判定しない(storedUriは存在確認に必須)
    if (hasHighResolutionPreview || storedUri === null) {
      return;
    }

    if (checkedAssetIdRef.current === assetId) {
      return;
    }

    checkedAssetIdRef.current = assetId;
    // 別の写真へ切り替わったあとに前の写真の結果で案内を出さないためのフラグ
    let isActive = true;
    /** 存在確認が決着したか。破棄された確認を「確認済み」として残さないための判定に使う。 */
    let isSettled = false;

    isPhotoAssetAvailableAsync(storedUri)
      .then((isAvailable) => {
        isSettled = true;

        if (isActive) {
          setPhotoUnavailableReason(isAvailable ? 'unavailable' : 'deleted');
        }
      })
      .catch((error: unknown) => {
        // 確認できないことを「削除された」と読み替えない(誤情報を出さない方が安全)
        console.warn('Failed to check photo asset availability:', error);
        isSettled = true;

        if (isActive) {
          setPhotoUnavailableReason('unavailable');
        }
      });

    return () => {
      isActive = false;

      // 決着前に破棄された確認は結果を反映できない。記録を戻さないと同じ写真を二度と確認できなくなる
      if (!isSettled && checkedAssetIdRef.current === assetId) {
        checkedAssetIdRef.current = null;
      }
    };
  }, [assetId, hasHighResolutionPreview, isLoadingPreview, storedUri]);

  const dismissPhotoDeletedDialog = useCallback((): void => {
    setPhotoUnavailableReason(null);
  }, []);

  return { photoUnavailableReason, dismissPhotoDeletedDialog };
}
