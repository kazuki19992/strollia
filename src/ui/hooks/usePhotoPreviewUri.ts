import { useEffect, useState } from 'react';

import { MapPhoto } from '@/features/photos/photoLibrary';
import { resolvePhotoPreviewUri } from '@/features/photos/photoPreviewUri';

/** 拡大表示に使うURIと、その取得状況。 */
export type PhotoPreviewUriState = {
  /** 拡大表示に使うURI。高解像度が未取得・取得失敗の間は手元のサムネイルを返す。 */
  previewUri: string | null;
  /** 高解像度の取得中かどうか。iCloudからのダウンロードは数秒かかりうるため、待機表示に使う。 */
  isLoadingPreview: boolean;
};

/**
 * 拡大表示中の写真について、高解像度画像を取得して差し替える。
 *
 * **開いた瞬間はすでに手元にあるサムネイルを返す。** 高解像度の取得を待ってから表示すると、
 * iCloudからのダウンロード(数秒かかりうる)のあいだ何も出せず、タップの反応が無いように見えるため。
 * 取得できたら高解像度へ差し替え、取得できなければサムネイルのまま据え置く
 * (機内モード・オフラインでは取得できないのが正常な結果であり、エラー表示や黒画面にはしない)。
 *
 * 端末APIへの問い合わせは `resolvePhotoPreviewUri` に閉じている。**この経路だけ iCloud からの
 * ダウンロードを許可している**点は `photoPreviewUri.ts` を参照。
 *
 * @param photo - 拡大表示中の写真。閉じている場合はnull。
 * @returns 拡大表示に使うURIと取得状況。
 */
export function usePhotoPreviewUri(photo: MapPhoto | null): PhotoPreviewUriState {
  /**
   * 取得済みの高解像度URIを、それが「どの写真のものか」と対で保持する。
   *
   * URIだけを持つと、写真を切り替えたレンダーで前の写真のURIを返してしまう。
   * `useEffect` はコミット後に走るため、リセットが間に合わずその1フレームが描画されうる。
   * assetId と対で持ち、現在の写真と一致するときだけ使うことで構造的に防ぐ。
   */
  const [highResolution, setHighResolution] = useState<{ assetId: string; uri: string } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const assetId = photo?.id ?? null;

  useEffect(() => {
    if (assetId === null) {
      setHighResolution(null);
      setIsLoadingPreview(false);
      return;
    }

    // 別の写真へ切り替わったあとに前の写真の結果が届いても反映しないためのフラグ。
    // 拡大表示は写真をまたいで使い回されるため、遅れて届いた結果で上書きすると別の写真が出てしまう
    let isActive = true;
    setHighResolution(null);
    setIsLoadingPreview(true);

    resolvePhotoPreviewUri(assetId)
      .then((resolvedUri) => {
        if (isActive) {
          setHighResolution(resolvedUri === null ? null : { assetId, uri: resolvedUri });
          setIsLoadingPreview(false);
        }
      })
      .catch((error: unknown) => {
        // 取得できないこと自体は想定内。サムネイル表示のまま据え置く
        console.warn('Failed to resolve photo preview uri:', error);

        if (isActive) {
          setIsLoadingPreview(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [assetId]);

  // 保持している高解像度が現在の写真のものでなければ使わない(切替直後の1フレーム対策)
  const currentHighResolutionUri = highResolution !== null && highResolution.assetId === assetId ? highResolution.uri : null;

  return { previewUri: currentHighResolutionUri ?? photo?.uri ?? null, isLoadingPreview };
}
