import { isPhotoAssetAvailableAsync } from '@modules/photo-thumbnail';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { MapPhoto } from '@/features/photos/photoLibrary';

/**
 * 写真の画像を表示できない理由。
 *
 * **区別しないと誤案内になる。** 「削除された」は再読み込みで解決するが、「iCloudにあり端末に本体が無い」は
 * 再読み込みでは解決しない。オフラインのユーザーへ「削除されています」と出さないために分ける(設計書 §4.5)。
 */
export type PhotoUnavailableReason =
  /** 写真ライブラリから削除されたと確認できた。 */
  | 'deleted'
  /** アセットは存在するが画像を取得できない(iCloud未ダウンロードなど)。 */
  | 'unavailable';

/** `usePhotoUnavailableReason` の引数。 */
export type UsePhotoUnavailableReasonParams = {
  /** 拡大表示中の写真。閉じている場合はnull。 */
  photo: MapPhoto | null;
  /** 拡大表示に使えるURI。何も表示できない場合はnull。 */
  previewUri: string | null;
  /** 高解像度の取得中かどうか。 */
  isLoadingPreview: boolean;
};

/** 写真を表示できない理由の状態と操作。 */
export type PhotoUnavailableReasonState = {
  /** 案内すべき理由。案内不要な場合はnull。 */
  photoUnavailableReason: PhotoUnavailableReason | null;
  /** 案内を閉じる。同じ写真では再表示しない。 */
  dismissPhotoUnavailableDialog: () => void;
};

/**
 * 拡大表示で画像を出せなかったときに、その理由を存在確認で切り分ける。
 *
 * 判定するのは「拡大表示を開いていて」「取得が終わっていて」「それでも表示できるURIが無い」ときだけである。
 * サムネイルすら出ていない写真をユーザーが開いた時点が、削除に気づける最初のタイミングになる。
 *
 * 存在確認は `PHAsset.fetchAssets(withLocalIdentifiers:)` の結果を見るだけで、画像のI/Oもデコードも伴わない。
 * **判定できない場合は必ず「取得不可」へ倒す。** `isPhotoAssetAvailableAsync` はモジュール未解決時に
 * true を返す設計で、ここでも例外は削除と扱わない。断定的な案内は削除が確認できたときだけにする。
 *
 * @param params - 拡大表示中の写真と、その取得状況。
 * @returns 案内すべき理由と、案内を閉じる関数。
 */
export function usePhotoUnavailableReason({
  photo,
  previewUri,
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

  const assetId = photo?.id ?? null;
  const storedUri = photo?.storedUri ?? null;

  useEffect(() => {
    if (assetId === null) {
      checkedAssetIdRef.current = null;
      setPhotoUnavailableReason(null);
      return;
    }

    // 取得中と、表示できる画像がある場合は判定しない
    if (isLoadingPreview || previewUri !== null || storedUri === null) {
      return;
    }

    if (checkedAssetIdRef.current === assetId) {
      return;
    }

    checkedAssetIdRef.current = assetId;
    // 別の写真へ切り替わったあとに前の写真の結果で案内を出さないためのフラグ
    let isActive = true;

    isPhotoAssetAvailableAsync(storedUri)
      .then((isAvailable) => {
        if (isActive) {
          setPhotoUnavailableReason(isAvailable ? 'unavailable' : 'deleted');
        }
      })
      .catch((error: unknown) => {
        // 確認できないことを「削除された」と読み替えない(誤情報を出さない方が安全)
        console.warn('Failed to check photo asset availability:', error);

        if (isActive) {
          setPhotoUnavailableReason('unavailable');
        }
      });

    return () => {
      isActive = false;
    };
  }, [assetId, isLoadingPreview, previewUri, storedUri]);

  const dismissPhotoUnavailableDialog = useCallback((): void => {
    setPhotoUnavailableReason(null);
  }, []);

  return { photoUnavailableReason, dismissPhotoUnavailableDialog };
}
