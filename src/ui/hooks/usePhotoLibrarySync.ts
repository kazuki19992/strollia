import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { loadGeotaggedPhotos, type GeotaggedPhotoScanResult, type PhotoScanProgress } from '@/features/photos/photoLibrary';
import { PHOTO_LIBRARY_SYNC_FAILURE_MESSAGE, PHOTO_LIBRARY_SYNC_FAILURE_TITLE } from '@/ui/appText';

/**
 * 進捗を状態へ反映する分割数。
 *
 * 全件走査は数万件に達しうる。1件ごとに `setState` すると再レンダーが走査そのものを遅くするため、
 * 全体を100段階へ間引く。1%刻みなら進捗バーの見た目は滑らかなまま保てる。
 */
const PHOTO_LIBRARY_SYNC_PROGRESS_STEPS = 100;

/** `usePhotoLibrarySync` の引数。 */
export type UsePhotoLibrarySyncParams = {
  /**
   * 全件走査が成功したときに呼ばれる。
   *
   * 地図の表示を `photo_assets` から引き直させるために使う(削除された写真の行が消えるため、
   * 引き直さないと地図に残ったままになる)。
   *
   * **走査結果をそのまま渡す。** 全件走査でもキャッシュ保存が失敗しうるため、呼び出し側は
   * `isCacheSaved` を見てフォールバック表示へ倒すかどうかを判断する必要がある。
   */
  onCompleted?: (result: GeotaggedPhotoScanResult) => void;
};

/** 写真ライブラリの全件再読み込みの状態と操作。 */
export type PhotoLibrarySyncState = {
  /** 全件走査の実行中かどうか。ブロッキングダイアログの表示条件になる。 */
  isSyncingPhotoLibrary: boolean;
  /** 走査の進捗。総数が分かる前(= `exeForMetadata()` 完了前)はnull。 */
  photoLibrarySyncProgress: PhotoScanProgress | null;
  /** 全件走査を開始する。実行中に呼ばれた場合は何もしない。 */
  startPhotoLibrarySync: () => Promise<void>;
};

/**
 * ユーザーの明示操作による写真ライブラリの全件再読み込みを実行する。
 *
 * **全件走査はこの経路でしか走らせない。** 自動で走る走査は差分に限り、重い全件走査は
 * 「ライブラリを再読み込み」を選んだときだけにする(設計書 §4.4)。差分走査が取りこぼす
 * 「古い範囲の削除」「AirDropやインポートで後から入った古い写真」をここで回収する。
 *
 * 実行中は呼び出し側がブロッキングダイアログで操作を止める。走査中に地図を操作すると
 * ネイティブリソースの取り合いで1.6倍遅くなる実測があり(設計書 §2.1)、操作させないことで
 * 結果的に早く終わる。
 *
 * @param params - 完了通知。
 * @returns 実行状態、進捗、開始関数。
 */
export function usePhotoLibrarySync({ onCompleted }: UsePhotoLibrarySyncParams = {}): PhotoLibrarySyncState {
  const [isSyncingPhotoLibrary, setIsSyncingPhotoLibrary] = useState(false);
  const [photoLibrarySyncProgress, setPhotoLibrarySyncProgress] = useState<PhotoScanProgress | null>(null);
  /**
   * 実行中かどうか。
   *
   * 二重起動の判定に state を使うと、同じレンダー内で連続して呼ばれたときに古い値を見てしまう。
   * 判定は同期的に確定させる必要があるため ref で持つ。
   */
  const isSyncingRef = useRef(false);

  const startPhotoLibrarySync = useCallback(async (): Promise<void> => {
    if (isSyncingRef.current) {
      return;
    }

    isSyncingRef.current = true;
    setIsSyncingPhotoLibrary(true);
    setPhotoLibrarySyncProgress(null);

    // 直前に状態へ反映した処理済み件数。間引きの基準に使う
    let reportedProcessedAssetCount = -1;

    try {
      const result = await loadGeotaggedPhotos({
        mode: 'full',
        // `limit` は渡さない。既定の解決に任せることで計測フラグ(EXPO_PUBLIC_PHOTO_SCAN_LIMIT)が生き続ける
        onProgress: (progress) => {
          const step = Math.max(1, Math.floor(progress.totalAssetCount / PHOTO_LIBRARY_SYNC_PROGRESS_STEPS));
          const isFinalProgress = progress.processedAssetCount >= progress.totalAssetCount;

          // 最後の1件だけは間引かない。取りこぼすと「あと少し」で止まって見える
          if (!isFinalProgress && progress.processedAssetCount - reportedProcessedAssetCount < step) {
            return;
          }

          reportedProcessedAssetCount = progress.processedAssetCount;
          setPhotoLibrarySyncProgress(progress);
        },
      });

      onCompleted?.(result);
    } catch (error: unknown) {
      // ユーザーが明示的に始めた操作なので、黙って終わらせずに理由を伝える
      console.warn('Failed to reload photo library:', error);
      Alert.alert(PHOTO_LIBRARY_SYNC_FAILURE_TITLE, error instanceof Error ? error.message : PHOTO_LIBRARY_SYNC_FAILURE_MESSAGE);
    } finally {
      isSyncingRef.current = false;
      setIsSyncingPhotoLibrary(false);
      setPhotoLibrarySyncProgress(null);
    }
  }, [onCompleted]);

  return { isSyncingPhotoLibrary, photoLibrarySyncProgress, startPhotoLibrarySync };
}
