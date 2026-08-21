import { useCallback, useEffect, useRef, useState } from 'react';
import type { Region } from 'react-native-maps';

import { loadGeotaggedPhotos, loadGeotaggedPhotosInBounds, MapPhoto } from '@/features/photos/photoLibrary';
import {
  getPhotoViewportBounds,
  isPhotoViewportBoundsContained,
  PHOTO_VIEWPORT_PADDING_RATIO,
  type PhotoViewportBounds,
} from '@/features/photos/photoViewportBounds';

export type PhotoMapOverlayState = {
  /** マップ上に表示するジオタグ付き写真。 */
  photos: MapPhoto[];
  /** 写真読み込み中かどうか。 */
  isLoadingPhotos: boolean;
  /** 写真読み込み時に発生したエラーメッセージ。 */
  photoErrorMessage: string | null;
  /** 写真一覧を手動で再読み込みする関数。写真ライブラリの走査からやり直す。 */
  reloadPhotos: () => Promise<void>;
};

/**
 * 写真表示設定と表示範囲に応じてジオタグ付き写真を読み込む。
 *
 * 読み込みは2段構えになっている。
 *
 * 1. 写真ライブラリの走査(`loadGeotaggedPhotos`)で `photo_assets` を最新化する。
 *    メインスレッドでのフル解像度デコードを伴うため、写真表示を有効化するたびに1回だけ実行する。
 * 2. `photo_assets` を表示範囲で絞り込んで描画対象を取り出す。
 *
 * 2 は表示範囲が変わるたびに実行しうるが、余白込みで取得した範囲に表示範囲が収まっている間は
 * SQLを撃たない(Visited Grid の `isGridBoundsContained` と同じ考え方)。
 *
 * @param enabled - マップ上の写真表示が有効かどうか。
 * @param region - 現在の地図表示範囲。ジェスチャー中に更新されない範囲を渡すこと。
 * @returns 写真一覧、読み込み状態、エラー、再読み込み関数。
 */
export function usePhotoMapOverlay(enabled: boolean, region: Region): PhotoMapOverlayState {
  const [photos, setPhotos] = useState<MapPhoto[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [photoErrorMessage, setPhotoErrorMessage] = useState<string | null>(null);
  const photoLoadSeqRef = useRef(0);
  /**
   * 写真ライブラリ走査の進行中/完了済みPromise。
   *
   * 表示範囲の変化で読み込みが再入しても走査を二重に走らせないため、Promiseを共有する。
   * 失敗時はnullへ戻し、次回の読み込みで再試行できるようにする。
   */
  const assetSyncPromiseRef = useRef<Promise<void> | null>(null);
  /** 直近で `photo_assets` を検索した範囲(余白込み)。 */
  const fetchedBoundsRef = useRef<PhotoViewportBounds | null>(null);

  /**
   * 写真ライブラリの走査結果を `photo_assets` へ反映する。
   *
   * @param shouldForce - 完了済みでも走査をやり直すかどうか。
   * @returns なし。
   */
  const syncPhotoAssets = useCallback(async (shouldForce: boolean): Promise<void> => {
    if (shouldForce) {
      assetSyncPromiseRef.current = null;
    }

    assetSyncPromiseRef.current ??= loadGeotaggedPhotos()
      .then(() => undefined)
      .catch((error: unknown) => {
        assetSyncPromiseRef.current = null;
        throw error;
      });

    await assetSyncPromiseRef.current;
  }, []);

  const loadPhotosForRegion = useCallback(
    async (shouldForceReload: boolean): Promise<void> => {
      const loadSeq = ++photoLoadSeqRef.current;

      if (!enabled) {
        assetSyncPromiseRef.current = null;
        fetchedBoundsRef.current = null;
        setPhotos([]);
        setPhotoErrorMessage(null);
        setIsLoadingPhotos(false);
        return;
      }

      const fetchedBounds = fetchedBoundsRef.current;

      // 余白の内側に収まっている間は、取得済みの写真がそのまま使えるため再検索しない。
      if (!shouldForceReload && fetchedBounds !== null && isPhotoViewportBoundsContained(fetchedBounds, getPhotoViewportBounds(region))) {
        setIsLoadingPhotos(false);
        return;
      }

      setIsLoadingPhotos(true);
      setPhotoErrorMessage(null);

      try {
        await syncPhotoAssets(shouldForceReload);

        const searchBounds = getPhotoViewportBounds(region, { paddingRatio: PHOTO_VIEWPORT_PADDING_RATIO });
        const loadedPhotos = await loadGeotaggedPhotosInBounds(searchBounds);

        if (loadSeq === photoLoadSeqRef.current) {
          fetchedBoundsRef.current = searchBounds;
          setPhotos(loadedPhotos);
        }
      } catch (error: unknown) {
        if (loadSeq === photoLoadSeqRef.current) {
          fetchedBoundsRef.current = null;
          setPhotos([]);
          setPhotoErrorMessage(error instanceof Error ? error.message : '写真の読み込みに失敗しました。');
        }
      } finally {
        if (loadSeq === photoLoadSeqRef.current) {
          setIsLoadingPhotos(false);
        }
      }
    },
    [enabled, region, syncPhotoAssets],
  );

  /**
   * 設定がONになったタイミングと表示範囲が余白の外へ出たタイミングで写真を読み込み、
   * OFFなら表示状態を即クリアする。
   */
  useEffect(() => {
    loadPhotosForRegion(false);
  }, [loadPhotosForRegion]);

  const reloadPhotos = useCallback((): Promise<void> => loadPhotosForRegion(true), [loadPhotosForRegion]);

  return { photos, isLoadingPhotos, photoErrorMessage, reloadPhotos };
}
