import { useCallback, useEffect, useRef, useState } from 'react';

import { loadGeotaggedPhotos, MapPhoto } from '@/features/photos/photoLibrary';

export type PhotoMapOverlayState = {
  /** マップ上に表示するジオタグ付き写真。 */
  photos: MapPhoto[];
  /** 写真読み込み中かどうか。 */
  isLoadingPhotos: boolean;
  /** 写真読み込み時に発生したエラーメッセージ。 */
  photoErrorMessage: string | null;
  /** 写真一覧を手動で再読み込みする関数。 */
  reloadPhotos: () => Promise<void>;
};

/**
 * 写真表示設定に応じてジオタグ付き写真を読み込む。
 *
 * @param enabled - マップ上の写真表示が有効かどうか。
 * @returns 写真一覧、読み込み状態、エラー、再読み込み関数。
 */
export function usePhotoMapOverlay(enabled: boolean): PhotoMapOverlayState {
  const [photos, setPhotos] = useState<MapPhoto[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [photoErrorMessage, setPhotoErrorMessage] = useState<string | null>(null);
  const photoLoadSeqRef = useRef(0);

  const reloadPhotos = useCallback(async (): Promise<void> => {
    const loadSeq = ++photoLoadSeqRef.current;

    if (!enabled) {
      setPhotos([]);
      setPhotoErrorMessage(null);
      setIsLoadingPhotos(false);
      return;
    }

    setIsLoadingPhotos(true);
    setPhotoErrorMessage(null);

    try {
      const loadedPhotos = await loadGeotaggedPhotos();

      if (loadSeq === photoLoadSeqRef.current) {
        setPhotos(loadedPhotos);
      }
    } catch (error: unknown) {
      if (loadSeq === photoLoadSeqRef.current) {
        setPhotos([]);
        setPhotoErrorMessage(error instanceof Error ? error.message : '写真の読み込みに失敗しました。');
      }
    } finally {
      if (loadSeq === photoLoadSeqRef.current) {
        setIsLoadingPhotos(false);
      }
    }
  }, [enabled]);

  /**
   * 設定がONになったタイミングで写真を読み込み、OFFなら表示状態を即クリアする。
   */
  useEffect(() => {
    reloadPhotos();
  }, [reloadPhotos]);

  return { photos, isLoadingPhotos, photoErrorMessage, reloadPhotos };
}
